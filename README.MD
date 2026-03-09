# VOP Backend (Django + DRF)

# TEST BRANCH

Backend-часть проекта на Django.  
Проект расположен в папке `src/backend`, виртуальное окружение — в корне (`venv`).

### Описание модулей

- `accounts/` — приложение для работы с аккаунтами (модели, views, urls, тесты).
- `dto/` — слой сериализации (DTO, serializers).
- `vop/` — конфигурация Django-проекта (settings, маршрутизация, ASGI/WSGI).
- `manage.py` — точка входа для управления проектом.

---

## ⚙️ Требования

- Python 3.10+
- pip
- GNU Make (или альтернатива для Windows)

---

## 🚀 Быстрый старт

### 1️⃣ Установка зависимостей

```bash
make install
```

Команда:
- создаёт виртуальное окружение `venv`
- устанавливает зависимости из `requirements.txt`

---

### 2️⃣ Миграции

Создать миграции:

```bash
make makemigrations
```

Применить миграции:

```bash
make migrate
```

---

### 3️⃣ Запуск сервера разработки

```bash
make run
```

Сервер будет доступен по адресу:

```
http://127.0.0.1:8000
```

---

### 4️⃣ Миграции + запуск одной командой

```bash
make up
```

---

## 🛠 Доступные команды Makefile

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

## 🪟 Windows: если не работает make

На Windows команда `make` может быть недоступна.

### Варианты решения:

- Установить Git Bash + make
- Использовать WSL (рекомендуется)
- Запускать команды вручную:

```bash
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt

venv\Scripts\python.exe src\backend\manage.py makemigrations
venv\Scripts\python.exe src\backend\manage.py migrate
venv\Scripts\python.exe src\backend\manage.py runserver 127.0.0.1:8000
```

---

## ⚠️ Важно

Makefile ожидает следующую структуру:

- виртуальное окружение в папке `venv`
- `manage.py` по пути `src/backend/manage.py`

Если структура меняется — необходимо обновить переменные `VENV`, `PYTHON`, `MANAGE` в `Makefile`.