# StockLens — System Architecture

> Status: **FINAL**
> Last updated: Mar 2026
> Assumes: research.md (FINAL) + features.md (FINAL) already read.
> This doc covers: resolved decisions, folder structures, Django app breakdown, frontend component tree, state management, auth flow, local dev setup. Do NOT re-derive decisions documented in research.md.

---

## 1. Resolved Decisions

These were open questions in CLAUDE.md — now closed.

| Decision | Choice | Reason |
|----------|--------|--------|
| **UI Components** | **Shadcn/ui** | Tailwind-native (we use Tailwind). Ant Design fights Tailwind, adds heavy bundle, needs CSS overrides. Shadcn ships only what you use. |
| **Data Tables** | **TanStack Table v8** | Shadcn has no built-in table. TanStack Table is more powerful than Ant Design's table — sortable, filterable, paginated, works with our data. Used for screener, watchlist, portfolio. |
| **Charts** | **TradingView Lightweight Charts** (price) + **Recharts** (financial) | Already resolved in CLAUDE.md. Both use our FMP cached EOD data. No iframes. |
| **State Management** | **TanStack Query v5** (server state) + **Zustand** (client state) | TanStack Query handles all API data — caching, loading, error, refetch. Zustand handles auth tokens + theme. Never store server data in Zustand. |
| **Local Dev DB** | **Homebrew PostgreSQL** (`brew install postgresql@16`) | No Docker needed. Simpler dev loop. |
| **Docker Compose** | **None in V1** | User has no local Postgres — install via Homebrew. Skip Docker overhead for solo dev. |
| **Deployment** | **Render + Neon + Vercel** | Render (free/Starter) + Neon (free PostgreSQL) + Vercel ($0 frontend). Code is deployment-agnostic — switch by changing env vars only. |

---

## 2. System Overview

```
┌─────────────────────────────────────────┐
│  React SPA (Vite + TypeScript)          │
│  Shadcn/ui · Tailwind · TanStack Query  │
│  Zustand · Recharts · TW Lightweight    │
└────────────────┬────────────────────────┘
                 │ REST JSON (HTTPS)
                 ▼
┌─────────────────────────────────────────┐
│  Django REST Framework                  │
│  Apps: stocks · users · watchlists      │
│         portfolio · screener · ai       │
│  Service layer → cache-through proxy    │
└──────┬──────────────┬───────────────────┘
       │ ORM          │ HTTP (server-side only)
       ▼              ▼
┌─────────────┐  ┌──────────┐  ┌──────────────┐
│ PostgreSQL  │  │ FMP API  │  │ Claude Haiku │
│             │  │ (cached) │  │ (cached)     │
│ Domain tbls │  └──────────┘  └──────────────┘
│ Cache tbls  │
│ User tbls   │
└─────────────┘
```

**Core principle:** React never calls FMP or Claude directly. Django is the proxy, cache, and AI orchestration layer.

---

## 3. Backend Architecture

### 3.1 Project Structure

```
backend/
├── config/                         # Django project (not an app)
│   ├── settings/
│   │   ├── base.py                 # Shared settings
│   │   ├── dev.py                  # DEBUG=True, local DB, CORS localhost
│   │   └── prod.py                 # DEBUG=False, env vars, allowed hosts
│   ├── urls.py                     # Root URL config
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── stocks/                     # FMP proxy + domain data
│   │   ├── models.py               # Stock, FinancialStatement, KeyMetric, PriceHistory, StockCache
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py                  # /stocks/ routes (profile, financials, metrics, etc.)
│   │   ├── dcf_urls.py              # /dcf/ routes (GET/POST by symbol, DELETE by id)
│   │   ├── compare_urls.py          # /compare/ routes
│   │   ├── recently_viewed_urls.py  # /recently-viewed/ routes
│   │   ├── services/
│   │   │   ├── fmp_service.py      # All raw FMP HTTP calls
│   │   │   ├── cache_service.py    # Cache hit/miss/store logic
│   │   │   └── stock_service.py    # Orchestrates: cache → FMP → normalize → store
│   │   └── management/
│   │       └── commands/
│   │           ├── seed_sp500.py   # Bulk screener seed (3 calls/stock)
│   │           └── seed_watchlists.py  # Pre-built FAANG / Dividend / S&P Top 10
│   ├── users/                      # Auth only
│   │   ├── models.py               # CustomUser (email-based)
│   │   ├── views.py                # signup, login, token refresh
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── watchlists/
│   │   ├── models.py               # Watchlist, WatchlistItem
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── portfolio/
│   │   ├── models.py               # PortfolioHolding
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── services/
│   │       └── portfolio_service.py  # gain/loss calc, sector allocation
│   ├── screener/
│   │   ├── views.py                # filter endpoint + NL search endpoint
│   │   ├── serializers.py
│   │   └── urls.py
│   └── ai/
│       ├── models.py               # AISummaryCache, HealthScore
│       ├── views.py
│       ├── serializers.py
│       ├── urls.py
│       └── services/
│           ├── ai_service.py       # Claude API calls
│           ├── health_score.py     # Score calculation (pure Python, no AI)
│           └── nl_search.py        # NL query → JSON filters → ORM
├── requirements.txt
├── manage.py
└── .env
```

### 3.2 Django Apps — Responsibilities

| App | Models | Key Services | Notes |
|-----|--------|-------------|-------|
| `stocks` | Stock, FinancialStatement, KeyMetric, PriceHistory, StockCache | fmp_service, cache_service, stock_service | Core of the backend. All FMP traffic goes through here. |
| `users` | CustomUser | — | SimpleJWT handles token generation. Views: signup + login only. |
| `watchlists` | Watchlist, WatchlistItem | — | CRUD. Reads from `stocks` for price/metrics display. |
| `portfolio` | PortfolioHolding | portfolio_service | Gain/loss + sector allocation computed here. No transaction history. |
| `screener` | NLSearchLog | — | Pure ORM filtering on KeyMetric. NLSearchLog tracks NL query rate limits (DB counter, no django-ratelimit). NL search calls `ai.nl_search`. |
| `ai` | AISummaryCache, HealthScore | ai_service, health_score, nl_search | Claude calls only. Health score is pure Python — no AI. |

### 3.3 Service Layer Pattern

Views are thin. All business logic lives in services.

```
views.py (HTTP in/out)
    └── calls stock_service.py
            └── calls cache_service.py
                    └── HIT: return cached data
                    └── MISS: calls fmp_service.py
                                └── HTTP → FMP API
                            → stores in StockCache
                            → normalizes → updates domain tables
                            → returns data
```

**Rule:** Views never call `fmp_service` directly. Always go through `stock_service` → `cache_service` → `fmp_service`.

### 3.4 URL Structure

All routes prefixed `/api/v1/`. Root `config/urls.py` includes each app's `urls.py`.

```python
# config/urls.py
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/stocks/",     include("apps.stocks.urls")),
    path("api/v1/auth/",       include("apps.users.urls")),
    path("api/v1/watchlists/", include("apps.watchlists.urls")),
    path("api/v1/portfolio/",  include("apps.portfolio.urls")),
    path("api/v1/screener/",   include("apps.screener.urls")),
    path("api/v1/dcf/",        include("apps.stocks.dcf_urls")),
    path("api/v1/compare/",      include("apps.stocks.compare_urls")),
    path("api/v1/recently-viewed/", include("apps.stocks.recently_viewed_urls")),
]
```

### 3.5 Settings Split

```python
# config/settings/base.py
INSTALLED_APPS = [...]
DATABASES = {...}           # overridden in dev/prod
TIME_ZONE = "UTC"           # all daily limits reset at UTC midnight
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticatedOrReadOnly"],
}
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# config/settings/dev.py
from .base import *
DEBUG = True
DATABASES = {"default": {"ENGINE": "django.db.backends.postgresql", "NAME": "stocklens_dev", ...}}
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
DJANGO_SETTINGS_MODULE = "config.settings.dev"

# config/settings/prod.py
from .base import *
DEBUG = False
ALLOWED_HOSTS = os.environ["ALLOWED_HOSTS"].split(",")
DATABASES = {"default": dj_database_url.config(env="DATABASE_URL")}
CORS_ALLOWED_ORIGINS = [os.environ["FRONTEND_URL"]]
```

### 3.6 Key Dependencies

```
django>=5.1
djangorestframework
djangorestframework-simplejwt
django-cors-headers
dj-database-url          # parse DATABASE_URL env var (prod)
psycopg2-binary          # PostgreSQL adapter
whitenoise               # serve Django admin static files
requests                 # FMP HTTP calls
anthropic                # Claude API
python-dotenv
```

---

## 4. Frontend Architecture

### 4.1 Tech Stack (Final)

| Layer | Library | Version |
|-------|---------|---------|
| Bundler | Vite | 5.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | Shadcn/ui | latest |
| Data Tables | TanStack Table | v8 |
| Server State | TanStack Query | v5 |
| Client State | Zustand | 4.x |
| Routing | React Router | v6 |
| Price Chart | TradingView Lightweight Charts | 4.x |
| Financial Charts | Recharts | 2.x |
| HTTP Client | Axios | 1.x |
| Form Validation | React Hook Form + Zod | — |

### 4.2 Folder Structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # QueryClientProvider + Router + ThemeProvider
│   ├── router.tsx                  # All route definitions
│   │
│   ├── pages/                      # One file per route
│   │   ├── Landing.tsx             # /
│   │   ├── Dashboard.tsx           # /stocks/:symbol
│   │   ├── Screener.tsx            # /screener
│   │   ├── Compare.tsx             # /compare
│   │   ├── Watchlist.tsx           # /watchlist (auth)
│   │   ├── Portfolio.tsx           # /portfolio (auth)
│   │   ├── DCF.tsx                 # /dcf/:symbol (auth)
│   │   ├── Login.tsx               # /login
│   │   └── Signup.tsx              # /signup
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # Search bar + auth nav + dark mode toggle
│   │   │   ├── Footer.tsx          # "Not financial advice" + FMP attribution
│   │   │   └── ProtectedRoute.tsx  # Redirect to /login if not authenticated
│   │   │
│   │   ├── stock/                  # All dashboard sections
│   │   │   ├── CompanyHeader.tsx   # Name, ticker, price, change, market cap
│   │   │   ├── PriceChart.tsx      # TradingView Lightweight Charts (1Y/3Y/5Y toggle)
│   │   │   ├── FinancialCharts.tsx # Recharts bar/line (revenue, NI, EPS, FCF, margins)
│   │   │   ├── KeyMetricsPanel.tsx # P/E, ROE, debt/equity etc — grid of cards
│   │   │   ├── TrendIndicator.tsx  # ↑/↓ arrow with YoY % (used everywhere)
│   │   │   ├── HealthScore.tsx     # Gauge + expandable breakdown
│   │   │   ├── AISummary.tsx       # AI text + generated_at + disclaimer
│   │   │   ├── DividendAnalysis.tsx# Yield, payout, growth (hidden if no dividend)
│   │   │   └── DCFEmbed.tsx        # Compact DCF on dashboard
│   │   │
│   │   ├── screener/
│   │   │   ├── FilterPanel.tsx     # 10 filter inputs (sector, PE, ROE, etc.)
│   │   │   ├── NLSearch.tsx        # Natural language input + interpreted chips
│   │   │   └── ScreenerTable.tsx   # TanStack Table — sortable, paginated
│   │   │
│   │   ├── portfolio/
│   │   │   ├── HoldingsTable.tsx   # TanStack Table — holdings + gain/loss
│   │   │   ├── SectorPieChart.tsx  # Recharts pie (sector allocation)
│   │   │   └── PortfolioSummary.tsx# Total value, total gain/loss
│   │   │
│   │   ├── watchlist/
│   │   │   ├── WatchlistTabs.tsx   # Tab per watchlist
│   │   │   └── WatchlistTable.tsx  # TanStack Table — stocks + key metrics
│   │   │
│   │   ├── dcf/
│   │   │   ├── DCFInputs.tsx       # Sliders/inputs for growth rate, discount rate, etc.
│   │   │   ├── DCFResult.tsx       # Intrinsic value, price, margin of safety
│   │   │   └── DCFProjectionTable.tsx # Year-by-year projected values
│   │   │
│   │   ├── compare/
│   │   │   └── ComparisonTable.tsx # Side-by-side metrics (best value highlighted)
│   │   │
│   │   └── ui/                     # Shadcn/ui generated components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── badge.tsx
│   │       ├── skeleton.tsx        # Loading skeletons
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── slider.tsx
│   │       └── tabs.tsx
│   │
│   ├── hooks/                      # TanStack Query hooks (one per API resource)
│   │   ├── useStock.ts             # profile + quote
│   │   ├── useFinancials.ts        # income, cashflow, balance sheet
│   │   ├── useMetrics.ts           # key metrics + ratios
│   │   ├── usePrices.ts            # EOD price history
│   │   ├── useHealthScore.ts
│   │   ├── useAISummary.ts
│   │   ├── useDividends.ts
│   │   ├── useWatchlist.ts
│   │   ├── usePortfolio.ts
│   │   ├── useScreener.ts
│   │   └── useSearch.ts
│   │
│   ├── api/                        # Axios call functions (called by hooks)
│   │   ├── client.ts               # Axios instance + request interceptor (auth header)
│   │   │                           # + response interceptor (401 → refresh → retry)
│   │   ├── stocks.ts
│   │   ├── auth.ts
│   │   ├── watchlists.ts
│   │   ├── portfolio.ts
│   │   ├── screener.ts
│   │   └── dcf.ts
│   │
│   ├── store/                      # Zustand (client state only)
│   │   ├── authStore.ts            # { user, accessToken, setAuth, clearAuth } — user persisted in localStorage
│   │   └── uiStore.ts              # { theme, setTheme } (dark/light)
│   │
│   ├── types/                      # TypeScript interfaces
│   │   ├── stock.ts                # Stock, FinancialStatement, KeyMetric, Quote
│   │   ├── portfolio.ts            # Holding, PortfolioSummary
│   │   ├── watchlist.ts
│   │   ├── screener.ts             # Filter, ScreenerResult
│   │   └── auth.ts                 # User, TokenPair
│   │
│   └── lib/
│       ├── utils.ts                # formatCurrency, formatPercent, formatLargeNumber
│       ├── constants.ts            # API_BASE_URL, SP500_TICKERS (hardcoded list)
│       └── queryClient.ts          # TanStack QueryClient config (staleTime, retry)
│
├── public/
├── index.html
├── vite.config.ts                  # proxy: /api → localhost:8000 (dev only)
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 4.3 State Management Pattern

**Rule: never store server data in Zustand.**

```
TanStack Query v5          Zustand                          localStorage
─────────────────          ───────                          ────────────
Stock data                 Access token (in memory)         Refresh token
Financial statements       User object (restored on load)   User {id, email}
Metrics + ratios           Theme (dark/light)               Theme preference
Watchlist items
Portfolio holdings
Screener results
AI summaries
```

**TanStack Query hook pattern:**
```typescript
// hooks/useStock.ts
export function useStock(symbol: string) {
  return useQuery({
    queryKey: ["stock", symbol],
    queryFn: () => api.stocks.getProfile(symbol),
    staleTime: 1000 * 60 * 60 * 12,   // 12hr — matches backend cache TTL
    enabled: !!symbol,
  });
}
```

**staleTime matches backend cache TTL** — prevents redundant refetches when data is fresh.

**Zustand auth store:**
```typescript
// store/authStore.ts
interface AuthStore {
  accessToken: string | null;
  user: User | null;                // { id, email }
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

// setAuth persists user to localStorage alongside refresh token:
//   localStorage.setItem("refresh_token", refreshToken);
//   localStorage.setItem("user", JSON.stringify(user));
// clearAuth removes both.
```

Access token stored in Zustand (memory) — not localStorage. Refresh token + user object (`{ id, email }`) stored in localStorage. On page refresh, user is restored from localStorage and refresh token is used to silently obtain a new access token (see Page refresh flow below).

### 4.4 API Client

```typescript
// api/client.ts
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Attach access token to every request
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: refresh token → retry once → else logout
client.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !error.config._retry) {
    error.config._retry = true;
    const newToken = await refreshAccessToken();
    error.config.headers.Authorization = `Bearer ${newToken}`;
    return client(error.config);
  }
  return Promise.reject(error);
});
```

### 4.5 Routing

```typescript
// router.tsx
const router = createBrowserRouter([
  { path: "/",              element: <Landing /> },
  { path: "/stocks/:symbol",element: <Dashboard /> },
  { path: "/screener",      element: <Screener /> },
  { path: "/compare",       element: <Compare /> },
  { path: "/login",         element: <Login /> },
  { path: "/signup",        element: <Signup /> },
  {
    element: <ProtectedRoute />,   // redirects to /login if not authenticated
    children: [
      { path: "/watchlist",        element: <Watchlist /> },
      { path: "/portfolio",        element: <Portfolio /> },
      { path: "/dcf/:symbol",      element: <DCF /> },
    ],
  },
]);
```

### 4.6 Dark Mode

- Tailwind `darkMode: "class"` in `tailwind.config.ts`
- `uiStore.ts` stores preference
- On mount: read localStorage → set `<html class="dark">` → Tailwind dark classes apply
- Toggle in Navbar → updates store → updates `<html>` class

---

## 5. Cache Architecture

Documented in detail in `research.md` Section 5. Summary:

**Pattern:** Cache-through proxy. Every FMP call checked against `StockCache` table first.

```python
# apps/stocks/services/cache_service.py

def get_or_fetch(symbol: str, endpoint: str, params: dict, ttl_hours: int):
    params_hash = StockCache.make_params_hash(params)
    cache_entry = StockCache.objects.filter(
        symbol=symbol, endpoint=endpoint, params_hash=params_hash,
        expires_at__gt=timezone.now()
    ).first()

    if cache_entry:
        return cache_entry.response_data          # HIT

    data = fmp_service.fetch(endpoint, symbol, params)  # MISS → call FMP
    StockCache.objects.update_or_create(
        symbol=symbol, endpoint=endpoint, params_hash=params_hash,
        defaults={
            "params": params,
            "response_data": data,
            "expires_at": timezone.now() + timedelta(hours=ttl_hours),
        }
        # fetched_at uses auto_now=True — Django sets it automatically on save
    )
    return data
```

**TTLs:** profile=7d, statements=24h, metrics=24h, prices=12h, search=30d. See research.md Section 5.

**Concurrency note (V1):** When multiple parallel requests hit a cold cache for the same stock (e.g., first visit triggers 7 hooks simultaneously), each request independently calls FMP and writes to `StockCache` via `update_or_create`. This may result in a few duplicate FMP calls on the very first visit. This is acceptable in V1 — the duplicates are harmless (idempotent writes, same data), rare (only on first visit), and self-healing (subsequent visits are all cache hits). Adding `select_for_update` or locking is unnecessary complexity for V1.

---

## 6. Auth Architecture

### Flow

```
Signup/Login → POST /api/v1/auth/signup/ or /login/
  → Django validates credentials
  → SimpleJWT returns { access, refresh, user }
  → Frontend: access token → Zustand store (in-memory)
              refresh token + user {id, email} → localStorage
  → No cookies for auth in V1

Every API request:
  → Axios interceptor adds: Authorization: Bearer {access}

Access token expires (60min):
  → Axios interceptor catches 401
  → POST /api/v1/auth/refresh/ with { "refresh": "<token>" } in JSON body
  → Gets new { access, refresh } (ROTATE_REFRESH_TOKENS = True)
  → Client MUST replace stored refresh token with the new one
  → Retries original request with new access token

Page refresh:
  → Read refresh token + user JSON from localStorage
  → Restore user object into Zustand immediately (UI shows logged-in state)
  → Silently POST /api/v1/auth/refresh/ to get new {access, refresh}
  → Store new access token in Zustand, new refresh token in localStorage
  → If refresh fails (token expired/invalid): clearAuth → redirect to /login

Logout:
  → Clear access token from Zustand
  → Clear refresh token + persisted user snapshot from localStorage
  → No server-side blacklist in V1
```

### JWT Settings

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,   # new refresh token on each refresh
}
```

### Protected Endpoints

All `/api/v1/watchlists/`, `/api/v1/portfolio/`, `/api/v1/dcf/` require `IsAuthenticated`.
Stock data, screener, search, compare are `IsAuthenticatedOrReadOnly` (public).

---

## 7. Request Lifecycle — Concrete Example

**User opens `/stocks/AAPL` for the first time:**

```
1. Dashboard.tsx mounts
2. 7 TanStack Query hooks fire in parallel:
   - useStock("AAPL")         → GET /api/v1/stocks/AAPL/
   - useFinancials("AAPL")    → GET /api/v1/stocks/AAPL/financials/
   - useMetrics("AAPL")       → GET /api/v1/stocks/AAPL/metrics/
   - usePrices("AAPL")        → GET /api/v1/stocks/AAPL/prices/
   - useHealthScore("AAPL")   → GET /api/v1/stocks/AAPL/health-score/
   - useDividends("AAPL")     → GET /api/v1/stocks/AAPL/dividends/
   - useAISummary("AAPL")     → GET /api/v1/stocks/AAPL/ai-summary/

3. Django receives GET /api/v1/stocks/AAPL/
   → stock_service.get_stock_data("AAPL")
   → cache_service.get_or_fetch("AAPL", "profile", ..., ttl=168)
     → StockCache MISS (first visit)
   → fmp_service.fetch("/stable/profile", symbol="AAPL")
     → HTTP GET https://financialmodelingprep.com/stable/profile?symbol=AAPL&apikey=...
   → Store in StockCache
   → Normalize → update Stock table
   → Return response

4. Same cache-through flow for each endpoint (financials, metrics, prices)
   FMP parallel calls: profile + quote + income + cashflow + balance + key-metrics + ratios + prices
   ~8-10 FMP calls consumed on first visit.

5. Frontend receives all 5 responses → renders each section independently
   Sections with data render immediately; others show skeleton until their data arrives.

6. User visits AAPL again (within TTL):
   → All cache HITs → 0 FMP calls → instant response
```

---

## 8. Screener Architecture

No FMP calls. Pure Django ORM on the `key_metrics` table.

```python
# apps/screener/views.py

def get_queryset(self, filters: dict):
    qs = KeyMetric.objects.select_related("stock").filter(period="annual", is_latest=True)

    if "sector" in filters:
        qs = qs.filter(stock__sector=filters["sector"])
    if "pe_ratio_max" in filters:
        qs = qs.filter(pe_ratio__lte=filters["pe_ratio_max"])
    if "roe_min" in filters:
        qs = qs.filter(roe__gte=filters["roe_min"])
    # ... etc

    return qs.order_by("-market_cap")   # default sort
```

NL search flow:
```
POST /api/v1/screener/nl/ { "query": "tech stocks with P/E under 20" }
  → nl_search.py sends query to Claude Haiku
  → Haiku returns { "filters": { "sector": "Technology", "pe_ratio": {"op": "lt", "value": 20} } }
  → Django validates field names + operators (strict allowlist)
  → Maps to ORM → same get_queryset() above
  → Returns results + interpreted_as chips for UI
```

---

## 9. AI Summary Architecture

```python
# apps/ai/services/ai_service.py

def get_or_generate_summary(symbol: str, financial_data: dict) -> dict:
    """Returns dict with summary_text, status, generated_at."""
    data_hash = hashlib.md5(json.dumps(financial_data, sort_keys=True).encode()).hexdigest()

    cached = AISummaryCache.objects.filter(stock_id=symbol, financial_data_hash=data_hash).first()
    if cached:
        return {"summary_text": cached.summary_text, "status": "cached",
                "generated_at": cached.generated_at}  # HIT — data hasn't changed

    # Check daily generation limit (50/day, UTC calendar day)
    today_count = AISummaryCache.objects.filter(
        generated_at__date=timezone.now().date()  # UTC — Django TIME_ZONE = "UTC"
    ).count()
    stale = AISummaryCache.objects.filter(stock_id=symbol).first()

    if today_count >= 50:
        if stale:
            return {"summary_text": stale.summary_text, "status": "stale",
                    "generated_at": stale.generated_at}
        return {"summary_text": None, "status": "rate_limited"}

    # MISS — generate synchronously within this request (no workers in V1)
    summary = claude_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=STOCK_ANALYSIS_PROMPT,
        messages=[{"role": "user", "content": json.dumps(financial_data)}],
    )
    AISummaryCache.objects.update_or_create(
        stock_id=symbol,
        defaults={
            "summary_text": summary.content[0].text,
            "financial_data_hash": data_hash,
            "model_used": "claude-haiku-4-5-20251001",
        }
        # generated_at uses auto_now=True — Django sets it automatically on save
    )
    return {"summary_text": summary.content[0].text, "status": "fresh",
            "generated_at": timezone.now()}
```

**Key:** Summary is regenerated only when `financial_data_hash` changes — i.e., when FMP returns new quarterly data. Not on a timer. All generation is synchronous within the request (no background workers in V1). When the daily generation limit (50) is reached, the service returns the stale cached summary with `"status": "stale"` if one exists, otherwise returns 429. Daily limits reset at UTC midnight (`TIME_ZONE = "UTC"` in Django settings).

**Hash input (`financial_data` dict):** Built from FinancialStatement rows (income + cashflow, 5yr annual) + latest KeyMetric row + Stock profile fields (name, sector). This is the same data sent to Claude as context (see features.md Feature 11). Hash = `MD5(json.dumps(financial_data, sort_keys=True))`.

---

## 10. Local Dev Setup

```bash
# Prerequisites
brew install postgresql@16
brew services start postgresql@16
createdb stocklens_dev

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# .env
cp .env.example .env
# Fill in: FMP_API_KEY, ANTHROPIC_API_KEY, SECRET_KEY, DATABASE_URL

DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py createsuperuser
DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local
# VITE_API_URL=http://localhost:8000
npm run dev
```

**Vite dev proxy** (avoids CORS in dev):
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

**Mock data:** Use Django fixtures (`apps/stocks/fixtures/`) for UI dev. Never burn FMP API calls on frontend work.

**Playwright MCP (UI review):** Configured in `.mcp.json` (project root). Claude Code uses Playwright to open `localhost:5173` in a visible browser, take screenshots, and visually verify frontend pages (layout, dark mode, responsive). No manual browser testing needed for initial pass — Claude self-reviews, user watches the browser window live.

---

## 11. Environment Variables

### Backend (.env)
```
SECRET_KEY=
DEBUG=True
DATABASE_URL=postgresql://localhost:5432/stocklens_dev
FMP_API_KEY=
ANTHROPIC_API_KEY=
ALLOWED_HOSTS=localhost,127.0.0.1    # comma-separated; parsed with .split(",") in prod
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:8000
```

**Rule:** No API keys in frontend. `VITE_` prefix variables are bundled into the client — only `VITE_API_URL` is safe.

---

## 12. Security

| Concern | Mitigation |
|---------|-----------|
| API keys exposed | Server-side only, `.env`, never in frontend |
| XSS via JWT | Access token in Zustand (memory), not localStorage |
| CSRF | JWT auth is stateless, no cookies for auth in V1 |
| SQL injection | Django ORM parameterizes all queries |
| NL search injection | Haiku output validated against strict allowlist before ORM |
| Financial advice liability | "Not financial advice" on every page, AI summaries labeled |
| CORS | `django-cors-headers` — only `FRONTEND_URL` allowed |
| Rate limiting | NL search: 10/user/hr, 5/IP/hr, 200/day system-wide. AI summary: 50 generations/day. Both use DB counter queries (no django-ratelimit). NL limits tracked via `NLSearchLog` model; AI limit via `AISummaryCache` count. |

---

## 13. CI Pipeline (GitHub Actions)

Set up in Week 1 alongside project scaffolding. Runs on every push/PR to `main`.

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: stocklens_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: [5432:5432]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/stocklens_test
      SECRET_KEY: test-secret-key-not-for-production
      DJANGO_SETTINGS_MODULE: config.settings.dev
      FMP_API_KEY: test-key
      ANTHROPIC_API_KEY: test-key
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r backend/requirements.txt
      - run: cd backend && python manage.py migrate
      - run: cd backend && pytest --tb=short -q

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npx vitest run
      - run: cd frontend && npm run build
```

### Key Design Choices

- **Real PostgreSQL in CI** — not SQLite. Catches DB-specific bugs (JSONField, unique_together).
- **Fake API keys** — tests use `responses` (backend) and MSW (frontend) to mock all external calls. CI never hits FMP or Claude.
- **Build check on frontend** — catches TypeScript errors and import issues before merge.
- **No E2E in V1** — Playwright deferred to V1.5 (per research.md Section 9).
- **No linting enforcement in V1** — add `ruff` + `eslint` in Week 6 polish.

### Test Conventions

| Layer | Tool | Mock Strategy | What to Test |
|-------|------|--------------|-------------|
| Backend | pytest + factory_boy | `responses` library mocks FMP HTTP | Models, services (cache hit/miss), views (200/400/401/404), DCF math, health score |
| Frontend | vitest + RTL | MSW mocks API responses | Component renders, form validation, DCF formula, loading/error/empty states |

---

## 14. Coding Conventions

### Backend
- Service functions: `snake_case`, return plain Python dicts or model instances
- Never call FMP from views — always via service layer
- All FMP calls wrapped in try/except, log errors, return graceful fallback
- `period="annual"` default for all financial endpoints

### Frontend
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts` — return TanStack Query result directly
- API functions: `camelCase` in `api/` — one file per Django app
- Types: defined in `types/`, imported everywhere (no inline `any`)
- Format helpers: `formatCurrency(3200000000000)` → `"$3.2T"`, `formatPercent(0.0534)` → `"5.3%"`

---

## 15. Deployment

Code is deployment-agnostic. Switch by changing env vars only.

### Local Dev (during build — $0)

Everything runs locally. No cloud services needed until you're ready to show the app.

```
Frontend: npm run dev           → localhost:5173 (Vite dev server, proxies /api to Django)
Backend:  python manage.py runserver → localhost:8000
Database: brew install postgresql@16 → localhost:5432/stocklens_dev
```

### Deployed ($0/mo — free tier)

| Layer | Service | Free Tier Details |
|-------|---------|-------------------|
| Frontend | **Vercel** | Unlimited static deploys, global CDN |
| Backend | **Render** (free web service) | 750 hrs/mo, spins down after 15 min inactivity |
| Database | **Neon** (free PostgreSQL) | 0.5 GB storage, no expiry, auto-suspend on idle |

**Cold start mitigation:** Render free tier sleeps after 15 min idle → 30-50s cold start. Use [UptimeRobot](https://uptimerobot.com) (free) to ping `GET /api/v1/stocks/search/?q=AAPL` every 5 min. Keeps the service awake within the 750 hr/mo budget.

### Demo-Ready (~$7/mo — for recruiter links)

| Layer | Service | Cost |
|-------|---------|------|
| Frontend | Vercel | $0 |
| Backend | **Render Starter** | $7/mo (always-on, no cold starts) |
| Database | Neon | $0 |

Upgrade only when sending links to recruiters. One env var change (`RENDER_PLAN`), no code changes.

### Deployment Checklist

- Set `DEBUG=False`, `SECRET_KEY` (random 50 chars), `ALLOWED_HOSTS`, `FRONTEND_URL`
- Run `python manage.py collectstatic` (whitenoise serves admin static files)
- Run `python manage.py migrate`
- Run `python manage.py seed_sp500` (default: top 80 by market cap, ~240 FMP calls = 1 day; then `--start 80 --count 80` daily until all 500 seeded)
- Set `VITE_API_URL` in Vercel to deployed Render URL
- Set `DATABASE_URL` in Render to Neon connection string

---

## 16. Implementation Notes

### First-Visit Latency
When a user visits an uncached stock, 7 TanStack Query hooks fire in parallel from the browser. Django's dev server is multi-threaded (default since Django 2.0+), so these requests are handled concurrently. Each view independently calls its own FMP endpoint(s) via the cache-through proxy:
- `StockProfileView` → 2 FMP calls (profile for identity + quote for price/change/changePercentage; if quote returns 402, fallback to profile price fields)
- `StockFinancialsView` → 3 FMP calls (income + cashflow + balance sheet)
- `StockMetricsView` → 3 FMP calls (ratios + key-metrics + financial-growth)
- `StockPricesView` → 1 FMP call (historical-price-eod)
- `StockHealthScoreView` → 0 FMP calls normally (reads from DB, computed when metrics are stored); if score is missing or stale, synchronously ensures fresh inputs and recomputes
- `StockDividendsView` → 1 FMP call (dividends history) + reads from cached KeyMetric for yield/payout ratio
- `StockAISummaryView` → 0 FMP calls + 1 Claude call (uses cached financials; skipped if < 2yr data)

Total first visit: ~10 FMP calls + 1 Claude call. Wall clock time = max of all parallel requests, not sum. Expected: 3-6 seconds for an uncached stock. Skeleton loaders show per-section until each response arrives. All subsequent visits are cache hits (0 FMP calls, <100ms).

### Health Score Recomputation Trigger
Health score depends on **both** KeyMetric and FinancialStatement data. Primary recomputation is triggered in `stock_service.get_metrics()` after `KeyMetric` data is saved or refreshed. Call sequence:
```
stock_service.get_metrics(symbol)
  → cache_service.get_or_fetch("ratios", ...)
  → cache_service.get_or_fetch("key-metrics", ...)
  → normalize → save KeyMetric rows
  → health_score.compute_health_score(latest_metric, financial_statements)
  → HealthScore.objects.update_or_create(stock=stock, defaults={score, breakdown})
```

**Self-sufficient endpoint contract (no workers in V1):**
The `StockHealthScoreView` reads from the `health_scores` table. If the score exists and `calculated_at` is after the latest `KeyMetric.fetched_at` AND `FinancialStatement.fetched_at` for this stock, return the cached score. If missing or stale, the view calls a helper (`ensure_analysis_inputs_fresh(symbol)`) that synchronously refreshes KeyMetric + FinancialStatement data via the cache-through proxy, then recomputes the score before responding. This eliminates any dependency on background workers.

### KeyMetric `is_latest` Flag Management
When `stock_service.get_metrics()` stores or refreshes KeyMetric rows for a stock:
1. Save all fiscal year rows via `update_or_create` with `is_latest=False`
2. Identify the row with the maximum `fiscal_year`
3. Set `is_latest=True` on that row only (reset others to `False`)

This ensures the screener always filters on one row per stock. The metrics endpoint still uses both latest and previous year rows for trend computation.

### FMP Call Budget
250 calls/day is enforced by FMP, not by StockLens. To avoid silent budget exhaustion:
- `fmp_service.py` should log each FMP call with timestamp (standard Python logging)
- Django admin should show `StockCache` row counts and latest `fetched_at` for visibility
- During development: use `responses` library to mock all FMP calls in tests; never burn real calls on UI work

---

## 17. Canonical V1 Contracts (Implementation Freeze)

These contracts are **final** — do not re-derive, re-debate, or introduce alternatives during implementation. Each is documented in detail elsewhere; this section is the single-glance reference.

| # | Contract | Detail |
|---|----------|--------|
| A | **Auth:** JWT via SimpleJWT | Access token in Zustand (memory), refresh token + user object `{id, email}` in localStorage. No cookies. `ROTATE_REFRESH_TOKENS=True`. Refresh via JSON body `{ "refresh": "<token>" }` returns `{access, refresh}` (no user). Signup/login return `{access, refresh, user}`. On page reload: restore user from localStorage, then silently refresh access token. |
| B | **Caching:** Custom `StockCache` model | Not `django.core.cache`. Lookup by `(symbol, endpoint, params_hash)`. `params_hash = MD5(canonical JSON)`. Duplicate cold-cache FMP calls acceptable in V1 (no locking). |
| C | **Numeric serialization:** DRF defaults | `DecimalField` → JSON strings (`"25.4000"`). `IntegerField`/`BigIntegerField` → JSON integers. Frontend TS types use `string` for decimals. |
| D | **Stock header:** profile + quote merge (with fallback) | `StockProfileView` calls FMP `/stable/profile` (identity) + `/stable/quote` (price/change/changePercentage). 2 FMP calls per uncached visit. If `/stable/quote` returns 402 for a valid symbol, fallback to `/stable/profile` price/change/changePercentage fields. FMP returns `changePercentage` in percent-points — backend divides by 100 before storing as decimal fraction in `price_change_pct`. |
| E | **AI summary:** Synchronous, hash-based regen | No workers. Statuses: `cached`, `fresh`, `stale`, `rate_limited`, `unavailable`. Daily limit: 50 generations/UTC day. |
| F | **Health score:** Self-sufficient endpoint | If score exists and `calculated_at` > latest `KeyMetric.fetched_at` AND `FinancialStatement.fetched_at`, return cached. Else synchronously refresh inputs and recompute. |
| G | **Screener pool_size:** Dynamic | `KeyMetric.objects.filter(is_latest=True, stock__is_sp500=True).count()` — not hardcoded 500. |
| H | **Rate limiting:** DB counter queries | NL search via `NLSearchLog` model. AI summary via `AISummaryCache` count. No `django-ratelimit`. All daily limits use UTC calendar day. |
| I | **seed_sp500 CLI:** `--start 0 --count 80` defaults | Ticker list sorted by market cap desc. Omitting args seeds top 80. Idempotent. |
| J | **Deployment:** Render + Neon + Vercel | Code is deployment-agnostic (env vars only). No Docker in V1. |
| K | **Daily limit boundary:** UTC midnight | `TIME_ZONE = "UTC"` in Django settings. All `__date=timezone.now().date()` queries use UTC. |
| L | **FMP field names:** `change` and `changePercentage` | Both profile and quote use `change` (not `changes`) and `changePercentage` (not `changesPercentage`). `changePercentage` is in percent-points — divide by 100 for decimal fraction. |
| M | **Historical margins:** Computed from statements | `grossProfitRatio`, `operatingIncomeRatio`, `netIncomeRatio` NOT returned by FMP income-statement on free tier. Compute as grossProfit/revenue, operatingIncome/revenue, netIncome/revenue. Latest snapshot margins from `/stable/ratios`. |
| N | **Symbol format:** Hyphen, not dot | FMP uses `BRK-B` (hyphen). Do not assume `BRK.B`. Normalize from seeded DB / FMP search results. |
| O | **Self-sufficient stock views:** Cache-through on cold cache | All stock data endpoints (profile, financials, metrics, prices, dividends, health score) fetch from FMP via cache-through on cache miss — they never return empty/null *merely because cache is cold*. Domain-specific nulls are allowed where explicitly documented (e.g. `pays_dividend: false` with null dividend fields, `score: null` with "Insufficient Data" for <2yr stocks). Errors: 404 (unknown symbol) or 502 (FMP unreachable during fetch). |
| P | **AI summary view transform:** Service → API mapping | Service returns `{summary_text, status, generated_at}`. View maps `summary_text` → `summary`, adds `symbol`, `company_name`, `model_used`. `status` is always present in API response. `max_tokens=500`. |

---

## 18. Architecture Principles

1. **Cache-through proxy** — 250 FMP calls/day is the constraint everything is designed around
2. **Django as the only external API caller** — React sees only our REST API
3. **AI for interpretation only** — Claude parses queries and generates text. Never computes financial data.
4. **No over-engineering** — No Celery, no Redis, no microservices, no Docker in V1
5. **Monolith** — one Django project, one React SPA, one PostgreSQL database
6. **Mock data in dev** — Django fixtures for all UI work. Real API only for integration tests.
