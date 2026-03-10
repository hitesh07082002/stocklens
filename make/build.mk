.PHONY: build build-backend build-frontend _clean

build: build-backend build-frontend

build-backend:
	cd $(BACKEND_DIR) && venv/bin/python -m compileall apps config conftest.py manage.py

build-frontend:
	$(FRONTEND_NPM) run build

_clean:
	-trash $(FRONTEND_DIR)/dist
	-trash $(BACKEND_DIR)/.pytest_cache
