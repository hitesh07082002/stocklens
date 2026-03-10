# StockLens — Build Plan

> Status: **FINAL**
> Last updated: Mar 2026
> Timeline: 6 weeks (~6 hours/day solo)
> Assumes: All CLAUDE_DOCS are FINAL and read. Build starts from empty repo.

---

## Build Philosophy

- **Backend-first per feature group.** Build the Django endpoint and verify it works (curl / Django admin / pytest) before writing a single line of React.
- **Mock data for frontend dev.** Use MSW (Mock Service Worker) to mock API responses while building UI — never burn FMP API calls on UI work.
- **One endpoint = one working thing.** Don't leave endpoints half-done. Each endpoint should be: model migrated → service logic → view → serializer → URL → manually tested → done.
- **Seed early.** Run `seed_sp500` as soon as Stock and KeyMetric models exist (Week 2). The screener works with whatever is seeded (pool_size is dynamic — see architecture.md Contract G). More rows = better experience, but 80 stocks is enough to test and demo. Don't wait until Week 5.
- **No skipping testing.** Write pytest tests alongside backend work, not after. Each service function gets at least a cache hit + cache miss test.

---

## Dependency Order (Critical)

```
Django setup
  └── CustomUser + Auth endpoints
        └── SimpleJWT tokens
              └── All protected endpoints (watchlist, portfolio, DCF)

Stock + FMP cache layer
  └── Stock model + StockCache
        ├── Profile, search, prices, financials endpoints
        ├── KeyMetric model → metrics, screener
        │     └── HealthScore model → health-score endpoint
        └── FinancialStatement model → financials endpoint
              └── AISummaryCache → ai-summary endpoint

S&P 500 seed (run in Week 2)
  └── Screener endpoint works (Week 5)

React setup
  └── Axios + auth interceptors
        └── Zustand auth store
              └── Protected routes
                    └── All auth-gated pages
```

---

## Week 1 — Foundation (Backend + Frontend setup)

### Goal: Running Django server + React dev server. Auth endpoints working. Login/signup UI functional. CI pipeline green.

### Step 1: Git repo + Django project scaffold
> **Ref:** architecture.md §3.1 (project structure), §3.5 (settings split), §11 (env vars)

```bash
git init && echo "# StockLens" > README.md
# .gitignore: Python, Node, .env, __pycache__, node_modules, dist, venv
mkdir backend && cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install django>=5.1 djangorestframework>=3.15 djangorestframework-simplejwt>=5.3 \
  django-cors-headers>=4.3 psycopg2-binary>=2.9 python-dotenv>=1.0 \
  dj-database-url>=2.1 whitenoise>=6.6 requests>=2.31 anthropic>=0.40 \
  pytest pytest-django factory_boy responses
pip freeze > requirements.txt
django-admin startproject config .
mkdir -p apps config/settings
```

- `config/settings/base.py` — INSTALLED_APPS, REST_FRAMEWORK, SIMPLE_JWT, CORS config
- `config/settings/dev.py` — DEBUG=True, local PostgreSQL, CORS `localhost:5173`
- `config/settings/prod.py` — DEBUG=False, env vars, whitenoise
- `.env` — `DATABASE_URL`, `FMP_API_KEY`, `ANTHROPIC_API_KEY`, `SECRET_KEY`
- Create PostgreSQL database: `createdb stocklens_dev`
- `python manage.py migrate` (built-in tables only)
- **Verify:** `python manage.py runserver` → Django welcome page

### Step 2: CustomUser + auth endpoints
> **Ref:** schema.md §1 (CustomUser model), api-spec.md §3 (auth endpoints), architecture.md §6 (auth flow)

```bash
python manage.py startapp users apps/users
```
- `CustomUser` model + `CustomUserManager` (copy from schema.md §1)
- `AUTH_USER_MODEL = "users.CustomUser"` in base.py
- Signup serializer (validates email unique, password 8+, confirm_password match)
- Login view (SimpleJWT `TokenObtainPairView`, `USERNAME_FIELD = "email"`)
- Refresh view (SimpleJWT `TokenRefreshView`)
- `apps/users/urls.py` → `config/urls.py` (api-spec.md §9 URL config)
- `python manage.py makemigrations users && python manage.py migrate`
- **Verify:** `curl -X POST http://localhost:8000/api/v1/auth/signup/ -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234","confirm_password":"test1234"}'` → returns `{access, refresh, user}`

### Step 3: Backend tests
> **Ref:** architecture.md §13 (CI/test conventions)

- `pytest.ini` or `pyproject.toml` — configure `DJANGO_SETTINGS_MODULE`, test DB
- `conftest.py` — authenticated client fixture, user factory
- `apps/users/tests/test_auth.py`:
  - `test_signup_success` → 201 + tokens
  - `test_signup_duplicate_email` → 400
  - `test_signup_weak_password` → 400
  - `test_signup_password_mismatch` → 400
  - `test_login_success` → 200 + tokens
  - `test_login_wrong_password` → 401
  - `test_refresh_token` → 200 + new tokens
- **Verify:** `pytest --tb=short -q` → all pass

### Step 4: React project scaffold
> **Ref:** architecture.md §4.1 (tech stack), §4.2 (folder structure), §4.3 (state management)

```bash
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom axios @tanstack/react-query @tanstack/react-query-devtools \
  zustand react-hook-form zod @hookform/resolvers
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react \
  @testing-library/user-event jsdom msw
npx tailwindcss init -p
npx shadcn@latest init
npx shadcn@latest add button card badge skeleton dialog input
```

- `vite.config.ts` — proxy `/api` → `http://localhost:8000` (architecture.md §10)
- `src/api/client.ts` — Axios instance + auth interceptor + 401 refresh (architecture.md §4.4)
- `src/store/authStore.ts` — Zustand: `{accessToken, user, setAuth, clearAuth}` (architecture.md §4.3)
- `src/store/uiStore.ts` — Zustand: `{theme, setTheme}`
- `src/lib/queryClient.ts` — TanStack QueryClient config
- `App.tsx` — `QueryClientProvider` + `ReactQueryDevtools` + `RouterProvider`
- **Verify:** `npm run dev` → Vite dev server on localhost:5173

### Step 5: Auth UI + routing + dark mode
> **Ref:** architecture.md §4.5 (routing), features.md §5 (user auth), features.md §5.1 (non-functional — dark mode)

- `src/router.tsx` — all routes from features.md §2 route map + `ProtectedRoute` wrapper
- `src/api/auth.ts` — signup, login, refresh API functions
- `src/pages/LoginPage.tsx` — React Hook Form + Zod, per api-spec.md §3.2 request/response
- `src/pages/SignupPage.tsx` — per api-spec.md §3.1 request/response
- `src/components/layout/Navbar.tsx` — logo, search placeholder, auth nav, dark mode toggle
- `src/components/layout/Footer.tsx` — "Not financial advice" + "Data by FMP"
- Tailwind `darkMode: "class"` + toggle in navbar (architecture.md §4.6)
- Placeholder pages for all routes (Landing, Dashboard, Screener, Compare, Watchlist, Portfolio, DCF)
- **Verify:** signup → auto login → /watchlist works → logout → /watchlist redirects to /login

### Step 6: Frontend tests + MSW
> **Ref:** architecture.md §13 (test conventions)

- `src/mocks/handlers.ts` — MSW handlers for auth endpoints
- `src/mocks/server.ts` — MSW setup for vitest
- `vitest.config.ts` — jsdom environment, setup file
- Tests: LoginPage renders + submits, ProtectedRoute redirects unauthenticated
- **Week 1 browser QA:** use Playwright MCP from `.mcp.json` for manual visual verification only. Do **not** add `@playwright/test` yet.
- **Verify:** `npx vitest run` → all pass

### Step 7: CI pipeline
> **Ref:** architecture.md §13 (CI pipeline — copy `.github/workflows/ci.yml` from there)

- Create `.github/workflows/ci.yml` (copy from architecture.md §13)
- Push to GitHub
- **Verify:** GitHub Actions shows green checkmark on both `backend` and `frontend` jobs

### Week 1 Done When:
- `POST /auth/signup/` and `POST /auth/login/` return tokens
- Login page sets Zustand auth state
- Protected route redirects to `/login`
- Refresh token auto-retries 401
- Dark mode toggles and persists
- `pytest` passes all backend tests
- `vitest` passes all frontend tests
- GitHub Actions CI is green

---

## Week 2 — Stock Data Layer

### Goal: `GET /stocks/{symbol}/` returns profile. Price chart renders. Search works. S&P 500 seeded.

### Backend (Days 1-3)

**apps/stocks — models:**
> **Ref:** schema.md §2 (all stocks app models — Stock, FinancialStatement, KeyMetric, PriceHistory, StockCache, DCFCalculation, RecentlyViewed)

- `Stock`, `FinancialStatement`, `KeyMetric`, `PriceHistory`, `StockCache` (schema.md Section 2)
- `DCFCalculation`, `RecentlyViewed` models (schema.md Section 2)
- `python manage.py makemigrations stocks && python manage.py migrate`

**apps/stocks — services:**
> **Ref:** architecture.md §3.3 (service layer pattern), §5 (cache architecture + pseudocode), §7 (request lifecycle example)

- `fmp_service.py`:
  ```python
  def fetch(endpoint: str, params: dict) -> dict:
      resp = requests.get(f"https://financialmodelingprep.com/stable/{endpoint}",
                          params={**params, "apikey": settings.FMP_API_KEY}, timeout=10)
      resp.raise_for_status()
      return resp.json()
  ```
  Functions: `fetch_profile`, `fetch_quote`, `fetch_ratios`, `fetch_key_metrics`, `fetch_income_statement`, `fetch_cash_flow`, `fetch_balance_sheet`, `fetch_price_history`, `fetch_dividends`, `fetch_financial_growth`, `fetch_search_name`

- `cache_service.py`:
  ```python
  def get_or_fetch(symbol, endpoint, params, ttl_hours, fetch_fn):
      params_hash = StockCache.make_params_hash(params)
      cache = StockCache.objects.filter(symbol=symbol, endpoint=endpoint,
                                        params_hash=params_hash, expires_at__gt=now()).first()
      if cache:
          return cache.response_data
      data = fetch_fn()
      StockCache.objects.update_or_create(
          symbol=symbol, endpoint=endpoint, params_hash=params_hash,
          defaults={"params": params, "response_data": data,
                    "expires_at": now() + timedelta(hours=ttl_hours)}
      )
      return data
  ```

- `stock_service.py` — orchestrates: cache hit → return, miss → FMP → normalize → store in domain tables → return
  - `get_profile(symbol)` → calls FMP `profile` (identity, 7d TTL) + `quote` (price/change, 12h TTL), stores in `Stock`
  - `get_financials(symbol)` → calls FMP `income-statement` + `cash-flow-statement` + `balance-sheet-statement`, stores in `FinancialStatement`, caches 24h
  - `get_metrics(symbol)` → calls FMP `ratios` + `key-metrics` + `financial-growth`, stores in `KeyMetric` (sets `is_latest=True` on most recent fiscal year row only), triggers health score recomputation, caches 24h
  - `get_prices(symbol, range)` → calls FMP `historical-price-eod/full`, stores in `PriceHistory`, caches 12h
  - `search(query)` → DB first, FMP fallback, caches 30d
  - `record_view(user, stock)` → upserts `RecentlyViewed`, trims to 10

**apps/stocks — views + serializers + URLs:**
> **Ref:** api-spec.md §2.1 (search), §2.2 (profile), §2.3 (financials), §2.5 (prices), §9 (URL config); architecture.md §3.4 (URL structure)

- `StockProfileView` → merges FMP `/stable/profile` (identity) + `/stable/quote` (price, change, change%). If quote returns 402, fallback to profile price fields (architecture.md Contract D). Serializer maps `Stock` fields to api-spec.md shape.
- `StockSearchView` → DB search + FMP fallback
- `StockPricesView` → self-sufficient: calls `stock_service.get_prices()` which fetches from FMP via cache-through on cache miss. Filter `PriceHistory` by date range (1y/3y/5y). Never returns empty for a valid symbol.
- `StockFinancialsView` → self-sufficient: calls `stock_service.get_financials()` which fetches from FMP via cache-through on cache miss. Serialize 5yr `FinancialStatement` rows. Never returns empty arrays for a valid symbol.
- Register `apps/stocks/` in `config/urls.py`

**Management command — seed_sp500:**
> **Ref:** architecture.md §16 (FMP call budget — 250/day, logging), research.md §4.2 (S&P 500 seeding strategy)
```bash
python manage.py startapp screener apps/screener  # placeholder app
```
- `apps/stocks/management/commands/seed_sp500.py`
- Load hardcoded S&P 500 ticker list (Python list in the command, sorted by market cap descending — largest first)
- For each ticker in range `[start, start+count)`: call `stock_service.get_profile` + `stock_service.get_metrics` (3 FMP calls/stock)
- Mark `Stock.is_sp500 = True`

**CLI interface:**
```
python manage.py seed_sp500 [--start N] [--count N]
  --start   Index into the sorted ticker list to begin at (default: 0)
  --count   Number of tickers to seed in this run (default: 80)
```
- Omitting both args seeds the top 80 stocks by market cap (indices 0–79), using ~240 FMP calls
- Subsequent batches: `--start 80 --count 80`, `--start 160 --count 80`, etc.
- The command prints progress: `[42/80] Seeded MSFT (3 FMP calls)` and a final summary: `Seeded 80 stocks, 240 FMP calls used`
- Idempotent: re-running with the same range skips already-cached stocks (0 FMP calls for cache hits)
- **Start this seeding process immediately in Week 2, even if it runs in the background all week.**

**pytest at end of Week 2:**
> **Ref:** architecture.md §13 (test conventions — pytest + factory_boy + responses)

- `test_cache_hit` — second call doesn't hit FMP
- `test_cache_miss` — first call hits FMP (`responses` mock)
- `test_profile_view_200` — stock exists
- `test_profile_view_404` — stock doesn't exist

### Frontend (Days 4-5)
> **Ref:** architecture.md §4.2 (folder structure), §4.3 (TanStack Query hook pattern + staleTime), §1 (TradingView Lightweight Charts for price); features.md §1A-B (company header + price chart), §4 (stock search behavior + debounce)

- `src/api/stocks.ts` — all TanStack Query hooks: `useStockProfile`, `useStockPrices`, `useStockSearch`
- `src/pages/StockDashboard.tsx` — skeleton loading structure (5 sections)
- Company header component (name, ticker, price, change)
- TradingView Lightweight Charts price chart component (1Y/3Y/5Y toggle)
- Global search navbar component (debounced 300ms, dropdown results)
- MSW handlers for stock profile + prices

**Week 2 Done When:** `GET /api/v1/stocks/AAPL/` returns profile JSON. Price chart renders with 1Y of EOD data. Search finds AAPL from local DB. Seed command is running in background.

**Playwright trigger point:** At the end of Week 2 or start of Week 3, once one seeded-symbol dashboard flow is stable (auth → search → `/stocks/AAPL/` → chart render), add a **small** `@playwright/test` smoke suite. First E2E tests: signup/login/logout, protected-route redirect + post-login return, seeded stock dashboard load.

---

## Week 3 — Dashboard Complete

### Goal: Full stock dashboard working end-to-end for any seeded stock. All 9 dashboard sections rendering with real data.

### Backend (Days 1-3)

**apps/stocks — remaining endpoints:**
> **Ref:** api-spec.md §2.4 (key metrics response shape + trends), §2.8 (dividend data response); features.md §14 (trend indicator calculation), §15 (dividend analysis + payout health labels)

- `StockMetricsView` — self-sufficient endpoint: calls `stock_service.get_metrics()` which fetches from FMP via cache-through on cache miss. Serialize `KeyMetric` latest row + compute trends from prior year row. Never returns null for a valid symbol.
- `StockDividendsView` — derive dividend data from `KeyMetric` (dividend_yield, dividend_payout_ratio) + `/stable/dividends` history (cached in StockCache) for annual dividend/share and YoY dividend growth. Requires 1 FMP call (dividends) on cache miss.

**apps/ai:**
```bash
python manage.py startapp ai apps/ai
```
> **Ref:** schema.md §5 (AISummaryCache + HealthScore models); architecture.md §9 (AI summary architecture — hash-based regen); features.md §12 (health score methodology — 5 categories, 13 metrics, 100 points), §11 (AI summary system prompt + rate limits)

- `AISummaryCache`, `HealthScore` models (schema.md Section 5)
- `python manage.py makemigrations ai && python manage.py migrate`
- `health_score.py` — pure Python function `compute_health_score(key_metric, financial_statements) -> dict`
  - 5 category scores per features.md Feature 12 methodology
  - Returns `{"score": 78, "breakdown": {"profitability": 25, ...}}`
  - Called from `stock_service.get_metrics()` after saving `KeyMetric`
- `ai_service.py`:
  ```python
  client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

  def get_or_generate_summary(symbol, financial_data: dict) -> dict:
      """Returns dict with summary_text, status, generated_at."""
      data_hash = hashlib.md5(json.dumps(financial_data, sort_keys=True).encode()).hexdigest()
      cached = AISummaryCache.objects.filter(stock_id=symbol, financial_data_hash=data_hash).first()
      if cached:
          return {"summary_text": cached.summary_text, "status": "cached", "generated_at": cached.generated_at}
      # Check daily generation limit (50/day, UTC calendar day)
      today_count = AISummaryCache.objects.filter(generated_at__date=timezone.now().date()).count()
      stale = AISummaryCache.objects.filter(stock_id=symbol).first()
      if today_count >= 50:
          if stale:
              return {"summary_text": stale.summary_text, "status": "stale", "generated_at": stale.generated_at}
          return {"summary_text": None, "status": "rate_limited"}
      # Generate synchronously (no workers in V1)
      message = client.messages.create(
          model="claude-haiku-4-5-20251001",
          max_tokens=500,
          system="[system prompt from features.md Feature 11]",
          messages=[{"role": "user", "content": json.dumps(financial_data)}]
      )
      summary = message.content[0].text
      AISummaryCache.objects.update_or_create(
          stock_id=symbol,
          defaults={"summary_text": summary, "financial_data_hash": data_hash, "model_used": "claude-haiku-4-5-20251001"}
      )
      return {"summary_text": summary, "status": "fresh", "generated_at": timezone.now()}
  ```
- `StockHealthScoreView` — read from `HealthScore` table; if missing or stale, synchronously ensure fresh KeyMetric + FinancialStatement data and recompute before responding (self-sufficient, no workers)
- `StockAISummaryView` — call `ai_service.get_or_generate_summary()`
- Register `apps/ai/` URLs
> **Ref:** api-spec.md §2.6 (health score response shape), §2.7 (AI summary response shape + status codes); architecture.md §16 (health score recomputation trigger, KeyMetric is_latest flag management)

**pytest:**
> **Ref:** architecture.md §13 (test conventions)

- `test_health_score_all_good` — perfect stock scores 100
- `test_health_score_missing_metric` — handles null fields gracefully
- `test_ai_summary_cache_hit` — second call doesn't call Claude
- `test_ai_summary_hash_change` — regenerates when data hash changes

### Frontend (Days 4-5)
> **Ref:** features.md §2 (financial chart requirements — 5 charts, data mapping), §3 (key metrics panel), §12 (health score display — gauge, breakdown, color labels), §11 (AI summary display — markdown, disclaimer, labels), §14 (trend indicator ↑/↓/→ calculation + edge cases), §15 (dividend analysis — payout health, hidden if no dividend); architecture.md §1 (Recharts for financial charts), §4.3 (TanStack Query hooks)

- `useStockMetrics`, `useStockHealthScore`, `useStockAISummary`, `useStockDividends` hooks
- Financial charts component (Recharts): Revenue, Net Income, EPS, FCF (bar), Margins (multi-line)
- YoY trend indicators: ↑/↓/→ arrows with % (reusable `<TrendBadge>` component)
- Key metrics panel: 9 metric cards with trend arrows
- Health score gauge (circular or bar, color-coded)
- Health score breakdown (expandable)
- AI summary section (markdown render, "last updated", label)
- Dividend analysis section (hidden if `pays_dividend: false`)

**Week 3 Done When:** Full AAPL dashboard renders with all 9 sections. Health score shows 0-100. AI summary generates and caches. All charts show 5yr data. YoY arrows correct.

---

## Week 4 — User Features (Watchlist + Portfolio + DCF)

### Goal: Logged-in users can maintain watchlists, track a portfolio, and save DCF calculations.

### Backend (Days 1-3)

**apps/watchlists:**
> **Ref:** schema.md §3 (Watchlist + WatchlistItem models); api-spec.md §4 (all watchlist endpoints — CRUD + presets + stocks); features.md §6 (watchlist spec — limits, table columns, pre-built lists)

```bash
python manage.py startapp watchlists apps/watchlists
```
- `Watchlist`, `WatchlistItem` models (schema.md Section 3)
- `python manage.py makemigrations watchlists && python manage.py migrate`
- All CRUD endpoints per api-spec.md Section 4
- `WatchlistListCreateView` — validates max 5 per user
- `WatchlistDetailView` (PATCH/DELETE) — validates not preset
- `WatchlistStocksView` (POST/DELETE) — validates max 50, no duplicates
- `WatchlistPresetsView` — returns preset lists (public)
- Seed command:
  ```bash
  python manage.py seed_watchlists
  ```
  Creates 3 preset Watchlist rows + WatchlistItems for FAANG+, Dividend Aristocrats, S&P Top 10.

**apps/portfolio:**
> **Ref:** schema.md §4 (PortfolioHolding model); api-spec.md §5 (portfolio endpoints — holdings CRUD + summary); features.md §9 (portfolio tracker — gain/loss calc, sector allocation, limits)

```bash
python manage.py startapp portfolio apps/portfolio
```
- `PortfolioHolding` model (schema.md Section 4)
- `python manage.py makemigrations portfolio && python manage.py migrate`
- `portfolio_service.py` — `compute_gain_loss(holding, current_price)`, `compute_summary(holdings)`, `compute_sector_allocation(holdings)`
- All portfolio endpoints per api-spec.md Section 5
- `PortfolioSummaryView` — aggregates all holdings, joins with `Stock.sector` for pie chart data

**apps/stocks — DCF + RecentlyViewed:**
> **Ref:** api-spec.md §6 (DCF endpoints — GET/POST/DELETE), §7 (recently viewed — implicit tracking via profile view), §10 (implementation notes — DCF client-side math, recently viewed upsert); schema.md §2 (DCFCalculation + RecentlyViewed models); features.md §7 (DCF calculator — EPS/FCF modes, formulas, default values, edge cases), §16 (recently viewed — last 10, dedup)

- `DCFListCreateView`, `DCFDeleteView` (from dcf_urls.py)
- `RecentlyViewedView` (get list)
- Hook up implicit recently viewed in `StockProfileView`

**pytest:**
> **Ref:** architecture.md §13 (test conventions); schema.md constraints table (max 5 watchlists, max 50 stocks, max 50 holdings, max 10 DCFs)

- `test_watchlist_max_5` — 6th watchlist returns 400
- `test_watchlist_preset_immutable` — can't rename/delete preset
- `test_portfolio_gain_loss_math` — (185.50 - 155.00) × 10.5 = 320.25
- `test_portfolio_duplicate_holding` — returns 400
- `test_dcf_max_10` — 11th save returns 400

### Frontend (Days 4-5)
> **Ref:** features.md §6 (watchlist table columns, pre-built lists, add-to-watchlist UI), §9 (portfolio holdings table, summary section, sector pie chart), §7 (DCF calculator UI — sliders, live calc, save, projection table), §16 (recently viewed sidebar); architecture.md §1 (TanStack Table for data tables, Recharts for pie chart)

- `src/pages/WatchlistPage.tsx` — sidebar list of watchlists, TanStack Table with all columns (price, market cap, P/E, health score)
- "Add to Watchlist" dropdown on stock dashboard (shows user's lists)
- `src/pages/PortfolioPage.tsx` — TanStack Table (holdings), summary bar (total value, gain/loss %), sector pie chart (Recharts)
- Add/Edit holding form (React Hook Form + Zod)
- DCF calculator component (sliders + live client-side calculation, save button)
- `src/pages/DCFPage.tsx` — full-page version of DCF calculator
- Recently viewed sidebar (only for auth users)

**Week 4 Done When:** User can create watchlist, add stocks, view table with live prices. Portfolio shows holdings with gain/loss and sector allocation pie. DCF calculates and saves.

---

## Week 5 — Screener + NL Search + Comparison

### Goal: S&P 500 screener fully functional. NL search parses queries. Comparison page works.

### Backend (Days 1-3)

**Check seed status:** By Week 5, ~100-200 stocks should be seeded (seed started Week 2). Enough for screener to work — continue seeding in background.

**apps/screener:**
> **Ref:** api-spec.md §2.9 (screener — all 13 filter params, sort values, response shape), §2.10 (NL screener — request/response, rate limits, error cases); architecture.md §8 (screener architecture — ORM pattern, NL search flow); api-spec.md §10 (implementation notes — is_latest filter, health_score subquery sort)

- `ScreenerView` — ORM filter on `KeyMetric` with `is_latest=True` (all 13 filter params from api-spec.md Section 2.9)
- Pagination: 25/page (DRF `PageNumberPagination`)
- Sorting: direct field sort for most; subquery annotation for `health_score`
- `NLScreenerView`:
  - Validate query (5-200 chars), check rate limits
  - Call `nl_search.py → parse_nl_query(query)` which calls Claude Haiku
  - Validate returned JSON (field allowlist + operator allowlist)
  - Map validated JSON → ORM filters → reuse screener ORM logic
  - Return up to 100 results + `truncated` flag

> **Ref:** features.md §13 (NL search — full system prompt with decimal fraction convention, validation steps, edge cases, rate limits)

- `nl_search.py`:
  ```python
  def parse_nl_query(query: str) -> dict:
      message = client.messages.create(
          model="claude-haiku-4-5-20251001",
          max_tokens=256,
          system="[system prompt from features.md Feature 13]",
          messages=[{"role": "user", "content": query}]
      )
      raw = message.content[0].text
      parsed = json.loads(raw)  # may throw — handle gracefully
      return validate_filters(parsed["filters"])  # raises on invalid field/op
  ```

**apps/stocks — comparison:**
> **Ref:** api-spec.md §2.11 (comparison — response shape, best_per_metric, 207 partial success); features.md §8 (stock comparison — table layout, side-by-side charts, edge cases)

- `CompareView` — accepts `?symbols=AAPL,MSFT,GOOG`, validates 2-3 unique symbols
- Fetches profile (identity + current price) + metrics + financial statement history (revenue, net income, EPS for comparison charts) for each, computes `best_per_metric`
- Partial success (207) if one symbol invalid
- Register `compare_urls.py`

**pytest:**
> **Ref:** architecture.md §13 (test conventions)

- `test_screener_pe_filter` — filters correctly
- `test_screener_sort_health_score` — subquery works
- `test_nl_screener_valid_query` — Haiku mock returns valid JSON, ORM runs
- `test_nl_screener_invalid_field` — LLM returns unknown field → validation rejects it
- `test_compare_partial_success` — one bad symbol returns 207

### Frontend (Days 4-5)
> **Ref:** features.md §10 (screener — 10 filters, results table columns, pagination), §13 (NL search UI — text input, interpreted chips, fallback message), §8 (comparison — table layout, side-by-side charts, URL sync); architecture.md §1 (TanStack Table for screener, Recharts for comparison charts)

- `src/pages/ScreenerPage.tsx`:
  - Manual filter panel (10 filters: dropdowns, range inputs, toggle)
  - NL search input at top (large text input, submit → POST screener/nl/)
  - Interpreted-as chips ("Sector: Technology", "P/E < 20")
  - TanStack Table (11 columns, sortable, 25/page pagination)
  - Active filter chips above results with clear-all
  - "X results out of {pool_size} stocks" count (pool_size = current seeded count)
- `src/pages/ComparePage.tsx`:
  - 2-3 stock search inputs (add up to 3)
  - URL sync (`?symbols=AAPL,MSFT`)
  - Comparison table (rows = metrics, cols = stocks, best-in-class highlighted)
  - Side-by-side revenue, net income, EPS charts (Recharts, multi-color)

**Week 5 Done When:** Screener filters seeded S&P 500 stocks (100-500 depending on seeding progress) and returns paginated results. NL query "tech stocks with P/E under 20" returns correct filtered results with interpreted chips. Compare shows 3 stocks side by side.

---

## Week 6 — Polish + Landing + Quality Baseline

### Goal: Production-quality. All error/loading/empty states. Landing page. Tests passing. Deploy-ready.

### Backend (Days 1-2)
> **Ref:** features.md §13 (NL rate limits — 10/user/hr, 5/IP/hr, 200/day), §11 (AI summary rate limit — 50/day); architecture.md §12 (security table — rate limiting, CORS, NL injection prevention)

- Rate limiting for NL screener — **DB counter approach (no new dependency):**
  - Per-user/hr: `NLSearchLog.objects.filter(user=user, created_at__gte=one_hour_ago).count() >= 10`
  - Per-IP/hr: `NLSearchLog.objects.filter(ip_address=ip, created_at__gte=one_hour_ago).count() >= 5`
  - System daily: `NLSearchLog.objects.filter(created_at__date=timezone.now().date()).count() >= 200`
  - Model: `NLSearchLog(user, ip_address, query, created_at)` in `screener/models.py`
- AI summary daily generation limit (50/day) — `AISummaryCache.objects.filter(generated_at__date=timezone.now().date()).count()`
- Django admin registrations for all models (for dev data inspection)
- `python manage.py collectstatic` — whitenoise serves admin assets
- `requirements.txt` — pin all versions

**pytest coverage pass:**
- Cover all views, all services, all edge cases from features.md
- Run: `pytest --tb=short -q`

### Frontend (Days 3-4)
> **Ref:** features.md §5.1 (non-functional requirements — dark mode, responsive breakpoints, loading/error/empty states, legal/attribution, meta/SEO); architecture.md §4.5 (routing — all routes), §4.6 (dark mode implementation)

**Skeleton loading states:**
- Every section of `StockDashboard` has a skeleton (Shadcn `<Skeleton>`)
- Screener table: 10 skeleton rows while loading
- Watchlist + portfolio tables: skeleton rows

**Error states:**
- Axios error → `<ErrorBanner>` component per section ("Unable to load data. Retry →")
- 404 stock → full-page "Stock '{symbol}' not found. Try searching."
- Rate limited → "Too many requests. Wait a moment."

**Empty states:**
- Empty watchlist: "Your watchlist is empty. Search for a stock to add."
- Empty portfolio: "No holdings yet. Add your first stock."
- Screener no results: "No stocks match these filters. Try broadening your criteria."

**Landing page (`/`):**
- Hero: StockLens tagline + search bar
- "Explore popular stocks" section using FAANG+ preset watchlist data
- Feature highlights (3-4 cards: Screener, Portfolio, DCF, AI Insights)
- "Not financial advice" footer + "Data by Financial Modeling Prep"

**Dark mode + responsive:**
- Verify all pages work at 375px (mobile), 768px (tablet), 1024px+ (desktop)
- Charts resize properly
- Tables scroll horizontally on mobile
- Hamburger nav on mobile

**Meta + SEO:**
- `<title>` per route: "AAPL — Apple Inc. | StockLens"
- OG tags (generic image for V1)
- Favicon

**Vitest pass:**
- Search debounce test
- Screener filter state test
- DCF client-side math test (all formula branches)
- Loading/error/empty state renders

### Days 5: Deploy
> **Ref:** architecture.md §15 (deployment — free tier stack, demo-ready upgrade, deployment checklist)

**Deploy to: Vercel (frontend) + Render (backend) + Neon (database). See architecture.md Section 15.**

```bash
# Database: Create Neon project → copy DATABASE_URL

# Backend: Push to Render (free web service)
python manage.py collectstatic
# Set env vars in Render: DATABASE_URL (Neon), FMP_API_KEY, ANTHROPIC_API_KEY, SECRET_KEY, ALLOWED_HOSTS (comma-separated), FRONTEND_URL
# Run post-deploy: python manage.py migrate && python manage.py seed_sp500

# Frontend: Push to Vercel
npm run build
# Set VITE_API_URL in Vercel to Render backend URL

# Keep-alive: Set up UptimeRobot (free) to ping /api/v1/stocks/search/?q=AAPL every 5 min
```

**Week 6 Done When:** V1 success criteria met (see CLAUDE.md). All 8 user journeys work end-to-end. No raw errors shown to users. Deployed and publicly accessible.

---

## Feature → Week Mapping

| Feature | Week |
|---------|------|
| 5. User Auth | 1 |
| 4. Stock Search | 2 |
| 1. Stock Dashboard (partial) | 2-3 |
| 2. Financial Charts | 3 |
| 3. Key Metrics Panel | 3 |
| 12. Financial Health Score | 3 |
| 11. AI Stock Summary | 3 |
| 14. Trend Indicators | 3 |
| 15. Dividend Analysis | 3 |
| 16. Recently Viewed | 4 |
| 6. Watchlist | 4 |
| 9. Portfolio Tracker | 4 |
| 7. DCF Calculator | 4 |
| 10. Basic Screener | 5 |
| 13. Natural Language Search | 5 |
| 8. Stock Comparison | 5 |
| Quality Baseline | 6 |

---

## Management Commands Summary

| Command | When | Purpose |
|---------|------|---------|
| `python manage.py seed_sp500` | Week 2 Day 3 (run daily) | Seed S&P 500 stocks (default: top 80; use `--start N --count N` for subsequent batches) |
| `python manage.py seed_watchlists` | Week 4 Day 1 | Create preset FAANG+, Dividend, S&P Top 10 |
| `python manage.py createsuperuser` | Week 1 Day 2 | Django admin access |
| `python manage.py collectstatic` | Week 6 | Whitenoise admin assets |

---

## What NOT to Build (V1 Hard Boundary)

Per CLAUDE.md — do not build these even if they seem easy:

| Not building | Why |
|-------------|-----|
| Email verification | V1.5 |
| Password reset | V1.5 |
| Real-time prices | EOD only (FMP free tier) |
| Earnings calendar | Requires Finnhub |
| Portfolio performance chart | Complex time-weighted math |
| Background refresh | No Celery/Redis |
| Notifications / price alerts | No Celery |
| OAuth / social login | V2 |
| Revenue by segment | FMP paid tier |
| Advanced screener (40+ filters) | V2 |
