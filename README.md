# Мемолюция

«Мемолюция» — веб-соцсеть для мемов, коротких постов, сообществ, обсуждений и личных сообщений.

Проект состоит из FastAPI backend, React/Vite frontend и инфраструктуры для PostgreSQL, Redis и MinIO.

## Структура

```text
.
├── backend/           # FastAPI API, SQLAlchemy models, Alembic, seed, tests
├── frontend/          # React 19 + Vite frontend
├── nginx/             # Nginx config для Docker frontend
├── uploads/           # Локальные загруженные медиа в dev-режиме
├── docker-compose.yml # PostgreSQL, Redis, MinIO, backend, frontend
├── .env.example       # Пример переменных окружения
└── package.json       # Корневые dev/test/build команды
```

## Требования

- Python 3.11+ для backend.
- Node.js 22+ и npm для frontend.
- Docker и Docker Compose для контейнерного запуска.

## Быстрый запуск через Docker

```bash
cp .env.example .env
docker compose up --build
```

После первого старта можно наполнить базу dev-данными:

```bash
docker compose exec backend python -m app.seed
```

Адреса:

- Frontend: `http://localhost:5173`
- Backend healthcheck: `http://localhost:8000/api/health`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

По умолчанию Compose поднимает:

- `postgres` на внутреннем адресе `postgres:5432`
- `redis` на внутреннем адресе `redis:6379`
- `minio` с локальными портами `9000` и `9001`
- `backend` на `127.0.0.1:${BACKEND_PORT:-8000}`
- `frontend` на `127.0.0.1:${FRONTEND_PORT:-5173}`

## Локальный запуск без Docker

Подготовьте переменные:

```bash
cp .env.example .env
```

Для полностью локального backend без PostgreSQL можно поменять в `.env`:

```env
DATABASE_URL=sqlite+aiosqlite:///./memolution.db
REDIS_URL=redis://localhost:6379/0
ENABLE_REDIS=false
UPLOAD_DIR=./uploads
```

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend во втором терминале:

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`.

## Команды

Корневой `package.json` содержит удобные скрипты:

```bash
npm run dev:backend    # cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
npm run dev:frontend   # cd frontend && npm run dev
npm run seed           # cd backend && python -m app.seed
npm run test:backend   # cd backend && pytest
npm run lint:frontend  # cd frontend && npm run lint
npm run build:frontend # cd frontend && npm run build
```

Перед frontend-командами установите зависимости:

```bash
cd frontend
npm install
```

Backend-зависимости ставятся из `backend/requirements.txt`; dev-зависимости для тестов и линтинга backend — из `backend/requirements-dev.txt`.

## Переменные окружения

Backend читает `.env` из корня проекта. Основные переменные:

| Переменная | Назначение |
| --- | --- |
| `APP_URL` | Публичный адрес frontend, по умолчанию `http://localhost:5173`. |
| `API_URL` | Публичный адрес backend, по умолчанию `http://localhost:8000`. |
| `DATABASE_URL` | SQLAlchemy URL. В Docker используется PostgreSQL, локально можно SQLite. |
| `REDIS_URL` | URL Redis. |
| `ENABLE_REDIS` | Включает Redis-зависимые возможности, если поддержаны кодом. |
| `JWT_SECRET` | Секрет для JWT. В production обязательно заменить. |
| `ENABLE_DEV_AUTH` | Dev-вход без Telegram. В production выключить. |
| `DEV_SEED_ON_STARTUP` | Автоматический seed при старте backend. |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Данные admin/dev пользователя. |
| `UPLOAD_DIR` | Папка для локальных медиа. В Docker это `/app/uploads`. |
| `MAX_UPLOAD_MB` | Максимальный размер загружаемого файла. |
| `ALLOWED_MEDIA_TYPES` | MIME-типы, разрешённые для загрузки. |
| `S3_ENABLED` и `S3_*` | Настройки S3-compatible хранилища, например MinIO. |
| `CORS_ORIGINS` | Разрешённые origin для browser-запросов. |
| `RATE_LIMIT_*` | Окно и лимит простого rate limit middleware. |
| `POSTGRES_*`, `MINIO_ROOT_*` | Параметры сервисов Docker Compose. |
| `FRONTEND_PORT`, `BACKEND_PORT` | Локальные порты Docker Compose. |

Полный список смотрите в `.env.example`.

## Миграции и база

Alembic настроен в `backend/alembic.ini`.

```bash
cd backend
alembic upgrade head
```

Приложение также вызывает инициализацию схемы при старте backend. Для dev-данных используйте:

```bash
cd backend
python -m app.seed
```

Dev-вход включён через `ENABLE_DEV_AUTH=true`. В seed-данных есть пользователи вроде `memoking`, `tashkent_memes` и `admin_memolution`.

## Проверки

Backend tests:

```bash
cd backend
pytest
```

Frontend typecheck/build:

```bash
cd frontend
npm run lint
npm run build
```

## Production checklist

- Заменить `JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` и S3 secrets.
- Выключить `ENABLE_DEV_AUTH`.
- Настроить реальные `APP_URL`, `API_URL`, `CORS_ORIGINS` и HTTPS.
- Указать Telegram credentials, если нужен production Telegram auth.
- Использовать PostgreSQL, Redis и S3-compatible storage с резервными копиями.
- Настроить reverse proxy, логи, мониторинг и lifecycle policy для медиа.
