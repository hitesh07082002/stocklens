# Repository Guidelines

## Project Structure & Source of Truth
This repository is scaffolded for Week 1. The authoritative product contract still lives in `CLAUDE.md` and `CLAUDE_DOCS/`, with `CLAUDE_DOCS/research.md` first, then `architecture.md`, `techstack.md`, `schema.md`, `api-spec.md`, `buildplan.md`, and `progress.md`.

Live code now exists in:
- `backend/` for Django + DRF, with apps under `backend/apps/`
- `frontend/` for React + Vite + TypeScript
- `.github/workflows/ci.yml` for the Week 1 verification pipeline
- `Makefile` and `make/*.mk` for repo-level dev, lint, test, and build entry points

`GPT_DOCS/` remains draft/reference material only and should not be treated as canonical implementation guidance.

## Build, Test, and Development Commands
Use the repo-level targets from the project root:

```bash
make dev-backend
make dev-frontend
make lint
make test
make build
```

Notes:
- Backend defaults to `backend/venv/` and expects PostgreSQL plus `backend/.env`
- Frontend expects `frontend/.env.local` with `VITE_API_URL=http://localhost:8000`
- CI mirrors the same canonical gates after installing backend and frontend dependencies

## Coding Style & Naming Conventions
Follow the conventions documented in `CLAUDE_DOCS/architecture.md`:
- Python service functions use `snake_case`
- React components use `PascalCase.tsx`
- Hooks use `useCamelCase.ts`
- API helpers in `frontend/src/api/` use `camelCase`
- Keep shared types in `frontend/src/types/`; avoid inline `any`

Prefer thin Django views, business logic in service modules, and TanStack Query for server data. Do not call external APIs directly from the frontend.

## Testing Guidelines
Backend Week 1 auth tests live in `backend/apps/users/tests/` and use `pytest` + `factory_boy`. Frontend tests live under `frontend/src/` and use `vitest`, React Testing Library, and MSW. Mock auth/FMP/Anthropic calls in tests; do not burn real API quota during UI work.

When auth behavior changes, cover:
- signup/login response contract
- refresh rotation
- persisted-auth bootstrap on reload
- protected-route behavior

## Commit & Pull Request Guidelines
Use Conventional Commits, for example: `fix: harden week1 auth redirects` or `docs: refresh frontend setup guide`.

PRs should describe:
- scope of the Week 1 change
- files/modules touched
- tests run (`make lint`, `make test`, `make build` where relevant)
- any spec or progress updates made in `CLAUDE.md` or `CLAUDE_DOCS/`
