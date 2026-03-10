# StockLens — Progress Tracker

> **For Claude:** Read this file at the start of every session to know what's done and what's next.
> Update checkboxes as work completes. Never mark done unless verified working.
> Last updated: Mar 10, 2026

---

## Quick Status

```
Phase: PLANNING ✓ → IMPLEMENTATION ✓

Docs:     ████████████ 100%   All 6 CLAUDE_DOCS complete
Backend:  ███░░░░░░░░░  25%   Week 1 scaffold + auth complete
Frontend: ███░░░░░░░░░  25%   Week 1 shell + auth complete
```

**Current Week:** Week 1 complete
**Next Action:** Start Week 2 — stock data layer + cache-through FMP proxy after the remaining manual Week 1 checks (`createsuperuser`, curl auth smoke) are closed

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
- [ ] `python manage.py createsuperuser` (admin access)

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
- [ ] Manual curl test: signup → login → refresh
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
- [ ] `apps/stocks/` app created
- [ ] `Stock` model (schema.md)
- [ ] `FinancialStatement` model (JSONField)
- [ ] `KeyMetric` model (all 25+ columns for screener)
- [ ] `PriceHistory` model
- [ ] `StockCache` model (params_hash, expires_at)
- [ ] `DCFCalculation` model
- [ ] `RecentlyViewed` model
- [ ] Migrations run
- [ ] Django admin: all models registered

### Backend: FMP Service Layer
- [ ] `fmp_service.py` — `fetch_profile`, `fetch_ratios`, `fetch_key_metrics`, `fetch_income_statement`, `fetch_cash_flow_statement`, `fetch_balance_sheet_statement`, `fetch_price_history`, `fetch_search_name`
- [ ] `cache_service.py` — `get_or_fetch()` with MD5 hash, TTL, update_or_create
- [ ] `stock_service.py` — `get_profile`, `get_financials`, `get_metrics`, `get_prices`, `search`, `record_view`
- [ ] pytest: cache hit (no FMP call), cache miss (FMP mock via `responses`)

### Backend: Stock Endpoints
- [ ] `GET /api/v1/stocks/search/?q=` — DB search + FMP fallback
- [ ] `GET /api/v1/stocks/{symbol}/` — profile (7d cache) + implicit recently viewed
- [ ] `GET /api/v1/stocks/{symbol}/financials/` — 5yr income + balance + cashflow
- [ ] `GET /api/v1/stocks/{symbol}/prices/?range=1y` — EOD price history (12h cache)
- [ ] All URLs registered, manual curl tests pass
- [ ] pytest: profile 200, profile 404, search returns results

### Management Command: seed_sp500
- [ ] `apps/stocks/management/commands/seed_sp500.py` created
- [ ] Hardcoded S&P 500 ticker list sorted by market cap descending (largest first)
- [ ] `--start` (default 0) + `--count` (default 80) args for batching
- [ ] `python manage.py seed_sp500` seeds top 80 (~240 FMP calls), idempotent on re-run
- [ ] First 80 stocks seeded and visible in Django admin

### Frontend: Stock Data
- [ ] `src/api/stocks.ts` — `useStockProfile`, `useStockPrices`, `useStockSearch` hooks
- [ ] `src/pages/StockDashboard.tsx` — skeleton structure (9 sections)
- [ ] Company header component (name, ticker, price, change %)
- [ ] TradingView Lightweight Charts price chart (1Y/3Y/5Y toggle)
- [ ] Global search navbar (debounced 300ms, 10-result dropdown, keyboard nav)
- [ ] Navigate to `/stocks/AAPL` from search result

**Week 2 checkpoint:** AAPL profile loads. Price chart renders 1yr EOD data. Search finds stocks from DB. Seed running in background.

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

S&P 500 seeding takes ~6 days on FMP free tier (250 calls/day, 3 calls/stock):

| Batch | Tickers | Status |
|-------|---------|--------|
| 0-49 | AAPL, MSFT, NVDA... | ⬜ not started |
| 50-99 | ... | ⬜ not started |
| 100-149 | ... | ⬜ not started |
| 150-199 | ... | ⬜ not started |
| 200-249 | ... | ⬜ not started |
| 250-299 | ... | ⬜ not started |
| 300-349 | ... | ⬜ not started |
| 350-399 | ... | ⬜ not started |
| 400-449 | ... | ⬜ not started |
| 450-499 | ... | ⬜ not started |

Update batch status to ✅ as each completes.

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
