#!/usr/bin/env python3
"""
Memelution Deploy v2 — CLI interface
Usage:
  python3 deploy.py                    # Interactive menu
  python3 deploy.py --server <id> --update
  python3 deploy.py --server <id> --fresh
  python3 deploy.py --server <id> --domain <newdomain>
  python3 deploy.py --server <id> --env cat
  python3 deploy.py --server <id> --env edit
  python3 deploy.py --server <id> --status
  python3 deploy.py --web              # Launch web panel
"""

import json
import os
import sys
import threading
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent
PANEL_DIR = BASE / "deploy_panel"
sys.path.insert(0, str(PANEL_DIR))

G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"
C = "\033[96m"; B = "\033[1m"; X = "\033[0m"


def log(msg, color=X):
    print(f"{color}{msg}{X}")


def load_config():
    cfg_path = PANEL_DIR / "config.json"
    if cfg_path.exists():
        with open(cfg_path) as f:
            return json.load(f)
    return {"active_server": "", "servers": {}}


def get_server(cfg, sid=None):
    if not sid:
        sid = cfg.get("active_server", "")
    return cfg["servers"].get(sid, {}), sid


def list_servers(cfg):
    servers = cfg.get("servers", {})
    if not servers:
        log("Нет настроенных серверов. Запустите веб-панель: python3 deploy.py --web", R)
        return
    active = cfg.get("active_server", "")
    log(f"\n{C}{'─'*50}{X}")
    log(f"{'Сервер':20} {'IP':16} {'Домен':20} {'Статус':10}")
    log(f"{'─'*50}")
    for sid, srv in servers.items():
        marker = "◉" if sid == active else "○"
        domain = srv.get("domain", "") or "—"
        ip = srv.get("host", "не настроен") or "не настроен"
        log(f"{marker} {sid:<18} {ip:<16} {domain:<20}")
    log(f"{'─'*50}{X}")
    log(f"Активный: {B}{active}{X}\n")


def interactive_menu():
    cfg = load_config()
    while True:
        os.system("clear" if os.name == "posix" else "cls")
        log(f"{B}{'═'*55}{X}")
        log(f"{B}  🚀  Memelution Deploy v2  |  {C}python3 deploy.py —web{X}")
        log(f"{B}{'═'*55}{X}")
        list_servers(cfg)

        sid = cfg.get("active_server", "")
        srv, _ = get_server(cfg)

        log(f"{B}Доступные команды:{X}")
        log(f"  {C}[1]{X}  Деплой — обновить проект")
        log(f"  {C}[2]{X}  Деплой с нуля (полная установка)")
        log(f"  {C}[3]{X}  Сменить домен")
        log(f"  {C}[4]{X}  Посмотреть .env на сервере")
        log(f"  {C}[5]{X}  Редактировать .env на сервере")
        log(f"  {C}[6]{X}  Статус сервера + контейнеры")
        log(f"  {C}[7]{X}  Переключить активный сервер")
        log(f"  {C}[8]{X}  Добавить/редактировать сервер")
        log(f"  {C}[9]{X}  Тест SSH соединения")
        log(f"  {C}[0]{X}  Запустить веб-панель")
        log(f"  {C}[q]{X}  Выход\n")

        choice = input(f"{B}Выберите [{C}1-9,0,q{X}]: {X}").strip().lower()

        if choice == "q":
            log("Пока!", G); break
        elif choice == "0":
            run_web_panel()
        elif choice == "1":
            confirm = input("Обновить проект? (y/N): ").strip().lower()
            if confirm == "y":
                run_deploy(sid, fresh=False)
                input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        elif choice == "2":
            confirm = input("Деплой С НУЛЯ? (y/N): ").strip().lower()
            if confirm == "y":
                run_deploy(sid, fresh=True)
                input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        elif choice == "3":
            handle_domain_change(sid)
            input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        elif choice == "4":
            handle_env_cat(sid)
            input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        elif choice == "5":
            handle_env_edit(sid)
            input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        elif choice == "6":
            handle_status(sid)
            input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        elif choice == "7":
            handle_switch_server()
            cfg = load_config()
        elif choice == "8":
            handle_edit_server()
            cfg = load_config()
        elif choice == "9":
            handle_test_connection(sid)
            input(f"\n{G}Нажмите Enter чтобы продолжить...{X}")
        else:
            log("Неверный выбор", R)
            time.sleep(1)


# =========================================================================
# Handlers
# =========================================================================

def run_web_panel():
    log("\nЗапуск веб-панели...", C)
    os.execv(sys.executable, [sys.executable, str(PANEL_DIR / "app.py")])


def run_deploy(sid, fresh=False):
    from app import DeploySession, load_config as lc, get_server as gs

    cfg = lc()
    s = DeploySession(sid)
    log(f"{'─'*55}")
    log(f"{'🔨 ДЕПЛОЙ (fresh)' if fresh else '🔄 ОБНОВЛЕНИЕ'} — сервер: {B}{sid}{X}")
    log(f"{'─'*55}\n")

    seen = len(s.logs)
    thread = threading.Thread(target=s.run, args=(fresh,), daemon=True)
    thread.start()

    while thread.is_alive():
        for entry in s.logs[seen:]:
            level = entry.get("level", "info")
            c = {"success": G, "error": R, "warning": Y, "info": C}.get(level, X)
            print(f"  {c}{entry['icon']} {entry['message']}{X}")
            if level == "error":
                break
        seen = len(s.logs)
        time.sleep(0.3)

    time.sleep(0.5)
    for entry in s.logs[seen:]:
        level = entry.get("level", "info")
        c = {"success": G, "error": R, "warning": Y, "info": C}.get(level, X)
        print(f"  {c}{entry['icon']} {entry['message']}{X}")

    if s.success:
        log(f"\n{G}✅ Деплой завершён успешно!{X}")
    else:
        log(f"\n{R}❌ Деплой завершился с ошибкой{X}")


def handle_domain_change(sid):
    new_domain = input("Новый домен (например, example.com): ").strip()
    if not new_domain:
        log("Домен не указан", R); return
    if not input(f"Сменить на {new_domain}? (y/N): ").strip().lower() == "y":
        return

    from app import load_config as lc, get_server as gs, get_ssh_client, ssh_exec, HOST_NGINX_CONFIG

    cfg = lc()
    server, _ = gs(cfg)
    if not server.get("host"):
        log("Сервер не настроен", R); return

    try:
        client = get_ssh_client(server)
    except Exception as e:
        log(f"SSH ошибка: {e}", R); return

    old_domain = server.get("domain", "")
    remote_dir = server["project_dir_remote"]
    results = []

    # 1. Nginx
    log("🌐 Настройка Nginx...", C)
    config_body = HOST_NGINX_CONFIG.format(domain=new_domain, backend_port=8000, frontend_port=5173)
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
        log("  ✓ Nginx перенастроен", G)
    else:
        log(f"  ⚠ Nginx: {(out+err)[:200]}", Y)

    # 2. .env
    env_updates = {
        "APP_URL": f"https://{new_domain}",
        "API_URL": f"https://{new_domain}",
        "CORS_ORIGINS": f"https://{new_domain},http://{new_domain}",
    }
    for key, value in env_updates.items():
        ssh_exec(client, f"cd {remote_dir} && sed -i 's|^{key}=.*|{key}={value}|' .env", timeout=5)
    log("  ✓ .env обновлён", G)

    # 3. SSL
    log("🔒 Получение SSL сертификата...", C)
    ssl_cmd = (
        "command -v certbot >/dev/null 2>&1"
        " || (apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx);"
        f" certbot --nginx -d {new_domain} --non-interactive --agree-tos"
        " --register-unsafely-without-email --redirect 2>&1 && echo CERT_OK"
    )
    code, out, err = ssh_exec(client, ssl_cmd, timeout=180)
    if "CERT_OK" in out:
        log("  ✓ SSL сертификат получен", G)
    else:
        log(f"  ⚠ SSL: {(out+err)[:300]}", Y)

    # 4. Restart
    log("🔄 Перезапуск контейнеров...", C)
    code, out, err = ssh_exec(client, f"cd {remote_dir} && docker compose restart backend frontend 2>&1 && echo RESTART_OK", timeout=60)
    if "RESTART_OK" in out:
        log("  ✓ Контейнеры перезапущены", G)
    else:
        log(f"  ⚠ {err[:200]}", Y)

    # 5. Cron
    ssh_exec(client,
        "test -f /etc/cron.d/certbot && echo CRON_EXISTS"
        ' || (echo \'0 0,12 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"\''
        " > /etc/cron.d/certbot)", timeout=10)
    log("  ✓ Cron автообновления настроен", G)

    client.close()

    # Save
    server["domain"] = new_domain
    cfg["servers"][sid] = server
    with open(PANEL_DIR / "config.json", "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

    log(f"\n{G}✅ Домен изменён на {new_domain}{X}")


def handle_env_cat(sid):
    from app import load_config as lc, get_server as gs, get_ssh_client, ssh_exec

    cfg = lc()
    server, _ = gs(cfg)
    if not server.get("host"):
        log("Сервер не настроен", R); return

    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]
        code, out, err = ssh_exec(client, f"cat {remote_dir}/.env 2>/dev/null || echo __NO_ENV__", timeout=10)
        client.close()
        if "__NO_ENV__" in out:
            log(".env не найден на сервере", R)
        else:
            log(f"\n{C}{'─'*55}{X}")
            log(f"{B}.env на сервере {server['host']}:{X}\n")
            print(out)
            log(f"{C}{'─'*55}{X}")
    except Exception as e:
        log(f"Ошибка: {e}", R)


def handle_env_edit(sid):
    from app import load_config as lc, get_server as gs, get_ssh_client, ssh_exec
    import tempfile

    cfg = lc()
    server, _ = gs(cfg)
    if not server.get("host"):
        log("Сервер не настроен", R); return

    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]
        code, out, err = ssh_exec(client, f"cat {remote_dir}/.env 2>/dev/null || echo __NO_ENV__", timeout=10)
        client.close()

        if "__NO_ENV__" in out:
            log(".env не найден", R); return

        # Write to temp file
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".env", delete=False, prefix="memelution_env_")
        tmp.write(out)
        tmp.close()

        editor = os.environ.get("EDITOR", "vim")
        log(f"Открываю {editor}... (сохраните и закройте редактор когда закончите)", C)
        os.system(f'{editor} "{tmp.name}"')

        # Read back
        with open(tmp.name, "r") as f:
            new_content = f.read()
        os.unlink(tmp.name)

        if new_content == out:
            log("Изменений нет", Y); return

        # Upload
        client2 = get_ssh_client(server)
        stdin, stdout, stderr = client2.exec_command(f"cat > {remote_dir}/.env", timeout=10)
        stdin.write(new_content)
        stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        err_text = stderr.read().decode()
        client2.close()

        if exit_code == 0:
            log("✓ .env сохранён на сервер", G)
            if input("Перезапустить контейнеры? (y/N): ").strip().lower() == "y":
                client3 = get_ssh_client(server)
                code, out, err = ssh_exec(client3, f"cd {remote_dir} && docker compose restart 2>&1 && echo RESTART_OK", timeout=120)
                client3.close()
                if "RESTART_OK" in out:
                    log("✓ Контейнеры перезапущены", G)
                else:
                    log(f"⚠ {err[:200]}", Y)
        else:
            log(f"Ошибка: {err_text}", R)

    except Exception as e:
        log(f"Ошибка: {e}", R)


def handle_status(sid):
    from app import load_config as lc, get_server as gs, get_ssh_client, ssh_exec

    cfg = lc()
    server, _ = gs(cfg)
    if not server.get("host"):
        log("Сервер не настроен", R); return

    log(f"\n📊 Статус сервера {B}{server['host']}{X}\n", C)

    try:
        client = get_ssh_client(server)
        remote_dir = server["project_dir_remote"]

        # System
        code, sys_out, _ = ssh_exec(client,
            "echo '---UPTIME---' && uptime && echo '---DISK---' && df -h / | tail -1 && echo '---RAM---' && free -h | grep Mem",
            timeout=10)
        print(f"  {sys_out}")

        # Docker
        code, docker_out, _ = ssh_exec(client, "docker --version 2>/dev/null && docker compose version 2>/dev/null", timeout=5)
        print(f"  {docker_out}")

        # Containers
        code, cont_out, _ = ssh_exec(client,
            f"cd {remote_dir} && docker compose ps 2>/dev/null || echo 'Нет docker-compose.yml'",
            timeout=10)
        print(f"\n  {B}Контейнеры:{X}\n{cont_out}")

        # Nginx + SSL
        code, nginx_out, _ = ssh_exec(client,
            "echo '---NGINX---' && nginx -t 2>&1 && systemctl is-active nginx && echo '---CERT---' && certbot certificates 2>/dev/null | head -5",
            timeout=10)
        print(f"  {nginx_out}")

        client.close()
    except Exception as e:
        log(f"Ошибка: {e}", R)


def handle_switch_server():
    cfg = load_config()
    servers = cfg.get("servers", {})
    if not servers:
        log("Нет серверов", R); return

    log("\nДоступные серверы:")
    ids = list(servers.keys())
    for i, sid in enumerate(ids, 1):
        srv = servers[sid]
        marker = "◉" if sid == cfg.get("active_server") else "○"
        log(f"  {C}[{i}]{X} {marker} {sid} — {srv.get('name', '')} ({srv.get('host', 'не настроен')})")
    log(f"  {C}[0]{X} Отмена\n")

    choice = input("Выберите сервер: ").strip()
    if choice == "0":
        return
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(ids):
            new_sid = ids[idx]
            cfg["active_server"] = new_sid
            with open(PANEL_DIR / "config.json", "w") as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
            log(f"✓ Активный сервер: {B}{new_sid}{X}", G)
    except (ValueError, IndexError):
        log("Неверный выбор", R)


def handle_edit_server():
    cfg = load_config()
    servers = cfg.get("servers", {})
    ids = list(servers.keys())

    log("\nРедактирование серверов:")
    for i, sid in enumerate(ids, 1):
        srv = servers[sid]
        log(f"  {C}[{i}]{X} {sid} — {srv.get('name', '')} ({srv.get('host', 'не настроен')})")
    log(f"  {C}[n]{X} Новый сервер")
    log(f"  {C}[d]{X} Удалить сервер")
    log(f"  {C}[0]{X} Назад\n")

    choice = input("Выберите: ").strip().lower()

    if choice == "0":
        return
    elif choice == "n":
        sid = input("ID сервера (например, my-server): ").strip()
        if not sid:
            log("ID не указан", R); return
        if sid in servers:
            log("Сервер с таким ID уже существует", R); return
        srv = {"name": input("Название: ").strip() or "Новый сервер"}
        srv["host"] = input("IP адрес: ").strip()
        srv["user"] = input("Пользователь [root]: ").strip() or "root"
        srv["password"] = input("Пароль: ").strip()
        try:
            srv["port"] = int(input("SSH порт [22]: ").strip() or "22")
        except ValueError:
            srv["port"] = 22
        srv["project_dir_remote"] = input("Путь к проекту [/opt/memolution/app]: ").strip() or "/opt/memolution/app"
        srv["domain"] = input("Домен (если есть): ").strip()
        cfg["servers"][sid] = srv
        if not cfg.get("active_server"):
            cfg["active_server"] = sid
        with open(PANEL_DIR / "config.json", "w") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
        log("✓ Сервер добавлен", G)

    elif choice == "d":
        if not ids:
            log("Нет серверов для удаления", Y); return
        did = input("ID сервера для удаления: ").strip()
        if did in cfg["servers"]:
            if input(f"Удалить {did}? (y/N): ").strip().lower() == "y":
                del cfg["servers"][did]
                if cfg.get("active_server") == did:
                    remaining = list(cfg["servers"].keys())
                    cfg["active_server"] = remaining[0] if remaining else ""
                with open(PANEL_DIR / "config.json", "w") as f:
                    json.dump(cfg, f, indent=2, ensure_ascii=False)
                log("✓ Удалено", G)
        else:
            log("Сервер не найден", R)

    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(ids):
                sid = ids[idx]
                srv = servers[sid]
                log(f"\nРедактирование {sid} (Enter = оставить как есть):")
                srv["name"] = input(f"Название [{srv.get('name', '')}]: ").strip() or srv.get("name", "")
                new_host = input(f"IP [{srv.get('host', '')}]: ").strip()
                if new_host:
                    srv["host"] = new_host
                new_pass = input("Новый пароль (Enter = не менять): ").strip()
                if new_pass:
                    srv["password"] = new_pass
                new_domain = input(f"Домен [{srv.get('domain', '')}]: ").strip()
                if new_domain:
                    srv["domain"] = new_domain
                cfg["servers"][sid] = srv
                with open(PANEL_DIR / "config.json", "w") as f:
                    json.dump(cfg, f, indent=2, ensure_ascii=False)
                log("✓ Обновлено", G)
        except (ValueError, IndexError):
            log("Неверный выбор", R)


def handle_test_connection(sid):
    from app import load_config as lc, get_server as gs, get_ssh_client, ssh_exec

    cfg = lc()
    server, _ = gs(cfg)
    if not server.get("host"):
        log("Сервер не настроен", R); return

    log(f"Тест соединения с {B}{server['host']}{X}...")
    try:
        client = get_ssh_client(server)
        code, out, err = ssh_exec(client, "echo OK && hostname && cat /etc/os-release | head -1", timeout=15)
        client.close()
        if "OK" in out:
            log(f"✓ OK — {out.strip()}", G)
        else:
            log(f"✗ {err[:200]}", R)
    except Exception as e:
        log(f"✗ {e}", R)


# =========================================================================
# CLI args
# =========================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Memelution Deploy v2")
    parser.add_argument("--server", help="ID сервера")
    parser.add_argument("--update", action="store_true", help="Обновить проект")
    parser.add_argument("--fresh", action="store_true", help="Деплой с нуля")
    parser.add_argument("--domain", help="Сменить домен")
    parser.add_argument("--env", choices=["cat", "edit"], help="Просмотр/редактирование .env")
    parser.add_argument("--status", action="store_true", help="Статус сервера")
    parser.add_argument("--web", action="store_true", help="Запустить веб-панель")

    args = parser.parse_args()

    if args.web:
        run_web_panel()
        return

    # Determine server id
    cfg = load_config()
    sid = args.server or cfg.get("active_server", "")
    if not sid or sid not in cfg.get("servers", {}):
        log("Сервер не указан или не найден. Используйте --server <id>", R)
        sys.exit(1)

    if args.update:
        run_deploy(sid, fresh=False)
    elif args.fresh:
        run_deploy(sid, fresh=True)
    elif args.domain:
        handle_domain_change(sid)
    elif args.env == "cat":
        handle_env_cat(sid)
    elif args.env == "edit":
        handle_env_edit(sid)
    elif args.status:
        handle_status(sid)
    else:
        interactive_menu()


if __name__ == "__main__":
    main()
