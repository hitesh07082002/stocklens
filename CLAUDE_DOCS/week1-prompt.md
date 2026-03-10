# Week 1 Prompt — StockLens Foundation

> Paste this into a new Claude Code session to start building.

---

## Prompt

```
Build Week 1 of StockLens — a Qualtrim-inspired stock research platform (React + Django + PostgreSQL).

**READ FIRST:** Before writing any code, read these docs in order:
1. `CLAUDE_DOCS/research.md` — data source decisions, FMP API, caching strategy
2. `CLAUDE_DOCS/schema.md` — all 13 Django models (paste-ready code)
3. `CLAUDE_DOCS/architecture.md` — full architecture with code snippets
4. `CLAUDE_DOCS/api-spec.md` — every API endpoint spec with request/response examples
5. `CLAUDE_DOCS/buildplan.md` — the build plan you're executing (Week 1 section)
6. `CLAUDE.md` — project rules and constraints

**WHAT TO BUILD (Week 1 — 7 steps):**

1. **Git repo + Django scaffold** — init repo, create `backend/` with Django project, split settings (base/dev/prod), create PostgreSQL DB `stocklens_dev`, verify `runserver` works.

2. **CustomUser + auth endpoints** — `apps/users/` with email-based `CustomUser` model (schema.md §1). Three endpoints: `POST /api/v1/auth/signup/`, `POST /api/v1/auth/login/`, `POST /api/v1/auth/refresh/` (api-spec.md §3). SimpleJWT with 60min access / 7day refresh / rotate=True. Signup returns {access, refresh, user}. URL config per api-spec.md §9.

3. **Backend tests** — pytest + factory_boy. Tests: signup success (201), duplicate email (400), weak password (400), password mismatch (400), login success (200), wrong password (401), token refresh (200). Use `conftest.py` with auth fixtures.

4. **React scaffold** — `frontend/` with Vite + TypeScript + React. Install: react-router-dom, axios, @tanstack/react-query, zustand, react-hook-form, zod, tailwindcss, shadcn/ui. Vite proxy `/api` → `localhost:8000`.

5. **Auth UI + routing + dark mode** — Login/Signup pages with React Hook Form + Zod validation. Zustand auth store (access token in memory). Axios interceptor (attach Bearer token, auto-refresh on 401). ProtectedRoute component. All routes from features.md §2 (placeholder pages). Dark mode toggle (Tailwind `darkMode: "class"`, persist in localStorage). Navbar with search placeholder + auth nav + dark mode toggle. Footer with "Not financial advice" + "Data by FMP". **After building UI, use the Playwright MCP tools (available via `.mcp.json`) to open `localhost:5173` in a browser, take screenshots, and visually verify the pages look correct before moving on.**

6. **Frontend tests** — vitest + React Testing Library + MSW. Mock auth endpoints. Test: login renders + submits, ProtectedRoute redirects.

7. **CI pipeline** — `.github/workflows/ci.yml` with PostgreSQL service container. Backend job: pytest. Frontend job: vitest + build check.

**KEY ARCHITECTURE DECISIONS (don't deviate):**
- `AUTH_USER_MODEL = "users.CustomUser"` — must be set BEFORE first migration
- Settings split: `config/settings/base.py`, `dev.py`, `prod.py`
- DJANGO_SETTINGS_MODULE = `config.settings.dev`
- Apps live in `backend/apps/` directory
- Frontend state: TanStack Query for server data, Zustand ONLY for auth token + user + theme
- Access token in Zustand (memory), refresh token + user `{id, email}` in localStorage
- On page reload: restore user from localStorage immediately, then silently refresh access token. Refresh returns `{access, refresh}` only (no user).
- No API keys in frontend — only `VITE_API_URL`

**ENV VARS (backend .env):**
SECRET_KEY, DEBUG=True, DATABASE_URL=postgresql://localhost:5432/stocklens_dev, FMP_API_KEY, ANTHROPIC_API_KEY, ALLOWED_HOSTS=localhost,127.0.0.1, FRONTEND_URL=http://localhost:5173

**ENV VARS (frontend .env.local):**
VITE_API_URL=http://localhost:8000

**DONE WHEN:**
- `POST /auth/signup/` and `POST /auth/login/` return JWT tokens
- Login page sets Zustand auth state
- Protected route (`/watchlist`) redirects to `/login` when not authenticated
- Refresh token auto-retries on 401
- Dark mode toggles and persists
- `pytest` passes all backend tests
- `vitest` passes all frontend tests
- GitHub Actions CI config exists and is valid

**HARD RULES:**
- No Next.js — React + Django
- Follow the exact model code from schema.md
- Follow the exact API spec from api-spec.md
- Follow the exact folder structure from architecture.md
- Don't build anything from Week 2+ yet
- Use mock/fixture data — never burn FMP API calls
```

---

## Notes

- The prompt references specific doc sections. The new session has access to all files via `CLAUDE_DOCS/`.
- Week 1 has no FMP API calls — it's pure scaffold + auth + UI shell.
- The `CLAUDE.md` file at project root has all project-wide rules the session needs.
- **Playwright MCP** is configured in `.mcp.json` (project root). It auto-loads in new sessions. Use it to visually verify all frontend pages — navigate to `localhost:5173`, screenshot, inspect layout/dark mode/responsive. Browser opens visibly so the user can watch.
