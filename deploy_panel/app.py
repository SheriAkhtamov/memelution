#!/usr/bin/env python3
"""
Memelution Deploy Panel v2 — Multi-server, web + CLI
Run: python3 deploy_panel/app.py
     python3 deploy.py --server name [--update|--fresh|--domain x|--env]
"""

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import paramiko
from scp import SCPClient

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
BASE = Path(__file__).resolve().parent
PROJECT_DIR = BASE.parent
CONFIG_PATH = BASE / "config.json"
ARCHIVE_NAME = "memelution_deploy.tar.gz"
EXCLUDES = [
    "node_modules", ".DS_Store", "__pycache__", ".pytest_cache", "dist",
    "memolution.db", "test_memolution.db", ".env", "uploads/*", ".git", "deploy.py", ".venv",
    ".idea", ".vscode", "deploy_panel/config.json",
    "._*", ".ruff_cache",
]

DEFAULT_SERVER = {
    "name": "Новый сервер",
    "host": "",
    "user": "root",
    "password": "",
    "port": 22,
    "project_dir_remote": "/opt/memolution/app",
    "domain": "",
}

HOST_NGINX_CONFIG_HTTP = """server {{
    listen 80;
    server_name {domain};
    return 301 https://$host$request_uri;
}}"""

HOST_NGINX_CONFIG_SSL = """server {{
    listen 443 ssl http2;
    server_name {domain};

    ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50m;

    location /api/ {{
        proxy_pass http://127.0.0.1:{backend_port}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location /media/ {{
        proxy_pass http://127.0.0.1:{backend_port}/media/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location / {{
        proxy_pass http://127.0.0.1:{frontend_port}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}"""

HOST_NGINX_CONFIG = HOST_NGINX_CONFIG_HTTP + "\n" + HOST_NGINX_CONFIG_SSL

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        # ensure structure
        if "servers" not in cfg:
            cfg["servers"] = {}
        if "active_server" not in cfg or cfg["active_server"] not in cfg["servers"]:
            ids = list(cfg["servers"].keys())
            cfg["active_server"] = ids[0] if ids else ""
        return cfg
    return {"active_server": "", "servers": {}}


def save_config(cfg):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def get_server(cfg=None):
    if cfg is None:
        cfg = load_config()
    sid = cfg.get("active_server", "")
    return cfg["servers"].get(sid, {}), sid


# ---------------------------------------------------------------------------
# SSH
# ---------------------------------------------------------------------------

def get_ssh_client(server):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=server["host"],
        port=int(server.get("port", 22)),
        username=server["user"],
        password=server["password"],
        timeout=30,
        look_for_keys=False,
        allow_agent=False,
    )
    return client


def ssh_exec(client, cmd, timeout=600):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return exit_code, out, err


# ---------------------------------------------------------------------------
# Deploy state (per-session, persisted to file for CLI)
# ---------------------------------------------------------------------------

STATE_PATH = BASE / "deploy_state.json"


def load_state():
    if STATE_PATH.exists():
        with open(STATE_PATH) as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


class DeploySession:
    def __init__(self, sid="default"):
        self.sid = sid
        self.logs = []
        self.running = False
        self.success = None
        self.started_at = None
        self.finished_at = None
        self.lock = threading.Lock()

    def add_log(self, icon, message, level="info"):
        entry = {
            "time": datetime.now().strftime("%H:%M:%S"),
            "icon": icon,
            "message": message,
            "level": level,
        }
        self.logs.append(entry)

    def to_dict(self):
        return {
            "running": self.running,
            "success": self.success,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }

    def run(self, fresh=False):
        with self.lock:
            self.logs.clear()
            self.running = True
            self.success = None
            self.started_at = datetime.now().isoformat()
            self.finished_at = None

        cfg = load_config()
        server, _ = get_server(cfg)
        t0 = time.time()
        client = None

        try:
            remote_dir = server["project_dir_remote"]
            domain = server.get("domain", "")

            # Step 1: Create archive
            self.add_log("📦", "[1/7] Создание архива проекта...")
            archive = os.path.join(tempfile.gettempdir(), ARCHIVE_NAME)
            args = []
            for e in EXCLUDES:
                args += ["--exclude", e]
            r = subprocess.run(
                ["tar"] + args + ["-czf", archive, "."],
                cwd=PROJECT_DIR, capture_output=True
            )
            if r.returncode != 0:
                self.add_log("✗", "Ошибка создания архива", "error")
                self.success = False; return
            size_kb = os.path.getsize(archive) / 1024
            self.add_log("✓", f"Архив готов ({size_kb:.0f} KB)", "success")

            # Step 2: Connect & upload
            self.add_log("📡", "[2/7] Подключение к серверу и загрузка...")
            try:
                client = get_ssh_client(server)
            except Exception as e:
                self.add_log("✗", f"Ошибка подключения: {e}", "error")
                self.success = False; return

            scp_client = SCPClient(client.get_transport())
            scp_client.put(archive, f"/tmp/{ARCHIVE_NAME}")
            scp_client.close()
            self.add_log("✓", "Архив загружен на сервер", "success")

            # Step 3: Extract
            if fresh:
                self.add_log("🏗️", "[3/7] Полный деплой с нуля...")
                setup_cmd = f"""
                    mkdir -p {remote_dir} &&
                    cd {remote_dir} &&
                    tar xzf /tmp/{ARCHIVE_NAME} &&
                    find . -name '._*' -delete &&
                    echo DONE
                """
                code, out, err = ssh_exec(client, setup_cmd, timeout=60)
                if "DONE" not in out:
                    self.add_log("✗", f"Ошибка: {err}", "error")
                    self.success = False; return
                self.add_log("✓", "Проект развёрнут с нуля", "success")

                # Seed .env with production config
                code2, out2, _ = ssh_exec(client,
                    f"test -f {remote_dir}/.env && echo EXISTS || echo NO_ENV",
                    timeout=10)
                if "NO_ENV" in out2:
                    import secrets as _secrets
                    jwt_secret = _secrets.token_hex(32)
                    db_password = _secrets.token_urlsafe(16)
                    minio_password = _secrets.token_urlsafe(16)
                    env_content = (
                        f"APP_URL=https://{domain}\n"
                        f"API_URL=https://{domain}\n"
                        f"ENVIRONMENT=production\n"
                        f"DEBUG=false\n\n"
                        f"DATABASE_URL=postgresql+asyncpg://memolution:{db_password}@postgres:5432/memolution\n"
                        f"REDIS_URL=redis://redis:6379/0\n"
                        f"ENABLE_REDIS=true\n\n"
                        f"JWT_SECRET={jwt_secret}\n"
                        f"ACCESS_TOKEN_MINUTES=43200\n\n"
                        f"TELEGRAM_BOT_TOKEN=\n"
                        f"TELEGRAM_CLIENT_ID=\n"
                        f"TELEGRAM_CLIENT_SECRET=\n"
                        f"TELEGRAM_REDIRECT_URI=https://{domain}/api/auth/telegram/callback\n"
                        f"ENABLE_DEV_AUTH=true\n"
                        f"DEV_SEED_ON_STARTUP=false\n\n"
                        f"ADMIN_LOGIN=admin\n"
                        f"ADMIN_PASSWORD=change-me-to-a-strong-password\n\n"
                        f"UPLOAD_DIR=/app/uploads\n"
                        f"MAX_UPLOAD_MB=50\n"
                        f"ALLOWED_MEDIA_TYPES=image/jpeg,image/png,image/webp,image/gif,video/mp4\n\n"
                        f"S3_ENABLED=false\n"
                        f"S3_ENDPOINT_URL=http://minio:9000\n"
                        f"S3_ACCESS_KEY_ID=memolution\n"
                        f"S3_SECRET_ACCESS_KEY={minio_password}\n"
                        f"S3_BUCKET=memolution-media\n"
                        f"S3_PUBLIC_URL=https://{domain}/media\n\n"
                        f"CORS_ORIGINS=https://{domain},http://{domain}\n"
                        f"RATE_LIMIT_WINDOW_SECONDS=60\n"
                        f"RATE_LIMIT_MAX_REQUESTS=180\n\n"
                        f"POSTGRES_DB=memolution\n"
                        f"POSTGRES_USER=memolution\n"
                        f"POSTGRES_PASSWORD={db_password}\n"
                        f"MINIO_ROOT_USER=memolution\n"
                        f"MINIO_ROOT_PASSWORD={minio_password}\n"
                        f"FRONTEND_BIND=127.0.0.1\n"
                        f"FRONTEND_PORT=5173\n"
                        f"BACKEND_PORT=8000\n"
                    )
                    stdin, stdout, stderr = client.exec_command(f"cat > {remote_dir}/.env", timeout=15)
                    stdin.write(env_content)
                    stdin.channel.shutdown_write()
                    self.add_log("✓", ".env сгенерирован (production)", "success")
                    self.add_log("ℹ️", "Настройте TELEGRAM_BOT_TOKEN, TELEGRAM_CLIENT_ID, TELEGRAM_CLIENT_SECRET в ENV-редакторе", "info")
                elif "EXISTS" in out2:
                    self.add_log("ℹ️", ".env уже существует — пропускаю", "info")

                # Ensure Docker
                self.add_log("🐳", "Проверка Docker...")
                code3, out3, _ = ssh_exec(client,
                    "command -v docker >/dev/null 2>&1 && echo HAS_DOCKER || echo NO_DOCKER",
                    timeout=10)
                if "NO_DOCKER" in out3:
                    self.add_log("⏳", "Установка Docker...")
                    docker_install = (
                        "apt-get update -qq && "
                        "apt-get install -y -qq docker.io docker-compose-v2 && "
                        "systemctl enable docker && systemctl start docker && "
                        "echo DOCKER_OK"
                    )
                    code4, out4, err4 = ssh_exec(client, docker_install, timeout=300)
                    if "DOCKER_OK" not in out4:
                        self.add_log("✗", f"Ошибка установки Docker: {err4[:200]}", "error")
                        self.success = False; return
                    self.add_log("✓", "Docker установлен", "success")
                else:
                    self.add_log("✓", "Docker уже установлен", "success")
                    # Ensure docker compose v2
                    code5, out5, _ = ssh_exec(client,
                        "docker compose version >/dev/null 2>&1 && echo HAS_COMPOSE || echo NO_COMPOSE",
                        timeout=10)
                    if "NO_COMPOSE" in out5:
                        self.add_log("⏳", "Установка Docker Compose v2...")
                        compose_install = (
                            "DOCKER_CONFIG=/usr/libexec/docker && mkdir -p $DOCKER_CONFIG/cli-plugins && "
                            "curl -sSL https://github.com/docker/compose/releases/latest/download/"
                            "docker-compose-$(uname -s)-$(uname -m) "
                            "-o $DOCKER_CONFIG/cli-plugins/docker-compose && "
                            "chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose && echo COMPOSE_OK"
                        )
                        code6, out6, _ = ssh_exec(client, compose_install, timeout=120)
                        if "COMPOSE_OK" in out6:
                            self.add_log("✓", "Docker Compose v2 установлен", "success")
                        else:
                            self.add_log("⚠", "Не удалось установить Docker Compose v2", "warning")
            else:
                self.add_log("📦", "[3/7] Обновление файлов...")
                update_cmd = f"""
                    cd {remote_dir} &&
                    cp .env /tmp/.env_bak 2>/dev/null;
                    tar xzf /tmp/{ARCHIVE_NAME} &&
                    find . -name '._*' -delete &&
                    cp /tmp/.env_bak .env 2>/dev/null;
                    echo DONE
                """
                code, out, err = ssh_exec(client, update_cmd, timeout=30)
                if "DONE" not in out:
                    self.add_log("✗", f"Ошибка: {err}", "error")
                    self.success = False; return
                self.add_log("✓", "Файлы обновлены (.env сохранён)", "success")

            # Step 4: Build
            self.add_log("🔨", "[4/7] Сборка Docker (1-3 мин)...")
            code, out, err = ssh_exec(client,
                f"cd {remote_dir} && docker compose build --no-cache backend frontend 2>&1 && echo BUILD_OK",
                timeout=600)
            if "BUILD_OK" not in out:
                err_lines = [l for l in (out + err).split("\n") if "error" in l.lower()]
                self.add_log("✗", f"Ошибка сборки: {'; '.join(err_lines[:3])}", "error")
                self.success = False; return
            self.add_log("✓", "Образы собраны", "success")

            # Step 5: Migrations
            self.add_log("🗃️", "[5/7] Миграции БД...")
            code, out, err = ssh_exec(client,
                f"cd {remote_dir} && docker compose run --rm backend alembic upgrade head 2>&1 && echo MIGRATIONS_OK",
                timeout=180)
            if "MIGRATIONS_OK" not in out:
                err_lines = [l for l in (out + err).split("\n") if "error" in l.lower() or "traceback" in l.lower()]
                self.add_log("✗", f"Ошибка миграций: {'; '.join(err_lines[:3])}", "error")
                self.success = False; return
            self.add_log("✓", "Миграции применены", "success")

            # Step 6: Up containers
            self.add_log("🔄", "[6/7] Запуск контейнеров...")
            code, out, err = ssh_exec(client,
                f"cd {remote_dir} && docker compose up -d 2>&1 && echo UP_OK",
                timeout=120)
            if "UP_OK" not in out:
                self.add_log("✗", f"Ошибка запуска: {err}", "error")
                self.success = False; return
            self.add_log("✓", "Контейнеры запущены", "success")

            # Step 6b: Host nginx (install & configure)
            self.add_log("🌐", "Настройка host nginx...")
            self._setup_host_nginx(client, server, domain)

            # Step 7: SSL
            if domain:
                self.add_log("🔒", f"[7/7] SSL для {domain}...")
                self._setup_ssl(client, domain)
            else:
                self.add_log("⏭️", "Домен не указан — SSL пропущен", "info")

            # Update .env with domain
            if domain:
                ssh_exec(client, f"""
                    cd {remote_dir} &&
                    sed -i 's|^APP_URL=.*|APP_URL=https://{domain}|' .env 2>/dev/null;
                    sed -i 's|^API_URL=.*|API_URL=https://{domain}|' .env 2>/dev/null;
                    sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://{domain},http://{domain}|' .env 2>/dev/null;
                    echo ENV_UPDATED
                """, timeout=10)

            # Cleanup
            try:
                os.remove(archive)
            except Exception:
                pass

            elapsed = int(time.time() - t0)
            self.add_log("🎉", f"Деплой завершён за {elapsed // 60}м {elapsed % 60}с", "success")
            self.add_log("🌐", f"https://{domain}" if domain else f"http://{server['host']}", "success")
            self.success = True

        except Exception as e:
            self.add_log("💥", f"Критическая ошибка: {e}", "error")
            self.success = False
        finally:
            self.running = False
            self.finished_at = datetime.now().isoformat()
            if client:
                try:
                    client.close()
                except Exception:
                    pass

    def _setup_host_nginx(self, client, server, domain):
        if not domain:
            self.add_log("⏭️", "Домен не указан — host nginx пропущен", "info")
            return

        backend_port = 8000
        frontend_port = 5173

        # Ensure nginx installed
        code, out, err = ssh_exec(client,
            "command -v nginx >/dev/null 2>&1 && echo NGINX_EXISTS || "
            "(apt-get update -qq && apt-get install -y -qq nginx && echo NGINX_INSTALLED)",
            timeout=120)
        if "NGINX_EXISTS" in out:
            self.add_log("✓", "Nginx уже установлен", "success")
        elif "NGINX_INSTALLED" in out:
            self.add_log("✓", "Nginx установлен", "success")
        else:
            self.add_log("⚠", f"Nginx: {err[:200]}", "warning")

        # Check if SSL cert already exists
        code, cert_out, _ = ssh_exec(client,
            f"test -f /etc/letsencrypt/live/{domain}/fullchain.pem && echo SSL_EXISTS || echo NO_SSL",
            timeout=10)
        has_ssl = "SSL_EXISTS" in cert_out

        if has_ssl:
            config_body = HOST_NGINX_CONFIG.format(
                domain=domain, backend_port=backend_port, frontend_port=frontend_port
            )
        else:
            http_only = """server {{
    listen 80;
    server_name {domain};

    client_max_body_size 50m;

    location /api/ {{
        proxy_pass http://127.0.0.1:{backend_port}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location /media/ {{
        proxy_pass http://127.0.0.1:{backend_port}/media/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location / {{
        proxy_pass http://127.0.0.1:{frontend_port}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}"""
            config_body = http_only.format(
                domain=domain, backend_port=backend_port, frontend_port=frontend_port
            )

        escaped = config_body.replace("'", "'\\''")
        cmds = f"""
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled &&
echo '{escaped}' > /etc/nginx/sites-available/{domain} &&
ln -sf /etc/nginx/sites-available/{domain} /etc/nginx/sites-enabled/{domain} &&
rm -f /etc/nginx/sites-enabled/default &&
echo CONFIG_WRITTEN
"""
        code, out, err = ssh_exec(client, cmds, timeout=15)
        if "CONFIG_WRITTEN" in out:
            self.add_log("✓", "Nginx config создан" + (" (SSL)" if has_ssl else ""), "success")
        else:
            self.add_log("⚠", f"Nginx config: {err[:200]}", "warning")

        # Test & reload
        code, out, err = ssh_exec(client, "nginx -t 2>&1 && systemctl reload nginx && echo NGINX_OK", timeout=15)
        if "NGINX_OK" in out:
            self.add_log("✓", "Nginx перезагружен", "success")
        else:
            self.add_log("⚠", f"Nginx reload: {(out+err)[:200]}", "warning")

    def _setup_ssl(self, client, domain):
        ssl_cmd = (
            "command -v certbot >/dev/null 2>&1"
            " || (apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx);"
            f" test -f /etc/letsencrypt/renewal/{domain}.conf"
            " && echo CERT_EXISTS"
            f" || (certbot --nginx -d {domain} --non-interactive --agree-tos"
            " --register-unsafely-without-email --redirect 2>&1 && echo CERT_CREATED);"
            " test -f /etc/cron.d/certbot && echo CRON_EXISTS"
            ' || (echo \'0 0,12 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"\''
            " > /etc/cron.d/certbot && echo CRON_CREATED)"
        )
        code, out, err = ssh_exec(client, ssl_cmd, timeout=180)
        if "CERT_EXISTS" in out or "CERT_CREATED" in out:
            self.add_log("✓", "SSL сертификат установлен", "success")
        else:
            self.add_log("⚠", f"SSL: {(out+err)[:200]}", "warning")
        if "CRON_EXISTS" in out or "CRON_CREATED" in out:
            self.add_log("✓", "Автообновление SSL (cron) настроено", "success")


# ---------------------------------------------------------------------------
# Active session
# ---------------------------------------------------------------------------

sessions = {}


def get_session(sid):
    if sid not in sessions:
        sessions[sid] = DeploySession(sid)
    return sessions[sid]


# =========================================================================
# API Routes
# =========================================================================

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ---- Servers ----

@app.route("/api/servers", methods=["GET"])
def api_servers_list():
    cfg = load_config()
    result = {}
    for sid, srv in cfg.get("servers", {}).items():
        result[sid] = {k: v for k, v in srv.items() if k != "password"}
        result[sid]["has_password"] = bool(srv.get("password"))
    return jsonify({
        "servers": result,
        "active_server": cfg.get("active_server", ""),
    })


@app.route("/api/servers", methods=["POST"])
def api_servers_save():
    cfg = load_config()
    data = request.json
    sid = data.get("id", "").strip()
    if not sid:
        return jsonify({"ok": False, "error": "ID сервера не указан"})

    srv = cfg["servers"].get(sid, dict(DEFAULT_SERVER))
    for key in ["name", "host", "user", "port", "project_dir_remote", "domain"]:
        if key in data:
            srv[key] = data[key]
    # Password: only update if not masked
    if "password" in data and data["password"] and not set(data["password"]) == {"●"}:
        srv["password"] = data["password"]

    cfg["servers"][sid] = srv
    if not cfg.get("active_server"):
        cfg["active_server"] = sid

    save_config(cfg)
    return jsonify({"ok": True})


@app.route("/api/servers/<sid>", methods=["DELETE"])
def api_servers_delete(sid):
    cfg = load_config()
    if sid in cfg.get("servers", {}):
        del cfg["servers"][sid]
        if cfg.get("active_server") == sid:
            ids = list(cfg["servers"].keys())
            cfg["active_server"] = ids[0] if ids else ""
        save_config(cfg)
    return jsonify({"ok": True})


@app.route("/api/servers/activate", methods=["POST"])
def api_servers_activate():
    cfg = load_config()
    data = request.json
    sid = data.get("id", "")
    if sid in cfg.get("servers", {}):
        cfg["active_server"] = sid
        save_config(cfg)
    return jsonify({"ok": True})


@app.route("/api/servers/test", methods=["POST"])
def api_servers_test():
    cfg = load_config()
    data = request.json
    sid = data.get("id", cfg.get("active_server", ""))
    server = cfg["servers"].get(sid)
    if not server or not server.get("host"):
        return jsonify({"ok": False, "error": "Сервер не настроен"})

    # Allow overriding password from form
    srv = dict(server)
    if "password" in data and data["password"] and not set(data["password"]) == {"●"}:
        srv["password"] = data["password"]

    try:
        client = get_ssh_client(srv)
        _, out, _ = ssh_exec(client, "echo OK && uname -a", timeout=15)
        client.close()
        if "OK" in out:
            return jsonify({"ok": True, "info": out.strip()})
        return jsonify({"ok": False, "error": "Неожиданный ответ"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


# ---- Deploy ----

@app.route("/api/deploy/start", methods=["POST"])
def api_deploy_start():
    data = request.json or {}
    fresh = data.get("fresh", False)
    sid = data.get("server_id", "")

    cfg = load_config()
    if not sid or sid not in cfg["servers"]:
        sid = cfg.get("active_server", "")
    if not sid:
        return jsonify({"ok": False, "error": "Нет активного сервера"})

    s = get_session(sid)
    if s.running:
        return jsonify({"ok": False, "error": "Деплой уже выполняется"})

    thread = threading.Thread(target=s.run, args=(fresh,), daemon=True)
    thread.start()

    # Persist state
    state = load_state()
    state[sid] = {"running": True, "started_at": datetime.now().isoformat()}
    save_state(state)

    return jsonify({"ok": True, "session": sid})


@app.route("/api/deploy/status", methods=["GET"])
def api_deploy_status():
    sid = request.args.get("server_id", "")
    cfg = load_config()
    if not sid or sid not in cfg["servers"]:
        sid = cfg.get("active_server", "")

    s = get_session(sid)
    return jsonify({
        "status": s.to_dict(),
        "logs": s.logs[-300:],
        "session": sid,
    })


# ---- Domain ----

@app.route("/api/domain/change", methods=["POST"])
def api_domain_change():
    cfg = load_config()
    data = request.json
    sid = data.get("server_id", cfg.get("active_server", ""))
    new_domain = data.get("domain", "").strip()
    if not new_domain:
        return jsonify({"ok": False, "error": "Домен не указан"})

    server = cfg["servers"].get(sid)
    if not server or not server.get("host"):
        return jsonify({"ok": False, "error": "Сервер не настроен"})

    try:
        client = get_ssh_client(server)
    except Exception as e:
        return jsonify({"ok": False, "error": f"SSH: {e}"})

    old_domain = server.get("domain", "")
    remote_dir = server["project_dir_remote"]
    results = []

    try:
        # 1. Nginx config — write HTTP-only first, certbot will add SSL
        http_only = """server {{
    listen 80;
    server_name {domain};

    client_max_body_size 50m;

    location /api/ {{
        proxy_pass http://127.0.0.1:{backend_port}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location /media/ {{
        proxy_pass http://127.0.0.1:{backend_port}/media/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location / {{
        proxy_pass http://127.0.0.1:{frontend_port}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}"""
        config_body = http_only.format(domain=new_domain, backend_port=8000, frontend_port=5173)
        escaped = config_body.replace("'", "'\\''")
        cmds = f"""
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled &&
echo '{escaped}' > /etc/nginx/sites-available/{new_domain} &&
ln -sf /etc/nginx/sites-available/{new_domain} /etc/nginx/sites-enabled/{new_domain}
"""
        if old_domain and old_domain != new_domain:
            cmds += f" && rm -f /etc/nginx/sites-available/{old_domain} /etc/nginx/sites-enabled/{old_domain}"

        cmds += " && rm -f /etc/nginx/sites-enabled/default && echo NGINX_DONE"
        _, out, _ = ssh_exec(client, cmds, timeout=15)

        code, out, err = ssh_exec(client, "nginx -t 2>&1 && systemctl reload nginx && echo NGINX_OK", timeout=15)
        if "NGINX_OK" in out:
            results.append("✓ Nginx перенастроен")
        else:
            results.append(f"⚠ Nginx: {(out+err)[:200]}")

        # 2. Update .env
        env_updates = {
            "APP_URL": f"https://{new_domain}",
            "API_URL": f"https://{new_domain}",
            "CORS_ORIGINS": f"https://{new_domain},http://{new_domain}",
        }
        for key, value in env_updates.items():
            ssh_exec(client,
                f"cd {remote_dir} && sed -i 's|^{key}=.*|{key}={value}|' .env", timeout=5)
        results.append("✓ .env обновлён")

        # 3. SSL
        ssl_cmd = (
            "command -v certbot >/dev/null 2>&1"
            " || (apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx);"
            f" certbot --nginx -d {new_domain} --non-interactive --agree-tos"
            " --register-unsafely-without-email --redirect 2>&1 && echo CERT_OK"
        )
        code, out, err = ssh_exec(client, ssl_cmd, timeout=180)
        if "CERT_OK" in out:
            results.append("✓ SSL сертификат получен")
        else:
            results.append(f"⚠ SSL: {(out+err)[:300]}")

        # 4. Restart containers
        code, out, err = ssh_exec(client,
            f"cd {remote_dir} && docker compose restart backend frontend 2>&1 && echo RESTART_OK", timeout=60)
        if "RESTART_OK" in out:
            results.append("✓ Контейнеры перезапущены")
        else:
            results.append(f"⚠ Перезапуск: {err[:200]}")

        # Cron
        ssh_exec(client,
            "test -f /etc/cron.d/certbot && echo CRON_EXISTS"
            ' || (echo \'0 0,12 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"\''
            " > /etc/cron.d/certbot)", timeout=10)

        client.close()

        # Save new domain to config
        server["domain"] = new_domain
        cfg["servers"][sid] = server
        save_config(cfg)

        return jsonify({"ok": True, "results": results})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e), "results": results})


# ---- ENV ----

@app.route("/api/env", methods=["GET"])
def api_env_get():
    cfg = load_config()
    sid = request.args.get("server_id", cfg.get("active_server", ""))
    server = cfg["servers"].get(sid)
    if not server or not server.get("host"):
        return jsonify({"ok": False, "error": "Сервер не настроен"})
    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]
        code, out, err = ssh_exec(client,
            f"cat {remote_dir}/.env 2>/dev/null || echo __NO_ENV__", timeout=10)
        client.close()
        if "__NO_ENV__" in out:
            return jsonify({"ok": True, "env": "", "exists": False})
        return jsonify({"ok": True, "env": out, "exists": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/api/env", methods=["POST"])
def api_env_save():
    cfg = load_config()
    data = request.json
    sid = data.get("server_id", cfg.get("active_server", ""))
    env_content = data.get("env", "")
    server = cfg["servers"].get(sid)
    if not server or not server.get("host"):
        return jsonify({"ok": False, "error": "Сервер не настроен"})
    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]
        stdin, stdout, stderr = client.exec_command(f"cat > {remote_dir}/.env", timeout=10)
        stdin.write(env_content)
        stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            err = stderr.read().decode()
            client.close()
            return jsonify({"ok": False, "error": f"Ошибка: {err}"})
        client.close()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/api/env/restart", methods=["POST"])
def api_env_restart():
    cfg = load_config()
    data = request.json or {}
    sid = data.get("server_id", cfg.get("active_server", ""))
    server = cfg["servers"].get(sid)
    if not server or not server.get("host"):
        return jsonify({"ok": False, "error": "Сервер не настроен"})
    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]
        code, out, err = ssh_exec(client,
            f"cd {remote_dir} && docker compose restart 2>&1 && echo RESTART_OK", timeout=120)
        client.close()
        if "RESTART_OK" in out:
            return jsonify({"ok": True})
        return jsonify({"ok": False, "error": err[:300]})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


# ---- Status ----

@app.route("/api/server/status", methods=["GET"])
def api_server_status():
    cfg = load_config()
    sid = request.args.get("server_id", cfg.get("active_server", ""))
    server = cfg["servers"].get(sid)
    if not server or not server.get("host"):
        return jsonify({"ok": False, "error": "Сервер не настроен"})
    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]

        code, containers_out, _ = ssh_exec(client,
            f"cd {remote_dir} && docker compose ps --format json 2>/dev/null || docker compose ps 2>/dev/null",
            timeout=15)
        code, sys_out, _ = ssh_exec(client,
            "echo '---UPTIME---' && uptime && echo '---DISK---' && df -h / | tail -1 && echo '---RAM---' && free -h | grep Mem && echo '---DOCKER---' && docker --version && docker compose version",
            timeout=10)
        code, nginx_out, _ = ssh_exec(client,
            "nginx -t 2>&1; echo '---'; systemctl is-active nginx 2>/dev/null; echo '---'; "
            "certbot certificates 2>/dev/null | head -5",
            timeout=10)

        client.close()
        return jsonify({
            "ok": True,
            "containers": containers_out,
            "system": sys_out,
            "nginx": nginx_out,
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


# =========================================================================
# Main
# =========================================================================

if __name__ == "__main__":
    print("\n" + "═" * 50)
    print("  🚀  Memelution Deploy Panel v2")
    print("  🌐  http://localhost:5050")
    print("═" * 50 + "\n")
    app.run(host="0.0.0.0", port=5050, debug=True)
