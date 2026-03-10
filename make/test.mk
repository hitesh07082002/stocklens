.PHONY: test test-backend test-frontend

test: test-backend test-frontend

test-backend:
	$(BACKEND_PYTEST) -c $(BACKEND_DIR)/pytest.ini $(BACKEND_DIR) --tb=short -q

test-frontend:
	$(FRONTEND_NPM) test
