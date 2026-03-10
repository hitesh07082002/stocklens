.PHONY: lint lint-backend lint-frontend

lint: lint-backend lint-frontend

lint-backend:
	cd $(BACKEND_DIR) && venv/bin/python manage.py check

lint-frontend:
	$(FRONTEND_NPM) run typecheck
