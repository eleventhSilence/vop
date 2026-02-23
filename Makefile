.PHONY: help install makemigrations migrate run up superuser shell test

# Пути
VENV = venv
PYTHON = $(VENV)/bin/python
MANAGE = $(PYTHON) src/backend/manage.py

# Для Windows автоматически
ifeq ($(OS),Windows_NT)
    PYTHON = $(VENV)/Scripts/python.exe
    MANAGE = $(PYTHON) src/backend/manage.py
endif

help:
	@echo "Available commands:"
	@echo "  install        - install dependencies"
	@echo "  makemigrations - create migrations"
	@echo "  migrate        - apply migrations"
	@echo "  run            - run development server"
	@echo "  up             - migrate + run"
	@echo "  superuser      - create superuser"
	@echo "  shell          - django shell"
	@echo "  test           - run tests"

install:
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
