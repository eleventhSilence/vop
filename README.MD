# VOP Backend + Frontend Foundation

Проект онлайн-платформы обучения для ВКР.

- Backend: Django + Django REST Framework в `src/backend`
- Frontend: React + TypeScript + Vite в `src/frontend`

## Структура проекта

```text
.
├── Makefile              # необязательные команды-ярлыки из корня репозитория
├── requirements.txt      # Python-зависимости backend
└── src/
    ├── backend/          # Django project (`manage.py` находится здесь)
    └── frontend/         # Vite application (`package.json` находится здесь)
```

Ключевой момент developer workflow:

- backend-команды через `manage.py` запускаются из директории `src/backend`
- frontend-команды `npm` запускаются из директории `src/frontend`
- `Makefile` находится в корне репозитория и является только удобной обёрткой для backend-команд и нескольких frontend-ярлыков

## Backend apps

- `accounts/`
- `courses/`
- `testing/`
- `reviews/`
- `progress/`

## Требования

- Python 3.10+
- Node.js 20+
- npm
- GNU Make — опционально, если хотите использовать команды из `Makefile`

## Локальный workflow: backend

### 1. Установка Python-зависимостей

Из корня репозитория:

```bash
python -m venv venv
./venv/bin/pip install -r requirements.txt
```

На Windows вместо `./venv/bin/...` используйте `venv\Scripts\...`.

Альтернатива через `make` из корня репозитория:

```bash
make install
```

### 2. Миграции backend

Прямой вариант из `src/backend`:

```bash
cd src/backend
../../venv/bin/python manage.py makemigrations
../../venv/bin/python manage.py migrate
```

### Настройка backend БД: SQLite ↔ PostgreSQL

В `src/backend/vop/settings.py` настроено переключение БД через env-переменные:

- если `DB_NAME` задана, используется PostgreSQL;
- если `DB_NAME` не задана, используется fallback на SQLite (`src/backend/db.sqlite3`).

Пример безопасного шаблона находится в `src/backend/.env.example`.

Локальный запуск с PostgreSQL (пример):

```bash
cd src/backend
export DB_ENGINE=django.db.backends.postgresql
export DB_NAME=vop
export DB_USER=vop_user
export DB_PASSWORD=change_me
export DB_HOST=127.0.0.1
export DB_PORT=5432
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Альтернатива через `make` из корня репозитория:

```bash
make makemigrations
make migrate
```

### 3. Запуск backend

Рекомендуемый прямой вариант:

```bash
cd src/backend
../../venv/bin/python manage.py runserver 127.0.0.1:8000
```

Backend будет доступен по адресу `http://127.0.0.1:8000`.

Альтернатива через `make` из корня репозитория:

```bash
make run
```

### 4. Backend тесты

Подтверждённый рабочий запуск тестов:

```bash
cd src/backend
python manage.py test
```

Если используется локальное виртуальное окружение из корня репозитория, эквивалентная команда выглядит так:

```bash
cd src/backend
../../venv/bin/python manage.py test
```

Короткая альтернатива через `make` из корня репозитория:

```bash
make test
```

## Локальный workflow: frontend

### 1. Установка frontend-зависимостей

```bash
cd src/frontend
npm install
```

Или через `make` из корня репозитория:

```bash
make frontend-install
```

### 2. Запуск frontend dev server

Подтверждённый рабочий сценарий:

```bash
cd src/frontend
npm run dev
```

По умолчанию Vite использует proxy `/api` → `http://127.0.0.1:8000`.

Или через `make` из корня репозитория:

```bash
make frontend-dev
```

### 3. Frontend build

Подтверждённый рабочий сценарий:

```bash
cd src/frontend
npm run build
```

Или через `make` из корня репозитория:

```bash
make frontend-build
```

### 4. Настройка API URL

При необходимости можно переопределить базовый URL через переменную окружения:

```bash
VITE_API_BASE_URL=/api
```

### 5. Настройка изображений бренда (logo + hero)

Во frontend добавлены переменные окружения для централизованной подстановки изображений без хранения бинарников в git и без ручного копирования в `public/uploads/...`:

- `VITE_BRAND_LOGO_URL` — URL логотипа в верхней навигации
- `VITE_HERO_BACKGROUND_URL` — URL фонового изображения hero-блока на главной странице

Пример файла `src/frontend/.env` на основе шаблона `src/frontend/.env.example`:

```bash
VITE_API_BASE_URL=/api
VITE_BRAND_LOGO_URL=/branding/vop-logo.svg
VITE_HERO_BACKGROUND_URL=https://cdn.example.org/vop/hero.jpg
```

Поддерживаются: 
- относительные URL (например, `/branding/logo.svg`) для dev/stage/prod при наличии файла на том же домене;
- абсолютные URL (например, `https://cdn.example.org/...`) для CDN/S3/объектного хранилища.

Fallback-поведение:
- если `VITE_BRAND_LOGO_URL` не задан, используется локальный placeholder-логотип из исходников frontend;
- если `VITE_BRAND_LOGO_URL` задан, но внешний URL недоступен (например, hotlink/referer блокировка, 403), frontend автоматически переключает логотип на локальный asset;
- если `VITE_HERO_BACKGROUND_URL` не задан, используется локальный fallback-фон из исходников frontend;
- если `VITE_HERO_BACKGROUND_URL` задан, но внешний URL недоступен, hero автоматически переключается на локальный fallback-фон;
- если даже fallback-файл недоступен, включается нейтральный градиент без «битого» изображения.

Важно: Vite читает `.env`/`.env.local` только при старте dev/build процесса, поэтому после изменения переменных `VITE_*` нужно перезапустить `npm run dev`.

## Команды через Makefile

`Makefile` запускается из корня репозитория и не заменяет понимание рабочих директорий. Он просто фиксирует те же команды в явном виде.

Посмотреть доступные команды:

```bash
make help
```

Backend-команды:

```bash
make install
make makemigrations
make migrate
make run
make superuser
make shell
make test
```

Frontend-команды:

```bash
make frontend-install
make frontend-dev
make frontend-build
```

## Что уже заложено во frontend

- базовая структура `app / pages / widgets / features / entities / shared`
- маршруты для public, private и admin зон
- auth flow на базе access/refresh token
- восстановление сессии после reload
- API layer с общим `baseURL`, auth headers и refresh flow
- страницы foundation для курсов, кабинета, обучения, тестирования и admin UI

## Важно

- Frontend опирается на существующие backend endpoint-ы из `/api/...`
- Course lifecycle в admin UI должен использовать `status`, а не delete
- В backend включена пагинация DRF (`PAGE_SIZE = 10`), поэтому frontend учитывает paginated responses
