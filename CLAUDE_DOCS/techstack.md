# StockLens — Technology Stack

> Status: **FINAL**
> Last updated: Mar 2026
> All decisions final. See architecture.md for patterns, research.md for data layer.

---

## Quick Reference

| Layer | Technology | Package / Version |
|-------|-----------|------------------|
| Language (BE) | Python | 3.12 |
| Language (FE) | TypeScript | 5.x |
| Backend | Django + DRF | django>=5.1, djangorestframework>=3.15 |
| Auth | SimpleJWT | djangorestframework-simplejwt>=5.3 |
| Database | PostgreSQL | 16 |
| DB Adapter | psycopg2 | psycopg2-binary>=2.9 |
| Frontend | React (Vite) | react@18, vite@5 |
| Styling | Tailwind CSS | tailwindcss@3 |
| UI Components | Shadcn/ui | (CLI install, not npm package) |
| Data Tables | TanStack Table | @tanstack/react-table@8 |
| Server State | TanStack Query | @tanstack/react-query@5 |
| Client State | Zustand | zustand@4 |
| Price Chart | TW Lightweight Charts | lightweight-charts@4 |
| Financial Charts | Recharts | recharts@2 |
| HTTP Client | Axios | axios@1 |
| Forms | React Hook Form + Zod | react-hook-form@7, zod@3 |
| Routing | React Router | react-router-dom@6 |
| AI | Claude Haiku 4.5 | anthropic>=0.40 |
| FMP HTTP calls | requests | requests>=2.31 |
| CORS | django-cors-headers | django-cors-headers>=4.3 |
| Prod DB URL | dj-database-url | dj-database-url>=2.1 |
| Static files | whitenoise | whitenoise>=6.6 |
| Env vars | python-dotenv | python-dotenv>=1.0 |
| Testing (BE) | pytest + factory_boy | pytest-django, factory_boy |
| Testing (FE) | Vitest + RTL + MSW | vitest, @testing-library/react, msw |

---

## 1. Backend

### Python 3.12
Use 3.12 (not 3.11 — 3.12 is faster and the current stable release). Create virtualenv:
```bash
python3.12 -m venv venv
source venv/bin/activate
```

### Django 5.1 + Django REST Framework 3.15
Django is the full backend — ORM, migrations, admin, management commands, auth. DRF adds the REST API layer.

**Why not FastAPI/Flask:** Django's admin panel gives us free visibility into cached data, AI summaries, and users during development. FastAPI would require building that from scratch.

**Key config in `base.py`:**
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "rest_framework",
    "corsheaders",
    "apps.stocks",
    "apps.users",
    "apps.watchlists",
    "apps.portfolio",
    "apps.screener",
    "apps.ai",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly"
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}
```

### SimpleJWT
Standard JWT for Django + SPA. No sessions, no cookies for auth.
```python
from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}
```

### PostgreSQL 16 + psycopg2-binary
`psycopg2-binary` for local dev (no compilation). Switch to `psycopg2` (compiled) in prod if performance needed — not required for V1.

### requests
All FMP API calls use `requests`. **Not** `httpx` — synchronous is fine since Django is synchronous. One FMP call at a time per request, all cached so repeat calls are free.

```python
import requests
resp = requests.get(
    "https://financialmodelingprep.com/stable/profile",
    params={"symbol": symbol, "apikey": settings.FMP_API_KEY},
    timeout=10,
)
```

Always set `timeout=10`. FMP occasionally hangs.

### anthropic SDK
Official Anthropic Python SDK for Claude Haiku calls.
```python
import anthropic
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
```
Model ID: `claude-haiku-4-5-20251001`

### whitenoise
Serves Django admin static files in prod. Add to middleware **before** everything except SecurityMiddleware:
```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # ← second
    ...
]
STATIC_ROOT = BASE_DIR / "staticfiles"
```

---

## 2. Frontend

### React 18 + Vite 5 + TypeScript 5
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Vite dev proxy (eliminates CORS in dev — don't need CORS header in dev):
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8000" }
  }
})
```

### Tailwind CSS 3
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
```typescript
// tailwind.config.ts
export default {
  darkMode: "class",   // toggle via <html class="dark">
  content: ["./src/**/*.{ts,tsx}"],
}
```

### Shadcn/ui
Not an npm package — it's a CLI that copies component source into your project. You own the code.
```bash
npx shadcn@latest init
npx shadcn@latest add button card badge skeleton dialog input select slider tabs
```
Components live in `src/components/ui/`. Edit freely — they're yours.

**Why not Ant Design:** Ant Design ships its own CSS that conflicts with Tailwind. Requires CSS overrides everywhere. Shadcn is Tailwind-native — zero conflict.

### TanStack Table v8
Used for screener, watchlist, portfolio tables. Not a drop-in `<Table>` component — it's a headless engine. You write the JSX, it manages state (sorting, pagination, filtering).

```typescript
import { useReactTable, getCoreRowModel, getSortedRowModel } from "@tanstack/react-table"
```

Pair with Shadcn's `<Table>` primitives for styling.

### TanStack Query v5
**Critical: v5 changed the API from v4.** Use v5 docs only. Key differences: `cacheTime` is now `gcTime`, `useQuery` options object changed.

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Setup in `App.tsx`:
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 }
  }
})
```

Enable devtools in dev — shows cache state, stale/fresh status per query key.

**staleTime strategy:** Match backend cache TTL. Profile = 7d staleTime, financials = 24h, prices = 12h. Prevents React from refetching when data is still fresh on the backend.

### Zustand v4
```bash
npm install zustand
```
Two stores only:
- `authStore.ts` — accessToken, user, setAuth, clearAuth. User `{id, email}` persisted in localStorage alongside refresh token; restored on page reload.
- `uiStore.ts` — theme, setTheme

**Rule:** Never put API response data in Zustand. If it comes from Django, it belongs in TanStack Query.

### TradingView Lightweight Charts v4
Open-source library from TradingView. **Not the iframe widget** — this is a standalone canvas-based chart library.
```bash
npm install lightweight-charts
```

Used only for the EOD price chart on the stock dashboard. Data comes from our FMP cached `/stable/historical-price-eod/full` endpoint — not from TradingView's data feed.

**Why not Recharts for price chart:** Recharts isn't optimized for time-series with 1250+ data points (5yr × 250 trading days). Lightweight Charts handles thousands of points efficiently via canvas.

### Recharts v2
```bash
npm install recharts
```
Used for all financial bar/line/pie charts: revenue, net income, EPS, FCF, margins, sector allocation. React-native, composable, easy to customize.

**Why not TradingView for financial charts:** Recharts is simpler for bar charts and gives better control over formatting ($3.2B labels, custom tooltips, responsive containers).

### React Router v6
```bash
npm install react-router-dom
```
Use `createBrowserRouter` (not `<BrowserRouter>`) — v6 data router API, cleaner route definitions.

### Axios v1
```bash
npm install axios
```
One shared instance in `api/client.ts` with:
1. Request interceptor — attach `Authorization: Bearer {token}`
2. Response interceptor — catch 401 → refresh token → retry once

### React Hook Form v7 + Zod v3
```bash
npm install react-hook-form zod @hookform/resolvers
```
Used for: auth forms (login, signup), add holding form, add to watchlist. DCF calculator uses controlled inputs directly (live calculation, not form submission).

---

## 3. AI

### Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
Two use cases:

| Use | Input | Output | Cost | Cached? |
|-----|-------|--------|------|---------|
| Stock summary | 5yr financials JSON | 300-word analysis | ~$0.005 | Yes — until data hash changes |
| NL search | User query string | JSON filter object | ~$0.001 | No — per query |

**Rate limits we enforce:**
- Stock summaries: 50 new generations/day max
- NL search: 10/user/hr, 5/IP/hr (unauth), 200/day system-wide

---

## 4. Testing

### Backend: pytest + pytest-django + factory_boy
```bash
pip install pytest pytest-django factory_boy responses
```

- `pytest-django` — test Django views and ORM
- `factory_boy` — generate test fixtures (StockFactory, UserFactory, etc.)
- `responses` — mock `requests` HTTP calls (mock FMP API responses)

`pytest.ini`:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.dev
python_files = tests/*.py
```

Key things to test: cache hit/miss logic, FMP service calls, DCF math, health score calculation, NL search filter validation.

### Frontend: Vitest + React Testing Library + MSW
```bash
npm install -D vitest @testing-library/react @testing-library/user-event msw
```

- `vitest` — Vite-native test runner (fast, same config as Vite)
- `@testing-library/react` — render components, fire events, assert DOM
- `msw` — intercept fetch/axios calls and return mock responses (never hit real API in tests)

Key things to test: search debounce, screener filter state, DCF calculation logic, loading/error/empty states.

---

## 5. Development Tools

### Node.js 20 LTS
```bash
# Check version
node --version   # should be 20.x
```

### Git
Standard version control. `.gitignore` must include:
```
.env
venv/
__pycache__/
*.pyc
node_modules/
dist/
staticfiles/
```

### Django Admin
Free data inspection panel at `/admin/`. No extra setup — use it to inspect cached FMP data, AI summaries, health scores, user accounts during development.

### TanStack Query Devtools
Add to `App.tsx` in dev:
```typescript
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
// inside return:
<ReactQueryDevtools initialIsOpen={false} />
```
Shows all active queries, cache state, stale/fresh status. Essential for debugging caching behaviour.

---

## 6. Full Install Commands

### Backend
```bash
pip install \
  django>=5.1 \
  djangorestframework>=3.15 \
  djangorestframework-simplejwt>=5.3 \
  django-cors-headers>=4.3 \
  psycopg2-binary>=2.9 \
  dj-database-url>=2.1 \
  whitenoise>=6.6 \
  python-dotenv>=1.0 \
  requests>=2.31 \
  anthropic>=0.40 \
  pytest \
  pytest-django \
  factory_boy \
  responses
```

### Frontend
```bash
npm install \
  react react-dom \
  react-router-dom \
  axios \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  @tanstack/react-table \
  zustand \
  lightweight-charts \
  recharts \
  react-hook-form \
  zod \
  @hookform/resolvers

npm install -D \
  typescript \
  tailwindcss postcss autoprefixer \
  vitest \
  @testing-library/react \
  @testing-library/user-event \
  msw
```

---

## 7. What We Deliberately Excluded

| Tool | Reason Excluded |
|------|----------------|
| Redis | Custom DB-backed StockCache model is sufficient for V1. Add Redis in V1.5. |
| Celery | No background jobs in V1. Cache-through handles freshness. |
| Docker | User has no local Postgres — install via Homebrew. Simpler dev loop. |
| Next.js | User decision. React + Django = clearer separation, better resume signal. |
| Redux | TanStack Query + Zustand covers all state needs with less boilerplate. |
| Ant Design | Conflicts with Tailwind. Heavy bundle. Shadcn is the right fit. |
| FMP Python SDK | We only need ~10 endpoints. SDK adds uncontrolled dependency. |
| FMP MCP | Bypasses our cache layer. AI features work on cached data only. |
| OAuth / social login | Out of scope for V1. Email + password only. |
