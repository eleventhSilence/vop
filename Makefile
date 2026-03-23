.PHONY: help install makemigrations migrate run up superuser shell test frontend-install frontend-dev frontend-build

VENV = venv
PYTHON = $(VENV)/bin/python
MANAGE = $(PYTHON) src/backend/manage.py
FRONTEND_DIR = src/frontend
NPM = npm

ifeq ($(OS),Windows_NT)
	PYTHON = $(VENV)/Scripts/python.exe
	MANAGE = $(PYTHON) src/backend/manage.py
endif

help:
	@echo "Available commands (run make from the repository root):"
	@echo "  install          - create ./venv and install backend Python dependencies"
	@echo "  makemigrations   - run Django makemigrations for backend"
	@echo "  migrate          - run Django migrate for backend"
	@echo "  run              - run backend development server on 127.0.0.1:8000"
	@echo "  up               - run backend migrations and then start backend server"
	@echo "  superuser        - create backend Django superuser"
	@echo "  shell            - open backend Django shell"
	@echo "  test             - run backend Django tests"
	@echo "  frontend-install - install frontend npm dependencies in src/frontend"
	@echo "  frontend-dev     - run frontend Vite dev server from src/frontend"
	@echo "  frontend-build   - build frontend from src/frontend"

install:
	python -m venv $(VENV)
	$(PYTHON) -m pip install -r requirements.txt

makemigrations:
	$(MANAGE) makemigrations

migrate:
	$(MANAGE) migrate

run:
	$(MANAGE) runserver 127.0.0.1:8000

up: migrate run

superuser:
	$(MANAGE) createsuperuser

shell:
	$(MANAGE) shell

test:
	$(MANAGE) test

frontend-install:
	cd $(FRONTEND_DIR) && $(NPM) install

frontend-dev:
	cd $(FRONTEND_DIR) && $(NPM) run dev

frontend-build:
	cd $(FRONTEND_DIR) && $(NPM) run build
