# StockLens — Progress Tracker

> **For Claude:** Read this file at the start of every session to know what's done and what's next.
> Update checkboxes as work completes. Never mark done unless verified working.
> Last updated: Mar 10, 2026

---

## Quick Status

```text
Phase: PLANNING ✓ → IMPLEMENTATION ✓

Docs:     ████████████ 100%   All 6 CLAUDE_DOCS complete
Backend:  ██████░░░░░░  50%   Week 2 stock data layer re-verified after targeted fixes
Frontend: ██████░░░░░░  50%   Week 2 stock header/search/chart re-verified after targeted coverage updates
```

**Current Week:** Week 2 stabilized
**Next Action:** Review and merge the Week 2 PR from the re-verified bounded top-80 screener pool, then continue to Week 3.

---

## Phase 1: Documentation

- [x] `research.md` — FINAL (FMP endpoints verified, caching design, data model)
- [x] `features.md` — FINAL (16 features, endpoints verified Mar 2026)
- [x] `architecture.md` — FINAL (folder structure, service layer, URL config)
- [x] `techstack.md` — FINAL (exact packages + versions, install commands)
- [x] `schema.md` — FINAL (Django model code, 13 tables, 4 apps, 4 bugs fixed)
- [x] `api-spec.md` — FINAL (30 endpoints, full JSON shapes, 7 bugs fixed across 2 reviews)
- [x] `buildplan.md` — FINAL (6-week plan, feature-to-week mapping)
- [x] `progress.md` — this file

---

## Phase 2: Week 1 — Foundation

### Backend Setup
- [x] Django project created (`django-admin startproject config .`)
- [x] Virtual environment + pip install all backend packages
- [x] Settings split: `config/settings/base.py`, `dev.py`, `prod.py`
- [x] `.env` file created with `DATABASE_URL`, `FMP_API_KEY`, `ANTHROPIC_API_KEY`, `SECRET_KEY`
- [x] PostgreSQL database created (`createdb stocklens_dev`)
- [x] `python manage.py migrate` (built-in tables)
- [x] `python manage.py createsuperuser` (admin access)
- [x] pytest: Django admin pages load for users admin (index, changelist, add, change)

### Auth (apps/users)
- [x] `apps/users/` app created
- [x] `CustomUser` model (email-based, schema.md Section 1)
- [x] `CustomUserManager` with `create_user`, `create_superuser`
- [x] `AUTH_USER_MODEL = "users.CustomUser"` in `base.py`
- [x] `python manage.py makemigrations users && python manage.py migrate`
- [x] Signup serializer (email unique, password 8+, confirm_password match)
- [x] `POST /api/v1/auth/signup/` — returns `{access, refresh, user}`
- [x] `POST /api/v1/auth/login/` — returns `{access, refresh, user}`
- [x] `POST /api/v1/auth/refresh/` — rotates refresh token
- [x] URLs registered in `config/urls.py`
- [x] Manual curl test: signup → login → refresh
- [x] pytest: signup validation (duplicate, weak, mismatch)
- [x] Django admin: CustomUser visible at `/admin/`

### Frontend Setup
- [x] Vite React TypeScript project created (`npm create vite@latest`)
- [x] All npm packages installed (TanStack Query, Zustand, Axios, RHF, Zod, Shadcn)
- [x] Tailwind configured (`tailwind.config.ts`, `darkMode: "class"`)
- [x] Shadcn init + components installed (button, card, badge, skeleton, dialog, input)
- [x] Vite proxy configured (`/api` → `http://localhost:8000`)
- [x] `src/api/client.ts` — Axios instance with auth header + 401 refresh interceptor
- [x] `src/store/authStore.ts` — Zustand: accessToken, user, setAuth, clearAuth
- [x] `src/store/uiStore.ts` — Zustand: theme, setTheme
- [x] `App.tsx` — QueryClientProvider + ReactQueryDevtools + BrowserRouter
- [x] `src/router.tsx` — createBrowserRouter + PrivateRoute wrapper
- [x] `src/pages/LoginPage.tsx` — RHF + Zod, calls `POST /auth/login/`
- [x] `src/pages/SignupPage.tsx` — same pattern
- [x] Dark mode toggle in navbar
- [x] MSW setup (`src/mocks/`, auth handlers)

**Week 1 checkpoint:** Login page signs in, stores JWT in Zustand, protected route works.

---

## Phase 3: Week 2 — Stock Data Layer

### Backend: Stock Models
- [x] `apps/stocks/` app created
- [x] `Stock` model (schema.md)
- [x] `FinancialStatement` model (JSONField)
- [x] `KeyMetric` model (all 25+ columns for screener)
- [x] `PriceHistory` model
- [x] `StockCache` model (params_hash, expires_at)
- [x] `DCFCalculation` model
- [x] `RecentlyViewed` model
- [x] Migrations run
- [x] Django admin: all models registered
- [x] pytest: Django admin pages load for stocks admin (changelists, add pages, change pages)

### Backend: FMP Service Layer
- [x] `fmp_service.py` — `fetch_profile`, `fetch_ratios`, `fetch_key_metrics`, `fetch_income_statement`, `fetch_cash_flow_statement`, `fetch_balance_sheet_statement`, `fetch_price_history`, `fetch_search_name`
- [x] `cache_service.py` — `get_or_fetch()` with MD5 hash, TTL, update_or_create
- [x] `stock_service.py` — `get_profile`, `get_financials`, `get_metrics`, `get_prices`, `search`, `record_view`
- [x] pytest: cache hit (no FMP call), cache miss (FMP mock via `responses`)

### Backend: Stock Endpoints
- [x] `GET /api/v1/stocks/search/?q=` — DB search + FMP fallback
- [x] `GET /api/v1/stocks/{symbol}/` — profile (7d cache) + implicit recently viewed
- [x] `GET /api/v1/stocks/{symbol}/financials/` — 5yr income + balance + cashflow
- [x] `GET /api/v1/stocks/{symbol}/prices/?range=1y` — EOD price history (12h cache)
- [x] All URLs registered, bounded live `AAPL` view-level verification passes
- [x] pytest: profile 200, profile 404, search returns results

### Management Command: seed_sp500
- [x] `apps/stocks/management/commands/seed_sp500.py` created
- [x] Bundled ordered top-80 ticker list sorted by market cap descending (largest first)
- [x] `--start` (default 0) + `--count` (default 80) args for batching
- [x] `python manage.py seed_sp500` seeds the bundled top 80 slice (~240 FMP calls), idempotent on re-run
- [ ] First 80 stocks seeded and visible in Django admin
  Note: bounded live verification succeeded with `python manage.py seed_sp500 --count 1` (`AAPL`, 2 FMP calls after cache warm-up), and the full implemented top-80 path was run safely in `25/25/25/5` batches. Result on this free-tier key: 28 screener-ready stocks seeded, 142 cache rows, many higher-cap symbols skipped because `/stable/ratios` or `/stable/key-metrics` returned premium-only `402` responses. The repository now treats that ordered top-80 list as the explicit Week 2 contract; reruns are idempotent and failed refetches no longer unset existing `is_sp500=True` flags.

### Frontend: Stock Data
- [x] `src/api/stocks.ts` — `useStockProfile`, `useStockPrices`, `useStockSearch` hooks
- [x] `frontend/src/pages/DashboardPage.tsx` — skeleton structure (9 sections)
- [x] Company header component (name, ticker, price, change %)
- [x] TradingView Lightweight Charts price chart (1Y/3Y/5Y toggle)
- [x] Global search navbar (debounced 300ms, 10-result dropdown, keyboard nav)
- [x] Navigate to `/stocks/AAPL` from search result
- [x] Vitest coverage for Week 2 frontend flows (search autocomplete, company header, price chart, dashboard states)

**Week 2 checkpoint:** `AAPL` profile/prices/financials all return `200` with live FMP data. One-year chart data returns 252 rows. Search finds stocks from DB. The full implemented top-80 seed path was executed safely in `25/25/25/5` batches and produced a current screener pool of 28 seeded symbols on this free-tier FMP key. Dashboard error handling now distinguishes unknown-symbol `404` from upstream `502`, and warm-cache reads preserve domain freshness timestamps.
Manual Playwright MCP QA on Mar 10, 2026:
- Pass: protected-route redirect, signup/login, navbar search → `/stocks/AAPL`, live chart render with 1Y/3Y/5Y toggles, protected shells, public placeholders, and Django admin stock/user pages all rendered successfully.
- Follow-up RCA + fix on Mar 10, 2026: hard browser navigation while already authenticated had been reproducing a double refresh on the dev build (`POST /api/v1/auth/refresh/` => `200`, then `401`) because bootstrap refresh work was duplicated during dev `StrictMode` mount behavior. `useAuthBootstrap()` now deduplicates concurrent refresh work for the same stored refresh token, targeted vitest coverage was added, and live MCP re-verification now shows a single `POST /api/v1/auth/refresh/` => `200` with the user kept signed in after hard navigation.
- Non-blocking admin browser console item: missing `/favicon.ico` returns `404`.

### Manual QA Checklist To Reuse In Week 3
- `/` renders navbar, footer, dark-mode toggle, and public landing shell.
- Logged-out `/watchlist` redirects to `/login?next=%2Fwatchlist`.
- Signup creates a user and lands on `/` with logged-in navbar state.
- Login restores access to `/watchlist`.
- Hard browser navigation while authenticated keeps the session and should emit one successful refresh request only.
- Navbar search for `AAPL` returns a result and navigates to `/stocks/AAPL`.
- `/stocks/AAPL` renders company header plus live price history.
- `1Y`, `3Y`, and `5Y` chart toggles each trigger a successful prices request.
- `/screener` and `/compare` render documented placeholder shells only.
- Logged-in `/portfolio` and `/dcf/AAPL` render protected placeholder shells.
- `/admin/`, `/admin/stocks/stock/`, `/admin/stocks/stock/AAPL/change/`, `/admin/users/customuser/`, and one custom-user change page render without admin form/template errors.

---

## Phase 4: Week 3 — Dashboard Complete

### Backend: Metrics + Health Score + AI
- [ ] `apps/stocks — StockMetricsView` (KeyMetric serializer + trends computation)
- [ ] `apps/stocks — StockDividendsView` (derives from KeyMetric + history)
- [ ] `apps/ai/` app created
- [ ] `AISummaryCache` + `HealthScore` models, migrated
- [ ] `health_score.py` — `compute_health_score()` — 5 categories, 13 metrics, 0-100
- [ ] Health score computed and stored when `get_metrics()` saves KeyMetric
- [ ] `ai_service.py` — `get_or_generate_summary()` with hash check + daily limit (50/day), synchronous (no workers)
- [ ] `GET /api/v1/stocks/{symbol}/metrics/` — metrics + all trends
- [ ] `GET /api/v1/stocks/{symbol}/health-score/` — reads from HealthScore table
- [ ] `GET /api/v1/stocks/{symbol}/ai-summary/` — cache hit or generate
- [ ] `GET /api/v1/stocks/{symbol}/dividends/` — dividend data
- [ ] pytest: health score correct math, AI cache hit, AI hash regen

### Frontend: Dashboard Sections
- [ ] `useStockMetrics`, `useStockHealthScore`, `useStockAISummary`, `useStockDividends` hooks
- [ ] Financial charts (Recharts): Revenue, Net Income, EPS, FCF bar charts
- [ ] Margins multi-line chart (gross, operating, net on same chart)
- [ ] `<TrendBadge>` reusable component (↑ green / ↓ red / → gray)
- [ ] Key metrics panel (9 metric cards with trend badges)
- [ ] Health score gauge (color-coded: green/yellow/orange/red)
- [ ] Health score breakdown (expandable "View Breakdown")
- [ ] AI summary section (rendered text, "last updated", "not financial advice" label)
- [ ] Dividend analysis section (hidden if `pays_dividend: false`)
- [ ] Skeleton loading for every section independently
- [ ] MSW handlers for all dashboard endpoints

**Week 3 checkpoint:** Full AAPL dashboard renders all 9 sections with real data. Health score shows. AI summary generates. Charts all working.

---

## Phase 5: Week 4 — User Features

### Backend: Watchlists
- [ ] `apps/watchlists/` app created
- [ ] `Watchlist` + `WatchlistItem` models, migrated
- [ ] `GET /api/v1/watchlists/` — user's custom lists with stocks
- [ ] `POST /api/v1/watchlists/` — create (max 5 enforced)
- [ ] `PATCH /api/v1/watchlists/{id}/` — rename (not preset)
- [ ] `DELETE /api/v1/watchlists/{id}/` — delete (not preset)
- [ ] `POST /api/v1/watchlists/{id}/stocks/` — add stock (max 50, no dup)
- [ ] `DELETE /api/v1/watchlists/{id}/stocks/{symbol}/` — remove
- [ ] `GET /api/v1/watchlists/presets/` — public preset lists
- [ ] `python manage.py seed_watchlists` — creates FAANG+, Dividend Aristocrats, S&P Top 10
- [ ] pytest: max 5, preset immutable, max 50 stocks

### Backend: Portfolio
- [ ] `apps/portfolio/` app created
- [ ] `PortfolioHolding` model, migrated
- [ ] `portfolio_service.py` — `compute_gain_loss`, `compute_summary`, `compute_sector_allocation`
- [ ] `GET /api/v1/portfolio/` — holdings with computed gain/loss
- [ ] `POST /api/v1/portfolio/` — add holding (max 50, no dup symbol)
- [ ] `PATCH /api/v1/portfolio/{id}/` — edit holding
- [ ] `DELETE /api/v1/portfolio/{id}/` — remove holding
- [ ] `GET /api/v1/portfolio/summary/` — total value, gain/loss, sector allocation
- [ ] pytest: gain/loss math correct, duplicate holding rejected

### Backend: DCF + Recently Viewed
- [ ] `GET /api/v1/dcf/{symbol}/` — list saved DCFs (empty list if none)
- [ ] `POST /api/v1/dcf/{symbol}/` — save (max 10 per user per stock)
- [ ] `DELETE /api/v1/dcf/{id}/` — delete saved DCF
- [ ] `GET /api/v1/recently-viewed/` — last 10 viewed
- [ ] dcf_urls.py: `<int:pk>` before `<str:symbol>` (URL ordering bug prevented)

### Frontend: User Pages
- [ ] `src/pages/WatchlistPage.tsx` — sidebar tabs, TanStack Table (all columns)
- [ ] "Add to Watchlist" dropdown on stock dashboard
- [ ] `src/pages/PortfolioPage.tsx` — holdings TanStack Table, summary bar, sector pie chart
- [ ] Add holding form (RHF + Zod validation)
- [ ] Edit/delete holding with confirm dialog
- [ ] DCF calculator component (sliders, live calc, save button, "not financial advice")
- [ ] `src/pages/DCFPage.tsx` — full-page DCF
- [ ] Recently viewed sidebar (auth users only)
- [ ] Empty states for watchlist and portfolio

**Week 4 checkpoint:** User can create watchlists, add stocks, track portfolio with gain/loss, save DCF calculations.

---

## Phase 6: Week 5 — Screener + NL + Compare

### Backend: Screener
- [ ] `apps/screener/` app created
- [ ] `ScreenerView` — all 10 filters, pagination (25/page), sort with health_score subquery
- [ ] `NLScreenerView` — rate limit check → Haiku → validate JSON → ORM → return with `interpreted_as`
- [ ] `nl_search.py` — `parse_nl_query()` with field/operator allowlist validation
- [ ] Rate limiting: 10/user/hr, 5/IP/hr, 200/day system-wide
- [ ] pytest: each filter works, NL valid query, NL invalid field rejected, rate limit returns 429
- [ ] Verify screener works with seeded S&P 500 data (check count in Django admin)

### Backend: Comparison
- [ ] `CompareView` — 2-3 symbols, best_per_metric, 207 partial success
- [ ] `compare_urls.py` registered

### Frontend: Screener + Compare
- [ ] `src/pages/ScreenerPage.tsx`:
  - NL search input at top (large, submit + Enter)
  - Interpreted-as chips (after NL search)
  - 10-filter manual panel (sector dropdown, range inputs, toggle)
  - Active filter chips above results, clear-all button
  - TanStack Table (11 columns, sortable, paginated)
  - "X results out of {pool_size} stocks" count line (pool_size = current seeded count)
  - "Not what you meant? Try manual filters" link (after NL)
- [ ] `src/pages/ComparePage.tsx`:
  - 2-3 stock search inputs
  - URL sync (`?symbols=AAPL,MSFT`)
  - Comparison table (metrics as rows, stocks as cols, best highlighted bold/green)
  - Side-by-side revenue/net income/EPS charts

**Week 5 checkpoint:** Screener filters seeded S&P 500 stocks (100-500 depending on seeding progress). NL query returns results with interpreted chips. Compare shows 3 stocks side by side with best values highlighted.

---

## Phase 7: Week 6 — Polish + Deploy

### Polish
- [ ] Dark mode working on all pages (every component verified)
- [ ] Responsive at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- [ ] Skeleton loading: every data section has a skeleton
- [ ] Error states: `<ErrorBanner>` per section, retry button
- [ ] Empty states: watchlist, portfolio, screener no-results, recently viewed hidden
- [ ] "Not financial advice" footer on every page
- [ ] "Data by Financial Modeling Prep" attribution in footer
- [ ] `<title>` per route (AAPL → "AAPL — Apple Inc. | StockLens")
- [ ] OG tags (generic image)
- [ ] Favicon

### Landing Page
- [ ] `src/pages/LandingPage.tsx` — hero, search bar, popular stocks, feature cards
- [ ] "Explore popular stocks" section using presets data
- [ ] CTA to sign up

### Testing
- [ ] pytest suite runs clean (`pytest --tb=short -q`)
- [ ] Vitest suite runs clean (`npm run test`)
- [ ] Key pytest coverage: cache, health score, auth, screener filters, NL validation
- [ ] Key vitest coverage: search debounce, DCF math, screener filter state, loading/error/empty

### Deploy
- [ ] `requirements.txt` pinned
- [ ] `python manage.py collectstatic` — whitenoise works
- [ ] All env vars set in production (DATABASE_URL, FMP_API_KEY, ANTHROPIC_API_KEY, etc.)
- [ ] Backend deployed (Render)
- [ ] `npm run build` — no build errors
- [ ] Frontend deployed to Vercel with correct `VITE_API_URL`
- [ ] Production smoke test: search AAPL → dashboard loads → login → add to watchlist

---

## V1 Success Criteria (from CLAUDE.md)

A user can:
- [ ] Search any US stock by ticker or name
- [ ] View a dashboard with charts, metrics, trend arrows, health score, dividend analysis, AI summary
- [ ] Run a DCF valuation with auto-filled data and save it
- [ ] Save stocks to watchlists (with pre-built lists on first login)
- [ ] Track a portfolio with holdings, gain/loss, and sector allocation
- [ ] Screen S&P 500 stocks using manual filters or natural language
- [ ] Compare 2-3 stocks side by side
- [ ] All above works on mobile, in dark mode, with proper loading/error/empty states

---

## Seed Progress (Track Separately)

The bundled Week 2 ordered list currently contains 80 market-cap-sorted symbols.

Live free-tier verification on Mar 10, 2026 produced 28 screener-ready symbols from that bundled list.

Reruns are idempotent, and failed refetches now preserve existing `is_sp500=True` flags.

---

## Notes for Future Sessions

- **FMP API key:** in `.env` as `FMP_API_KEY` (never commit)
- **FMP endpoints:** `/stable/` only. `/api/v3/` is dead. See research.md Section 3.2.
- **TanStack Query:** v5 API (not v4). `gcTime` not `cacheTime`. Use v5 docs only.
- **StockCache params_hash:** MD5 of `json.dumps(params, sort_keys=True)`. JSONField can't be in unique_together.
- **AISummaryCache.generated_at:** `auto_now=True` (not `auto_now_add`) so it updates on regen.
- **DCF math:** client-side only. Server stores the result. Never recompute on server.
- **Watchlist presets:** `user=null`, `is_preset=True`. No user FK needed.
- **URL ordering:** In `dcf_urls.py`, `<int:pk>` must come before `<str:symbol>`. In `watchlists/urls.py`, `presets/` must come before `<int:pk>/`.
