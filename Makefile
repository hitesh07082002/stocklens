BACKEND_DIR := backend
FRONTEND_DIR := frontend
BACKEND_PYTHON ?= $(BACKEND_DIR)/venv/bin/python
BACKEND_PYTEST ?= $(BACKEND_DIR)/venv/bin/pytest
BACKEND_MANAGE := $(BACKEND_PYTHON) $(BACKEND_DIR)/manage.py
FRONTEND_NPM := npm --prefix $(FRONTEND_DIR)

include make/quality.mk
include make/test.mk
include make/build.mk
include make/push.mk
include make/sonar.mk

.PHONY: dev dev-backend dev-frontend up down qa qa-smoke

dev:
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals."

dev-backend:
	$(BACKEND_MANAGE) runserver 127.0.0.1:8000

dev-frontend:
	$(FRONTEND_NPM) run dev -- --host 127.0.0.1 --port 5173

up:
	@echo "No background services configured for Week 1."

down:
	@echo "No background services configured for Week 1."

qa:
	@echo "Playwright CLI is not configured in Week 1. Use the MCP browser verification flow."

qa-smoke:
	@echo "Playwright smoke tests are not configured in Week 1."
