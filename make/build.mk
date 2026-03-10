.PHONY: build build-backend build-frontend _clean

build: build-backend build-frontend

build-backend:
	$(BACKEND_PYTHON) -m compileall $(BACKEND_DIR)/apps $(BACKEND_DIR)/config $(BACKEND_DIR)/conftest.py $(BACKEND_DIR)/manage.py

build-frontend:
	$(FRONTEND_NPM) run build

_clean:
	rm -rf $(FRONTEND_DIR)/dist $(BACKEND_DIR)/.pytest_cache
