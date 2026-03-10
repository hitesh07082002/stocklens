# Research Document — Investor Research Platform (Qualtrim-Inspired)

> Last updated: Mar 10, 2026
> Working name: **StockLens** (placeholder — can change later)
> Status: **FINAL — endpoints verified Mar 10, 2026 (field contract patch applied)**

---

## 1. Inspiration & Positioning

**Qualtrim** (qualtrim.com) — $9.99/mo, 12K+ users, ~$1.4M/yr. Built by Joseph Carlson (YouTuber). Long-term investor research tool, not a trading platform. Features: 30yr financial charts, DCF calculator, dividend tracker, AI insights, 40+ filter screener, portfolio tracker, mobile apps. No real-time data, no trade execution.

**Our differentiation:** Qualtrim owns the $0-10/mo niche via audience. We differentiate on **engineering quality + UX polish + AI features** (NL search, AI summaries). This is a portfolio/resume project first, potential side revenue second.

---

## 3. Data Source Feasibility

### 3.1 Financial Statements & Fundamentals

| API | Free Tier | Paid Tier | History | DX | Role |
|-----|-----------|-----------|---------|-----|------|
| **Financial Modeling Prep (FMP)** | 250 calls/day, ~5yr, 150+ endpoints, 500MB/30d | $19/mo unlimited | 30+ years on paid | Excellent | **Primary** |
| **Finnhub** | 60 calls/min | $49/mo+ | Varies | Good | **Fallback** |
| **Alpha Vantage** | 25 calls/day | $49.99/mo | 20+ years | Decent | Emergency only |
| **EODHD** | Limited | $29.99/mo | 30+ years | Good | Bulk historical |
| **SimFin** | 2,000 calls/day | $15/mo | ~15 years | Good | Batch pipelines |

**Decision:** FMP as single data source for V1. Finnhub as emergency fallback. One API = simpler architecture.

### 3.2 FMP Free Tier — Verified Endpoints (Tested Mar 2026)

**IMPORTANT:** FMP migrated from `/api/v3/` (path params) to `/stable/` (query params) in Aug 2025. All `/api/v3/` endpoints return "Legacy Endpoint" errors for accounts created after Aug 31, 2025. New format: `/stable/endpoint?symbol=X&apikey=KEY`.

#### Working on Free Tier (V1-required endpoints verified live Mar 10, 2026):

```
# Financial Statements
GET /stable/income-statement?symbol={symbol}&period=annual
GET /stable/income-statement?symbol={symbol}&period=quarterly     # 5 quarters
GET /stable/balance-sheet-statement?symbol={symbol}&period=annual
GET /stable/cash-flow-statement?symbol={symbol}&period=annual

# Metrics & Ratios (NEED BOTH — data is split across them)
GET /stable/key-metrics?symbol={symbol}                           # ROE, ROIC, marketCap, EV, FCF yield
GET /stable/ratios?symbol={symbol}&period=annual                  # P/E, P/S, P/FCF, D/E, dividendYield, margins

# Company Info & Price
GET /stable/profile?symbol={symbol}                               # Name, sector, industry, price, description
GET /stable/quote?symbol={symbol}                                 # Price, change, 52wk, SMA50/200
GET /stable/historical-price-eod/full?symbol={symbol}             # EOD prices (supports from/to dates)

# Search (ONLY search-name works — ticker search broken on free tier)
GET /stable/search-name?query={query}&exchange=NASDAQ             # Company name search

# Growth & Analysis (V1-verified)
GET /stable/financial-growth?symbol={symbol}&period=annual        # Pre-computed 1Y/3Y/5Y/10Y growth rates

# Dividends (V1-verified)
GET /stable/dividends?symbol={symbol}                             # Dividend history with yield, frequency

# Verified working but NOT used in V1:
GET /stable/key-metrics-ttm?symbol={symbol}                       # Trailing twelve months
GET /stable/ratios-ttm?symbol={symbol}                            # Trailing twelve months
GET /stable/quote-short?symbol={symbol}                           # Price, change, volume only

# ── Below: NOT live-tested, NOT used in V1. May work on free tier — verify before use. ──
GET /stable/income-statement-growth?symbol={symbol}
GET /stable/balance-sheet-statement-growth?symbol={symbol}
GET /stable/cash-flow-statement-growth?symbol={symbol}
GET /stable/stock-peers?symbol={symbol}                           # Related companies
GET /stable/analyst-estimates?symbol={symbol}&period=annual       # Forward estimates
GET /stable/stock-price-change?symbol={symbol}                    # 1D/5D/1M/3M/6M/1Y/3Y/5Y/10Y returns
GET /stable/enterprise-values?symbol={symbol}
GET /stable/discounted-cash-flow?symbol={symbol}                  # FMP's own DCF calculation
GET /stable/owner-earnings?symbol={symbol}
GET /stable/shares-float?symbol={symbol}
```

#### NOT Available on Free Tier:

```
# 402 Payment Required:
/stable/sp500-constituent               # Need hardcoded S&P 500 list instead
/stable/batch-quote                     # No bulk price refresh
/stable/stock-list                      # No full stock list
/stable/available-exchanges             # No exchange list
/stable/historical-chart/1hour          # No intraday data

# 404 Not Found (endpoint does not exist on this tier):
/stable/stock-screener                  # Must build screener 100% locally
/stable/search-ticker                   # Only search-name works
/stable/search                          # Only search-name works
/stable/earning-calendar                # V2 feature anyway
/stable/rating, /stable/historical-rating
/stable/stock-news, /stable/press-releases
/stable/insider-trading, /stable/institutional-holder
/stable/sec-filings, /stable/earnings-surprises
/stable/analyst-stock-recommendations
/stable/historical-market-cap
/stable/sectors-performance, /stable/sector-pe-ratio
/stable/market-biggest-gainers/losers/most-active
```

#### Key Field Names (from tested responses):

| Endpoint | Key Fields |
|----------|-----------|
| `income-statement` | `revenue`, `netIncome`, `eps`, `epsDiluted`, `grossProfit`, `ebitda`, `operatingIncome`, `weightedAverageShsOutDil`. **Note:** `grossProfitRatio`, `operatingIncomeRatio`, `netIncomeRatio` are NOT present in the annual income-statement response on verified free-tier key (Mar 2026). Margins must be computed: gross = grossProfit/revenue, operating = operatingIncome/revenue, net = netIncome/revenue. Latest snapshot margins are available from `/stable/ratios` (`grossProfitMargin`, `operatingProfitMargin`, `netProfitMargin`). |
| `key-metrics` | `returnOnEquity`, `returnOnAssets`, `returnOnInvestedCapital`, `marketCap`, `enterpriseValue`, `freeCashFlowYield`, `currentRatio`, `earningsYield` |
| `ratios` | `priceToEarningsRatio`, `priceToSalesRatio`, `priceToFreeCashFlowRatio`, `debtToEquityRatio`, `dividendYield`, `dividendPayoutRatio`, `grossProfitMargin`, `netProfitMargin`, `freeCashFlowPerShare`, `revenuePerShare` |
| `cash-flow-statement` | `freeCashFlow`, `operatingCashFlow`, `capitalExpenditure`, `commonDividendsPaid` |
| `profile` | `price`, `change`, `changePercentage`, `companyName`, `sector`, `industry`, `marketCap`, `description`, `ceo` |
| `quote` | `price`, `change`, `changePercentage`, `volume`, `dayLow`, `dayHigh`, `yearHigh`, `yearLow`, `marketCap`, `priceAvg50`, `priceAvg200` |

#### Impact on Architecture:

1. **S&P 500 list must be hardcoded** — `sp500-constituent` returns 402 (restricted). Source from Wikipedia/GitHub CSV.
2. **Ticker search unavailable** — `search-ticker` and `search` return 404. Only `search-name` works. Pair with local DB search for seeded stocks.
3. **P/E, margins, dividend yield are in `/stable/ratios`** — not `/stable/key-metrics`. Need both endpoints per stock.
4. **No batch price refresh** — `batch-quote` returns 402. Each stock refreshed individually on visit.
5. **Verified bonus endpoints (used in V1):** `financial-growth` (pre-computed growth rates), `dividends` (history for dividend analysis). **Verified but not used in V1:** `quote-short`, `key-metrics-ttm`, `ratios-ttm` (live-tested 200, available for future use). **Unverified bonus endpoints (listed as working but not live-tested, not used in V1):** `stock-peers`, `analyst-estimates`, `discounted-cash-flow`, `stock-price-change`, `enterprise-values`, `owner-earnings`, `shares-float`, `income-statement-growth`, `balance-sheet-statement-growth`, `cash-flow-statement-growth`. Verify before use.
6. **Quote fallback for some symbols:** `/stable/quote` returned 402 for some valid symbols (e.g. `GOOG`, `BRK-B`) while `/stable/profile` still returned 200. V1 defensive contract: prefer `/stable/quote` for price/change/changePercentage; if quote fails but profile succeeds, fallback to profile's price/change/changePercentage fields. Both endpoints return the same field names for price data.
7. **FMP `changePercentage` is in percent-points** (e.g. `0.90888` = 0.91%). Backend must divide by 100 before storing as internal decimal fraction (`price_change_pct = 0.0090888`).
8. **Symbol format:** FMP search results use `BRK-B` (hyphen), not `BRK.B` (dot). Normalize symbols from seeded DB / FMP search results; do not assume dot format.

**Budget:** 250 calls/day. ~10 FMP calls per uncached stock (profile + quote + 3 statements + key-metrics + ratios + financial-growth + dividends + prices). = ~25 unique new stocks/day. With caching, all repeat visits are free.

### 3.3 Stock Price Data

**Decision:** FMP EOD prices. No real-time needed — Qualtrim itself doesn't do real-time.

### 3.4 Earnings Call Transcripts (V2)

**Decision:** Defer to V2. API Ninjas ($9.99/mo) when ready — affordable, structured JSON, 8,000+ companies back to 2005.

### 3.5 AI Costs

| Model | Cost per call | Use Case |
|-------|--------------|----------|
| Claude Haiku 4.5 | ~$0.001-0.005 | NL search parsing, stock summaries |
| Claude Sonnet 4.5 | ~$0.02 | Higher quality summaries (V2) |

**V1 AI cost:** NL search (~$0.001/query) + stock summaries (~$0.005/stock, cached forever). At realistic V1 usage: **$2-5/month**. Negligible.

**Strategy:** Generate once, cache forever. Re-generate only when underlying financial data changes.

### 3.6 Data Freshness

| Data Type | Update Frequency | Cache TTL |
|-----------|-----------------|-----------|
| Stock price (EOD) | Daily after market close (~4:30 PM ET) | 12 hours |
| Financial statements | Quarterly | 24 hours |
| Key metrics / ratios | Derived from financials | 24 hours |
| Dividend history | Quarterly at most | 24 hours |
| Company profile | Rarely changes | 7 days |
| Search results | Static | 30 days |
| AI summaries | When financials change | Until next earnings |

---

## 4. Tech Stack

### Chosen: React + Django + PostgreSQL

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React (Vite) + TypeScript | Fast dev, huge ecosystem, interactive charts |
| **UI Components** | Shadcn/ui + TanStack Table | Tailwind-native, fully customizable, no bundle bloat |
| **Charts** | TradingView Lightweight Charts (price) + Recharts (financial) | Canvas-based price chart + React-native financial charts |
| **Styling** | Tailwind CSS | Utility-first, responsive, dark mode built-in |
| **Backend** | Django + Django REST Framework | Built-in auth/admin/ORM, data-heavy apps |
| **Database** | PostgreSQL | Strong typing, JSON support, FTS, financial data |
| **Caching** | Custom DB-backed cache (StockCache model), Redis V1.5 | Cache FMP responses server-side |
| **AI** | Anthropic API (Claude Haiku) | NL search + stock summaries |
| **Deployment** | Render + Neon + Vercel | Free tier for build, Render Starter ($7/mo) for demo-ready |

### Why Django over Next.js

| Factor | React + Django | Next.js |
|--------|---------------|---------|
| **Resume value** | Clear frontend/backend separation — architecturally impressive | Full-stack-in-one feels simpler |
| **Backend power** | ORM, admin panel, built-in auth, management commands | API routes are thin, external solutions needed |
| **Data pipeline** | Management commands for S&P 500 seeding, data normalization | Separate scripts or serverless |
| **Financial logic** | Python — pandas, numpy if needed | JS math libraries weaker |
| **Admin panel** | Django admin for free — cached data, users, system health | Build from scratch |

### Architecture (V1)

```
┌──────────────────┐         ┌──────────────────┐         ┌────────────┐
│  React SPA       │  REST   │  Django API      │  ORM    │ PostgreSQL │
│  (Vite + TS)     │────────▶│  (DRF)           │────────▶│            │
│                  │  JSON   │                  │         │  Tables:   │
│  Pages:          │◀────────│  Apps:           │         │  - stocks  │
│  - Landing       │         │  - stocks/       │         │  - financials│
│  - Dashboard     │         │  - users/        │         │  - metrics │
│  - Search        │         │  - watchlists/   │         │  - prices  │
│  - Watchlist     │         │  - portfolio/    │         │  - watchlists│
│  - DCF Tool      │         │  - screener/     │         │  - portfolio│
│  - Compare       │         │  - ai/           │         │  - dcf     │
│  - Screener      │         │                  │         │  - cache   │
│  - Portfolio     │         │                  │         │  - ai_cache│
└──────────────────┘         └──────┬───────────┘         └────────────┘
                                    │
                          ┌─────────┼─────────┐
                          ▼         ▼         ▼
                   ┌──────────┐ ┌────────┐ ┌──────────┐
                   │ FMP API  │ │Claude  │ │ Django   │
                   │ (cached) │ │Haiku   │ │ Admin    │
                   └──────────┘ └────────┘ └──────────┘
```

Frontend **never** calls FMP or Claude directly. Django is the proxy + cache + AI orchestration layer.

---

## 5. Caching Design

This is the core backend concern. 250 API calls/day means caching is not optional.

### Strategy: Cache-Through Proxy

```
User requests AAPL dashboard
  → React calls GET /api/stocks/AAPL/financials/
  → Django checks cache table:
      HIT  (not expired): return cached data instantly
      MISS (expired/absent): call FMP → store in cache → return to user
```

### Cache Table Schema

```
stock_cache
├── id (PK)
├── symbol (indexed)         -- "AAPL"
├── endpoint (indexed)       -- "income-statement"
├── params (JSON)            -- {"period": "annual"}
├── response_data (JSON)     -- raw FMP response
├── fetched_at (timestamp)   -- when fetched from FMP
├── expires_at (timestamp)   -- fetched_at + TTL
└── created_at / updated_at

UNIQUE constraint on (symbol, endpoint, params)
```

### TTL Rules

| Endpoint | TTL | Reason |
|----------|-----|--------|
| Company profile | 7 days | Rarely changes |
| Financial statements | 24 hours | Quarterly updates, 24hr covers earnings day |
| Key metrics | 24 hours | Derived from financials |
| Historical prices | 12 hours | EOD after market close |
| Search results | 30 days | Ticker/name mappings stable |
| AI summaries | Until next earnings | Regenerate when financials update |

### API Budget Math

- 250 calls/day free tier
- ~10 FMP calls per uncached stock (profile + quote + 3 statements + key-metrics + ratios + financial-growth + dividends + prices)
- First visit to a stock = 10 calls. Every subsequent visit = 0 (cached).
- **~25 unique new stocks per day** before hitting limit
- With caching, all repeat visits are free indefinitely
- S&P 500 seed (minimal): 500 stocks × 3 calls (profile + ratios + key-metrics) = 1,500 calls = **~6 days**
- S&P 500 seed (full): 500 stocks × 10 calls = 5,000 calls = **~20 days**
- **Recommended:** Seed top 80 on day 1 (240 calls), continue remaining 420 over next 6 days. Full data fetched on-demand per stock visit.
- If limit becomes a problem → FMP Starter ($19/mo, unlimited)

### S&P 500 Seeding Strategy

```
python manage.py seed_sp500
```

Django management command that:
1. Reads S&P 500 ticker list from hardcoded CSV (FMP `sp500-constituent` endpoint is restricted on free tier — source list from Wikipedia/GitHub)
2. Phase 1 (screener-ready): Fetches profile + ratios + key-metrics per stock (3 calls each). Top 80 by market cap first (~1 day, 240 calls), then remaining 420 (~6 more days at ~80/day).
3. Phase 2 (on-demand): Full data (statements, prices, dividends, growth) fetched when a user visits a specific stock's dashboard page.
4. Stores in `stocks` and `key_metrics` tables. Enables screener and NL search to work against 500 stocks.
5. On paid tier ($19/mo): seeds all 500 stocks with full data in ~1 day.

---

## 6. Data Model

Rough schema — refined in architecture.md:

```
users
├── id (PK)
├── email (unique)
├── password_hash
├── created_at

stocks (cached from FMP — seeded with S&P 500)
├── symbol (PK)          -- "AAPL"
├── name                 -- "Apple Inc."
├── sector               -- "Technology"
├── industry             -- "Consumer Electronics"
├── market_cap           -- 3000000000000
├── description          -- company description
├── last_price           -- 185.50
├── price_change_pct     -- -1.2
├── updated_at

financial_statements (cached from FMP)
├── id (PK)
├── symbol (FK → stocks)
├── statement_type       -- income / balance / cashflow
├── period               -- annual / quarterly
├── fiscal_year          -- 2025
├── fiscal_quarter       -- Q1 (nullable for annual)
├── data (JSON)          -- full FMP response for this statement
├── fetched_at

key_metrics (cached from FMP — powers screener + health score)
├── id (PK)
├── symbol (FK → stocks)
├── period               -- annual / quarterly
├── fiscal_year
├── pe_ratio, ps_ratio, pfcf_ratio
├── roe, debt_equity
├── dividend_yield, market_cap
├── eps, fcf_per_share
├── revenue_growth, net_income_growth
├── gross_margin, operating_margin, net_margin
├── fetched_at

price_history (cached from FMP)
├── id (PK)
├── symbol (FK → stocks)
├── date, open, high, low, close, volume
├── fetched_at

watchlists
├── id (PK)
├── user_id (FK → users)
├── name                 -- "My Watchlist" or "FAANG" (pre-built)
├── is_preset            -- true for pre-built lists
├── created_at

watchlist_items
├── id (PK)
├── watchlist_id (FK → watchlists)
├── symbol (FK → stocks)
├── added_at
├── sort_order

portfolio_holdings
├── id (PK)
├── user_id (FK → users)
├── symbol (FK → stocks)
├── shares               -- 10.5
├── avg_cost_per_share   -- 150.00
├── added_at
├── updated_at
NOTE: No stock splits, no FIFO/lots, no transaction history in V1.
      Gain/loss = (current_price - avg_cost) × shares. Simple.

dcf_calculations
├── id (PK)
├── user_id (FK → users)
├── symbol (FK → stocks)
├── method               -- eps / fcf
├── growth_rate, discount_rate, terminal_multiple
├── years_projected
├── fair_value_result
├── created_at

recently_viewed
├── id (PK)
├── user_id (FK → users)
├── symbol (FK → stocks)
├── viewed_at

ai_summary_cache
├── id (PK)
├── symbol (FK → stocks)
├── summary_text         -- plain-English AI analysis
├── financial_data_hash  -- hash of input data (regenerate when this changes)
├── model_used           -- "claude-haiku-4-5"
├── generated_at
├── expires_at           -- next expected earnings date

health_scores
├── id (PK)
├── symbol (FK → stocks)
├── score                -- 0-100
├── breakdown (JSON)     -- {"pe_score": 75, "roe_score": 85, ...}
├── calculated_at
```

### Key Design Decisions

- **Financial data as JSON** — FMP responses vary by company. JSON avoids rigid column mapping for statements. Structured columns for key_metrics (powers screener queries).
- **Separate cache table vs domain tables** — `stock_cache` stores raw API responses for dedup. Domain tables (`financial_statements`, `key_metrics`) are structured for app queries.
- **AI summaries cached with data hash** — regenerate only when underlying financials change, not on a timer.
- **Portfolio simplified** — avg cost × shares. No lots, no splits, no transaction log. V2 concern.
- **Health scores stored, not computed on-the-fly** — recompute when metrics update. Avoids repeated calculation on every page load.
- **Pre-built watchlists** — `is_preset=true` flag. Seeded via management command alongside S&P 500 data.

---

## 7. V1 Scope (16 Features)

### 7.1 Core Product (Features 1–10)

| # | Feature | Description | Data Source | Effort |
|---|---------|-------------|-------------|--------|
| 1 | **Stock Dashboard** | Single-stock view: price chart + financials + metrics + AI summary + health score. The hero page. | FMP + AI | 1-1.5 weeks (with #2, #3) |
| 2 | **Financial Charts** | Revenue, net income, EPS, FCF, margins — 5yr history. Interactive, clean, responsive. | FMP (income, cash flow, balance sheet) | Part of #1 |
| 3 | **Key Metrics Panel** | P/E, P/S, P/FCF, debt/equity, ROE, dividend yield, market cap — at a glance | FMP (key metrics) | Part of #1 |
| 4 | **Stock Search** | By ticker or company name. Debounced autocomplete. Works without auth. | Local DB (seeded stocks) + FMP (`search-name` for company names — ticker search unavailable on free tier) | 1-2 days |
| 5 | **User Auth** | Sign up, log in, JWT via SimpleJWT. Protected routes for watchlist/portfolio/DCF. | Django auth + SimpleJWT | 2 days |
| 6 | **Watchlist** | Save stocks, key metrics at a glance, quick navigation. Pre-built lists (FAANG, Dividend Aristocrats, S&P Top 10) seeded. | PostgreSQL | 2-3 days |
| 7 | **DCF Calculator** | Growth rate, discount rate, terminal multiple → fair value. Auto-fill from API. EPS + FCF modes. Saved per user. | FMP + Python math | 3-4 days |
| 8 | **Stock Comparison** | Compare 2-3 stocks side by side across key metrics + charts | Cached FMP data | 2-3 days |
| 9 | **Portfolio Tracker** | Add holdings (ticker + shares + avg cost). Current value, gain/loss, sector allocation pie chart. Simplified — no splits, no lots, no FIFO. | FMP prices + Django ORM | 2-3 days |
| 10 | **Basic Screener** | Filter pre-cached S&P 500 by market cap, P/E, dividend yield, sector, ROE, FCF. 8-10 manual filters. Sortable results table. | Cached key_metrics | 3-4 days |

### 7.2 AI + Intelligence (Features 11–14)

| # | Feature | Description | Data Source | Effort |
|---|---------|-------------|-------------|--------|
| 11 | **AI Stock Summary** | Feed cached financials to Claude Haiku → plain-English analysis. Cached until financials change. Shown on stock dashboard. | Cached data + Claude Haiku | 2-3 days |
| 12 | **Financial Health Score** | Custom composite score (0-100) from P/E, debt/equity, ROE, FCF growth, margins. Our own weighted methodology. Visual gauge on dashboard. | Cached key_metrics + Python | 2 days |
| 13 | **Natural Language Search** | "tech stocks with P/E under 20" → Claude Haiku parses to structured filters → Django ORM query on cached data → results + interpreted filters shown. | LLM + Django ORM | 3-4 days |
| 14 | **Trend Indicators** | Green/red YoY arrows on every metric. "Revenue ↑ 12%", "Margins ↓ 3%". Computed from consecutive years of cached financials. | Cached financials | 1 day |

### 7.3 Polish + Experience (Features 15–16)

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 15 | **Dividend Analysis** | Yield, payout ratio, growth rate, consecutive years of increase. Section on stock dashboard. | 1-2 days |
| 16 | **Recently Viewed + Pre-built Watchlists** | Last 10 viewed stocks. Seed watchlists: FAANG, Dividend Aristocrats, S&P Top 10. App has content from first login. | 1 day |

### 7.4 Quality Baseline (not features — expected standard)

These are not counted as features but are required to ship:

- **Landing page** — hero section, feature preview with screenshots, CTA to sign up or try a demo stock (e.g., AAPL)
- **Dark mode** — Tailwind dark class, toggle in header, persisted preference
- **Responsive mobile web** — all pages usable on 375px+
- **Loading states** — skeleton screens on every data fetch
- **Error states** — API down, stock not found, rate limited, no results
- **Empty states** — no watchlist items, no portfolio holdings, no search results
- **Legal** — "Not financial advice" footer on every page, "Data provided by Financial Modeling Prep" attribution
- **Meta** — proper `<title>` per page, favicon, OG tags for sharing

**V2 deferred features, NL search design, and success criteria** — see `features.md` Sections 6 and 7.

---

## 8. Project Goals

**Primary:** Resume/portfolio project demonstrating full-stack engineering (React + Django + PostgreSQL), data engineering (FMP caching pipeline), AI integration (NL search, AI summaries), and financial domain knowledge (DCF, health scoring).

**Secondary:** Potential side revenue via freemium ($5-10/mo gates in V1.5). Launch V1 completely free.

**Not** a Qualtrim competitor. US stocks only, depth over breadth.

---

## 9. Testing Strategy

**Backend:** pytest + factory_boy + `responses` (mock HTTP). Test: models, API endpoints, FMP cache hit/miss, DCF math, health score, NL search parsing.

**Frontend:** vitest + React Testing Library + MSW. Test: components, chart rendering, API hooks (loading/error/success), screener filters.

**Week 1-2 browser QA:** Playwright MCP for manual browser verification during implementation/review.

**Deferred until end of Week 2 / start of Week 3:** repo-installed `@playwright/test` E2E smoke suite, once one seeded stock dashboard flow is stable. Load testing and visual regression remain deferred.

---

## 10. Costs & Timeline

**V1 Dev:** ~$2-6/mo (FMP free, Haiku ~$2-5, free hosting).
**V1 Production:** ~$32-52/mo (FMP Starter $19, Haiku $5-10, hosting $7-15).
**V2 adds:** transcript API ($10) + Redis ($0-5) = ~$42-67/mo.

**Timeline:** ~6 weeks total. Planning ~1wk → Scaffold 2-3d → Dashboard+charts 1-1.5wk → Auth+watchlist 3-4d → DCF+health 4-5d → Portfolio 2-3d → Screener+NL 5-6d → AI+dividends 3-4d → Polish+deploy 1-1.5wk.

---

## 12. Technical Constraints

1. **FMP free tier = 250 calls/day, 500MB/30d** — caching is the core backend concern (Section 5)
2. **Single API (FMP)** — no Finnhub in V1. One API = simpler data layer.
3. **5-year history on free tier** — enough for V1; $19/mo unlocks 30+ years
4. **AI costs <$10/mo** — Haiku for NL search + summaries, cache results aggressively
5. **Monolith** — single Django project, single React SPA. No microservices, no Celery in V1.
6. **JWT auth (SimpleJWT)** — standard for SPA + REST API separation
7. **Mock data for dev** — Django fixtures + factory_boy, don't burn API calls on UI work
8. **DB-backed cache in V1** — custom `StockCache` model (not `django.core.cache`). Redis in V1.5.
9. **CORS** — React (localhost:5173) ↔ Django (localhost:8000) via django-cors-headers
10. **Django admin** — free admin panel for cached data, users, AI cache, health scores
11. **S&P 500 seeded in phases** — hardcoded ticker list (FMP constituent endpoint restricted), screener-ready in ~6 days (3 calls/stock), full data on-demand per stock visit

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| FMP free tier gets restrictive | Medium | High | Cache aggressively. Finnhub as fallback. Abstract data layer for provider swaps. |
| Burning API calls during dev | High | Medium | Mock/fixture data for all UI work. Real API for integration tests only. |
| Scope creep | High | High | V1 = 16 features. This doc is the contract. Anything else is V2. |
| LLM returns invalid JSON (NL search) | Medium | Low | Validate response, retry once, fallback to "couldn't parse" message. |
| AI summary quality inconsistent | Medium | Medium | Use structured prompt with exact financial data. Cache good results. Regenerate only on data change. |
| Data accuracy concerns | Medium | High | Show data source + timestamp. "Data by FMP" attribution. Never show stale data as current. |
| Legal: financial advice liability | Low | High | Disclaimers on every page. Never use "buy/sell/recommend" language. |
| Over-engineering | Medium | Medium | DB cache not Redis. SimpleJWT not OAuth. No Celery. Add complexity only when forced. |
| S&P 500 seed takes ~7 days (screener-ready) | Low | Medium | Seed top 80 on day 1 (240 calls). Remaining 420 over next 6 days (~80/day). Full data on-demand. |
| Anthropic API key exposure | Low | High | Server-side only. Never in frontend code. Environment variables. |

---

## 14. Resolved Questions (formerly open — all decided)

1. ~~**Shadcn/ui vs Ant Design?**~~ — **Resolved:** Shadcn/ui + TanStack Table. Tailwind-native, no bundle bloat. See architecture.md §1.
2. ~~**Recharts vs TradingView Lightweight Charts?**~~ — **Resolved:** TradingView Lightweight Charts (price chart) + Recharts (financial bar/line/pie). See architecture.md §1.
3. **Single Django project, multiple apps** — `stocks/`, `users/`, `watchlists/`, `portfolio/`, `screener/`, `ai/` as separate Django apps. Keeps code organized, models scoped.
4. ~~**Docker in V1?**~~ — **Resolved:** No Docker in V1. PostgreSQL via `brew install postgresql@16`. Simpler dev loop for solo engineer. See architecture.md.
5. ~~**Health score methodology**~~ — **Resolved in features.md** (5 categories, 13 metrics, 100 points, absolute thresholds V1). Sector-adjusted scoring deferred to V2.

---

## 15. FMP V1 Field Contract Verification — Mar 10, 2026

Live-tested with the project's free/Basic-tier FMP API key against real symbols.

### V1-Required Endpoints — Verified Working (200, non-empty)

| Endpoint | Tested With | Status |
|----------|-------------|--------|
| `/stable/profile?symbol=AAPL` | AAPL | 200 |
| `/stable/quote?symbol=AAPL` | AAPL, MSFT, NVDA, AMZN, META, TSLA, GOOGL | 200 |
| `/stable/income-statement?symbol=AAPL&period=annual` | AAPL | 200 |
| `/stable/balance-sheet-statement?symbol=AAPL&period=annual` | AAPL | 200 |
| `/stable/cash-flow-statement?symbol=AAPL&period=annual` | AAPL | 200 |
| `/stable/key-metrics?symbol=AAPL` | AAPL | 200 |
| `/stable/ratios?symbol=AAPL&period=annual` | AAPL | 200 |
| `/stable/financial-growth?symbol=AAPL&period=annual` | AAPL | 200 |
| `/stable/historical-price-eod/full?symbol=AAPL&from=...&to=...` | AAPL | 200 |
| `/stable/search-name?query=Apple&exchange=NASDAQ` | Apple | 200 |
| `/stable/search-name?query=Apple&exchange=NYSE` | Apple | 200 |
| `/stable/dividends?symbol=AAPL` | AAPL | 200 |
| `/stable/quote-short?symbol=AAPL` | AAPL | 200 |
| `/stable/key-metrics-ttm?symbol=AAPL` | AAPL | 200 |
| `/stable/ratios-ttm?symbol=AAPL` | AAPL | 200 |

### Verified Unavailable

| Endpoint | HTTP Status |
|----------|-------------|
| `/stable/sp500-constituent` | 402 Payment Required |
| `/stable/batch-quote` | 402 Payment Required |
| `/stable/stock-list` | 402 Payment Required |
| `/stable/stock-screener` | 404 Not Found |
| `/stable/search` | 404 Not Found |
| `/stable/search-ticker` | 404 Not Found |

### Field Name Corrections

| Field | Correct (verified) | Wrong (do NOT use) |
|-------|-------------------|-------------------|
| Daily price change | `change` | `changes` |
| Daily percent change | `changePercentage` | `changesPercentage` |

Both `/stable/profile` and `/stable/quote` use the same correct field names (`change`, `changePercentage`).

### `changePercentage` Unit

FMP returns `changePercentage` as percent-points (e.g. `0.90888` means 0.91%). Backend must divide by 100 before storing in `price_change_pct` as decimal fraction (`0.0090888`).

### Income Statement — Missing Ratio Fields

The following fields are NOT present in `/stable/income-statement` annual response on this key:
- `grossProfitRatio`
- `operatingIncomeRatio`
- `netIncomeRatio`

Historical margins must be computed from statement values. Latest snapshot margins come from `/stable/ratios` (`grossProfitMargin`, `operatingProfitMargin`, `netProfitMargin`).

### Negative-Case Behavior

| Scenario | Response |
|----------|----------|
| Invalid symbol on `/stable/profile` | 200 with empty list `[]` |
| Invalid query on `/stable/search-name` | 200 with empty list `[]` |
| Non-dividend symbol (AMZN, TSLA) on `/stable/dividends` | 200 with empty list `[]` |
| `/stable/quote` for some valid symbols (GOOG, BRK-B) | 402 on this key |
| `/stable/profile` for the same symbols | 200 (still works) |

### Quote Fallback Contract

- Prefer `/stable/quote` for price/change/changePercentage
- If quote returns 402 for a valid symbol but profile returns 200, fallback to profile's price/change/changePercentage
- This is a defensive fallback, not a redesign — most common symbols work on quote

### Symbol Format

FMP search results use `BRK-B` (hyphen), not `BRK.B` (dot). Normalize symbols from seeded DB / FMP search results.

---

## 16. References

Research URLs archived in `GPT_DOCS/`. Key references: [FMP Docs](https://site.financialmodelingprep.com/developer/docs), [FMP Pricing](https://site.financialmodelingprep.com/pricing-plans), [Qualtrim](https://www.qualtrim.com/), [FinanceToolkit (Python)](https://github.com/JerBouma/FinanceToolkit).
