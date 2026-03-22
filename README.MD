# VOP Backend + Frontend Foundation

# TEST BRANCH

Проект онлайн-платформы обучения для ВКР.

- Backend: Django + DRF в `src/backend`
- Frontend foundation: React + TypeScript + Vite в `src/frontend`

## Backend apps

- `accounts/`
- `courses/`
- `testing/`
- `reviews/`
- `progress/`

---

## ⚙️ Требования

- Python 3.10+
- Node.js 20+
- npm
- GNU Make (или альтернатива для Windows)

---

## 🚀 Backend quick start

### 1️⃣ Установка зависимостей

```bash
make install
```

### 2️⃣ Миграции

```bash
make makemigrations
make migrate
```

### 3️⃣ Запуск backend

```bash
make run
```

Backend будет доступен по адресу:

```text
http://127.0.0.1:8000
```

---

## ⚛️ Frontend quick start

Frontend расположен в `src/frontend` и построен как foundation для дальнейшей пользовательской и административной части.

### Установка frontend зависимостей

```bash
cd src/frontend
npm install
```

### Запуск frontend dev server

```bash
npm run dev
```

По умолчанию Vite использует proxy `/api` → `http://127.0.0.1:8000`.

### Сборка frontend

```bash
npm run build
```

### Настройка API URL

При необходимости можно переопределить базовый URL через переменную:

```bash
VITE_API_BASE_URL=/api
```

---

## 🧱 Что уже заложено во frontend

- базовая структура `app / pages / widgets / features / entities / shared`
- маршруты для public, private и admin зон
- auth flow на базе access/refresh token
- восстановление сессии после reload
- API layer с общим `baseURL`, auth headers и refresh flow
- страницы foundation для курсов, кабинета, обучения, тестирования и admin UI

---

## 🛠 Доступные backend команды Makefile

Посмотреть список команд:

```bash
make help
```

Создать суперпользователя:

```bash
make superuser
```

Открыть Django shell:

```bash
make shell
```

Запустить тесты:

```bash
make test
```

---

## ⚠️ Важно

- Frontend опирается на существующие backend endpoint-ы из `/api/...`
- Course lifecycle в admin UI должен использовать `status`, а не delete
- В backend включена пагинация DRF (`PAGE_SIZE = 10`), поэтому frontend учитывает paginated responses
