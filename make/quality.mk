.PHONY: lint lint-backend lint-frontend

lint: lint-backend lint-frontend

lint-backend:
	$(BACKEND_MANAGE) check

lint-frontend:
	$(FRONTEND_NPM) run lint
	$(FRONTEND_NPM) run typecheck
