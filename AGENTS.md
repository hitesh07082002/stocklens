# Repository Guidelines

## Project Structure & Source of Truth
This repository is still documentation-first. The only authoritative implementation guidance today is `CLAUDE.md` and the `CLAUDE_DOCS/` folder. Start with `CLAUDE_DOCS/research.md`, then follow `architecture.md`, `techstack.md`, `schema.md`, `api-spec.md`, `buildplan.md`, and `progress.md`. `GPT_DOCS/` contains earlier drafts for reference only; do not treat it as final.

Planned code layout is:
- `backend/` for Django + DRF, with apps under `backend/apps/`
- `frontend/` for React + Vite + TypeScript
- `CLAUDE_DOCS/` for final specs and build sequencing

## Build, Test, and Development Commands
No app scaffold is committed yet, so there are no live repo-wide build targets. When implementation begins, use the commands already defined in `CLAUDE_DOCS/buildplan.md`:

```bash
python3.12 -m venv venv
python manage.py runserver
npm run dev
pytest --tb=short -q
npx vitest run
```

Use these only after the `backend/` and `frontend/` scaffolds exist.

## Coding Style & Naming Conventions
Follow the conventions documented in `CLAUDE_DOCS/architecture.md`:
- Python service functions use `snake_case`.
- React components use `PascalCase.tsx`.
- Hooks use `useCamelCase.ts`.
- API helpers in `frontend/src/api/` use `camelCase`.
- Keep shared types in `types/`; avoid inline `any`.

Prefer thin Django views, business logic in service modules, and TanStack Query for server data. Do not call external APIs directly from the frontend.

## Testing Guidelines
Backend testing is planned around `pytest`, `factory_boy`, and `responses`. Frontend testing uses `vitest`, React Testing Library, and MSW. Mock FMP and Anthropic calls in tests; do not spend real API quota during UI work. Add tests alongside each feature, especially auth, cache hit/miss paths, and loading/error states.

## Commit & Pull Request Guidelines
This repo has no commit history yet, so use Conventional Commits from the start, for example: `feat: scaffold django auth` or `docs: update api spec`. PRs should describe scope, list affected docs or modules, include screenshots for UI changes, and note any spec updates required in `CLAUDE.md` or `CLAUDE_DOCS/`.
