.PHONY: test test-backend test-frontend

test: test-backend test-frontend

test-backend:
	cd $(BACKEND_DIR) && venv/bin/pytest --tb=short -q

test-frontend:
	$(FRONTEND_NPM) test
