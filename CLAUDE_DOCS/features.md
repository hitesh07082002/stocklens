# StockLens — V1 Feature Specification

> Status: **FINAL — endpoints verified Mar 2026**
> Last updated: Mar 03, 2026
> Scope: 16 features + quality baseline
> Assumes: FMP free tier (250 calls/day, `/stable/` endpoints), Django + React, no Celery/Redis, S&P 500 pre-seeded
> FMP note: All endpoints use `/stable/` format (query params). `/api/v3/` is dead. See research.md Section 3.2 for full verified endpoint map.

---

## 1. Scope Contract

If a feature is not listed in this document, it is not part of V1.

### Assumptions (from research.md)
- Single data source: FMP (Financial Modeling Prep)
- Cache-through proxy: Django caches all FMP responses with TTL
- S&P 500 pre-seeded via management command (~500 stocks)
- JWT auth via SimpleJWT
- AI via Claude Haiku 4.5 (Anthropic API)
- No Celery, no Redis, no background jobs
- 5-year financial history (FMP free tier limit)
- EOD prices only (no real-time)

---

## 2. Route Map

| Route | Auth | Feature |
|-------|------|---------|
| `/` | Public | Landing page |
| `/stocks/{symbol}` | Public | Stock dashboard (hero page) |
| `/screener` | Public | Manual screener + NL search |
| `/compare` | Public | Stock comparison (2-3 stocks) |
| `/login` | Public | Login |
| `/signup` | Public | Sign up |
| `/watchlist` | **Auth** | User watchlists |
| `/portfolio` | **Auth** | Portfolio tracker |
| `/dcf/{symbol}` | **Auth** | Full-page DCF (also embedded on dashboard) |

---

## 3. API Endpoint Map

All endpoints prefixed with `/api/v1/`. Frontend calls these — never FMP directly.

### Public Endpoints (no auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stocks/search/?q={query}` | Autocomplete search |
| GET | `/stocks/{symbol}/` | Company profile + current price |
| GET | `/stocks/{symbol}/financials/` | Income, balance sheet, cash flow (5yr) |
| GET | `/stocks/{symbol}/metrics/` | Key metrics (P/E, ROE, etc.) |
| GET | `/stocks/{symbol}/prices/` | EOD price history |
| GET | `/stocks/{symbol}/health-score/` | Health score + breakdown |
| GET | `/stocks/{symbol}/ai-summary/` | AI-generated analysis |
| GET | `/stocks/{symbol}/dividends/` | Dividend data |
| GET | `/screener/` | Screener with query params as filters |
| POST | `/screener/nl/` | Natural language search |
| GET | `/compare/?symbols=AAPL,MSFT` | Comparison data |
| GET | `/watchlists/presets/` | Pre-built watchlists (public, no auth) |

### Authenticated Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/signup/` | Create account |
| POST | `/auth/login/` | Get JWT tokens |
| POST | `/auth/refresh/` | Refresh access token |
| GET | `/watchlists/` | List user's watchlists |
| POST | `/watchlists/` | Create watchlist |
| PATCH | `/watchlists/{id}/` | Rename watchlist |
| DELETE | `/watchlists/{id}/` | Delete watchlist |
| POST | `/watchlists/{id}/stocks/` | Add stock to watchlist |
| DELETE | `/watchlists/{id}/stocks/{symbol}/` | Remove stock |
| GET | `/portfolio/` | Get holdings |
| POST | `/portfolio/` | Add holding |
| PATCH | `/portfolio/{id}/` | Edit holding |
| DELETE | `/portfolio/{id}/` | Remove holding |
| GET | `/portfolio/summary/` | Total value, gain/loss, allocation |
| GET | `/dcf/{symbol}/` | Get saved DCFs for stock |
| POST | `/dcf/{symbol}/` | Save DCF calculation |
| DELETE | `/dcf/{id}/` | Delete saved DCF |
| GET | `/recently-viewed/` | Last 10 viewed stocks |

---

## 4. Feature Specifications

### Feature 1: Stock Dashboard

**Route:** `/stocks/{symbol}`
**Auth:** Public (view). Auth adds: save to watchlist, save DCF, recently viewed tracking.
**This is the hero page — the most important page in the app.**

#### Layout (top to bottom):

**A) Company Header**
- Company name, ticker symbol, sector, industry
- Current EOD price, daily $ change, daily % change (green/red)
- Market cap (formatted: "$3.2T", "$450B", "$12.5M")
- Data source: merged view of FMP `/stable/profile` (company identity, sector, industry, description) + `/stable/quote` (price, change, changePercentage). Both cached in StockCache; identity fields stored in Stock model from profile, price fields from quote. If `/stable/quote` returns 402 for a valid symbol, fallback to profile's price/change/changePercentage. FMP `changePercentage` is in percent-points — backend divides by 100 before storing as decimal fraction.

**B) Price Chart**
- Line chart of EOD close prices
- Default view: 1 year
- Toggle buttons: 1Y / 3Y / 5Y
- Tooltip on hover: date + close price
- Dark mode compatible
- Data source: FMP `/stable/historical-price-eod/full?symbol={symbol}`

**C) Financial Charts**
Five charts, each showing 5 years of annual data:

| Chart | Data Points | Type |
|-------|------------|------|
| Revenue | Annual revenue | Bar chart |
| Net Income | Annual net income | Bar chart |
| EPS (Diluted) | Annual `epsDiluted` | Bar chart |
| Free Cash Flow | Annual `freeCashFlow` from cash flow statement | Bar chart |
| Margins | Gross, operating, net margin (%) | Multi-line chart |

Each chart:
- Interactive tooltip (year + value)
- YoY trend indicator on most recent year (see Feature 14)
- Responsive — stacks on mobile

Data source: FMP `/stable/income-statement?symbol={symbol}&period=annual`, `/stable/cash-flow-statement?symbol={symbol}&period=annual`

**D) Key Metrics Panel**
Grid of metric cards:

| Metric | FMP Field Name | FMP Endpoint | Format |
|--------|---------------|--------------|--------|
| P/E Ratio | `priceToEarningsRatio` | `/stable/ratios` | 25.4x |
| P/S Ratio | `priceToSalesRatio` | `/stable/ratios` | 8.2x |
| P/FCF | `priceToFreeCashFlowRatio` | `/stable/ratios` | 22.1x |
| ROE | `returnOnEquity` | `/stable/key-metrics` | 45.2% |
| Debt/Equity | `debtToEquityRatio` | `/stable/ratios` | 1.87 |
| Dividend Yield | `dividendYield` | `/stable/ratios` | 0.55% |
| Market Cap | `marketCap` | `/stable/profile` | $3.2T |
| Revenue Growth | Computed from income-statement, or use `/stable/financial-growth` → `revenueGrowth` | 8.5% |
| Net Income Growth | Computed from income-statement, or use `/stable/financial-growth` → `netIncomeGrowth` | 12.3% |

Each card shows:
- Current value
- YoY trend arrow (↑ green / ↓ red) with % change
- Extreme values visually highlighted (e.g., P/E > 50 gets amber, negative gets red)

Data source: **Two endpoints needed** — FMP `/stable/ratios?symbol={symbol}` (P/E, P/S, P/FCF, D/E, dividend yield) + `/stable/key-metrics?symbol={symbol}` (ROE, ROIC, FCF yield)

**E) Financial Health Score**
- Score: 0-100 displayed prominently
- Visual gauge (circular progress or horizontal bar, color-coded)
- "View Breakdown" expandable section showing category scores
- Full methodology in Feature 12

**F) AI Stock Summary**
- 3-5 paragraph plain-English analysis
- Label: "AI-generated summary — not financial advice"
- "Last updated: {date}" shown
- Full spec in Feature 11

**G) Dividend Analysis Section**
- Full spec in Feature 15
- Only shown if stock pays dividends (hide section if dividend_yield = 0)

**H) Embedded DCF Calculator**
- Compact version on dashboard
- "Open full DCF tool →" link to `/dcf/{symbol}`
- Full spec in Feature 7

**I) Recently Viewed Sidebar/Section**
- Shows last 10 stocks the user viewed
- Only for authenticated users
- Full spec in Feature 16

#### Edge Cases:
- **Stock not found:** 404 page with search prompt
- **FMP returns empty data:** Show "No financial data available for {symbol}"
- **Partial data (some endpoints fail):** Render available sections, show "Data unavailable" for failed sections — never block the whole page
- **Non-US stock:** Show available data but warn "Limited data — US stocks recommended"

---

### Feature 2: Financial Charts

Part of Stock Dashboard (Section C). No separate route.

#### Chart Requirements:
- 5 years of annual data (FMP free tier limit)
- Bar charts for absolute values (revenue, net income, EPS, FCF)
- Line chart for margins (gross, operating, net — all on one chart)
- Y-axis: formatted values ($XXB, $XXM for revenue; $XX.XX for EPS)
- X-axis: fiscal year (2021, 2022, 2023, 2024, 2025)
- Tooltip: exact value on hover
- Colors: consistent palette, dark mode aware
- Responsive: charts resize on mobile, legend below chart

#### Data Mapping:
```
Revenue         → /stable/income-statement → revenue
Net Income      → /stable/income-statement → netIncome
EPS (Diluted)   → /stable/income-statement → epsDiluted
Free Cash Flow  → /stable/cash-flow-statement → freeCashFlow
Gross Margin    → computed: grossProfit / revenue (from income-statement rows per year)
Operating Margin → computed: operatingIncome / revenue (from income-statement rows per year)
Net Margin      → computed: netIncome / revenue (from income-statement rows per year)
```

**Note:** `grossProfitRatio`, `operatingIncomeRatio`, `netIncomeRatio` are NOT returned by FMP `/stable/income-statement` on the verified free-tier key (Mar 2026). Historical 5Y margins must be computed from statement values. Latest snapshot margins are available from `/stable/ratios` (`grossProfitMargin`, `operatingProfitMargin`, `netProfitMargin`) and stored in `KeyMetric`.

#### Edge Cases:
- Fewer than 5 years of data: show what's available (no fake data)
- Negative values: bars go below zero line (red fill)
- Missing quarters: skip, don't interpolate

---

### Feature 3: Key Metrics Panel

Part of Stock Dashboard (Section D). No separate route.

Spec covered in Feature 1, Section D above.

---

### Feature 4: Stock Search

**Location:** Global navbar — visible on every page.

#### Behavior:
1. User types in search input
2. After 300ms debounce, fire `GET /api/v1/stocks/search/?q={input}`
3. Display dropdown with up to 10 results
4. Each result shows: ticker (bold) + company name + exchange
5. Keyboard navigation: ↑/↓ to select, Enter to navigate, Esc to close
6. Click or Enter → navigate to `/stocks/{symbol}`
7. Empty input → close dropdown
8. Minimum 1 character to trigger search

#### Data Source:
- **Primary:** Local DB search on seeded `stocks` table (matches ticker OR company name — instant, no API call)
- **Fallback:** FMP `GET /stable/search-name?query={query}` for non-seeded stocks (company name search only — `search-ticker` and `search` endpoints return 404 on free tier)
- Must search both exchanges: `&exchange=NASDAQ` and `&exchange=NYSE` for clean results
- Cached 30 days (ticker/name mappings are stable)

#### Edge Cases:
- No results: show "No stocks found for '{query}'"
- API error: show "Search unavailable" in dropdown
- Rate limited: show cached results if available, else "Search temporarily unavailable"
- Special characters: strip non-alphanumeric before sending

---

### Feature 5: User Authentication

#### Sign Up
- **Route:** `/signup`
- **Fields:** Email, password, confirm password
- **Validation:**
  - Email: valid format, unique
  - Password: 8+ characters minimum (Django's built-in validators)
- **On success:** Auto-login, redirect to landing or last viewed stock
- **Endpoint:** `POST /api/v1/auth/signup/` → returns JWT tokens

#### Login
- **Route:** `/login`
- **Fields:** Email, password
- **On success:** Store tokens, redirect to previous page or landing
- **Endpoint:** `POST /api/v1/auth/login/` → returns `{access, refresh, user}`

#### Token Management
- Access token: stored in Zustand (in-memory) — not localStorage (XSS risk)
- Refresh token + user snapshot `{id, email}`: stored in localStorage
- No cookies for auth in V1 (no HttpOnly cookie path)
- `ROTATE_REFRESH_TOKENS = True` — every refresh returns a new refresh token; client must replace the stored refresh token after each refresh
- Auto-refresh: Axios interceptor catches 401 → `POST /api/v1/auth/refresh/` with `{ "refresh": "<token>" }` in JSON body → store new access + refresh tokens → retry original request
- On refresh failure: clear access token, refresh token, and persisted user snapshot; redirect to login
- On page reload: restore user from localStorage immediately (UI shows logged-in state), then silently refresh access token via stored refresh token

#### Logout
- Clear access token (Zustand), refresh token (localStorage), and persisted user snapshot (localStorage)
- No server-side token blacklist in V1 (JWT is stateless)

#### Protected Routes
- `/watchlist`, `/portfolio`, `/dcf/{symbol}` (saving)
- Unauthenticated user trying to access → redirect to `/login` with return URL

#### Not in V1:
- No OAuth / social login
- No email verification
- No password reset (V1.5)
- No username (email-only)

---

### Feature 6: Watchlist

**Route:** `/watchlist`
**Auth:** Required

#### Capabilities:
- Create new watchlist (name, max 50 characters)
- Rename watchlist
- Delete watchlist (confirm dialog)
- Add stock to watchlist (via search or from stock dashboard "Add to Watchlist" button)
- Remove stock from watchlist
- Max 5 custom watchlists per user
- Max 50 stocks per watchlist

#### Watchlist Table Columns:

| Column | Source | Format |
|--------|--------|--------|
| Ticker | stocks table | AAPL |
| Company Name | stocks table | Apple Inc. |
| Price | stocks.last_price | $185.50 |
| Change % | stocks.price_change_pct | +1.2% (green/red) |
| Market Cap | stocks.market_cap | $3.2T |
| P/E | key_metrics.pe_ratio | 25.4x |
| Dividend Yield | key_metrics.dividend_yield | 0.55% |
| Health Score | health_scores.score | 78/100 |

#### Pre-Built Watchlists:

| Name | Stocks | Editable |
|------|--------|----------|
| FAANG+ | META, AAPL, AMZN, NFLX, GOOG, MSFT | Read-only |
| Dividend Aristocrats | ~10 selected (KO, JNJ, PG, MMM, etc.) | Read-only |
| S&P Top 10 | Top 10 by market cap | Read-only |

Pre-built lists:
- Seeded via management command
- `is_preset = true` in watchlists table
- All users see them, cannot modify
- Users can create their own lists with same stocks

#### UI:
- Tab or sidebar navigation between watchlists
- "Add to Watchlist" dropdown on stock dashboard (shows user's lists)
- Sort table by any column (client-side sort on cached data)

---

### Feature 7: DCF Calculator

**Routes:**
- Embedded on `/stocks/{symbol}` (compact mode)
- Full page at `/dcf/{symbol}` (expanded mode)

**Auth:** Public to calculate, auth required to save.

#### Two Modes:

**Mode 1: EPS-Based DCF**
```
Inputs:
  Current EPS (auto-filled from FMP)    — editable
  Growth Rate (%)                       — default: avg EPS growth over available years, capped at 20%
  Discount Rate (%)                     — default: 10%
  Terminal Multiple                     — default: 15x
  Projection Years                      — default: 10

Formula:
  For each year t (1 to n):
    Projected EPS(t) = Current EPS × (1 + growth_rate)^t
    Present Value(t) = Projected EPS(t) / (1 + discount_rate)^t

  Terminal Value = Projected EPS(n) × terminal_multiple
  PV of Terminal = Terminal Value / (1 + discount_rate)^n

  Intrinsic Value = Sum of PV(1..n) + PV of Terminal

Output:
  Intrinsic Value Per Share: $XXX.XX
  Current Price: $XXX.XX
  Margin of Safety: XX% = (Intrinsic - Price) / Intrinsic × 100
```

**Mode 2: FCF-Per-Share-Based DCF**
```
Same structure as EPS mode, but:
  Current FCF/Share (auto-filled)       — editable
  Uses FCF per share instead of EPS
  Terminal Multiple default: 18x (FCF multiples tend higher)
```

#### UI Elements:
- Toggle: EPS Mode / FCF Mode
- Sliders OR number inputs for: growth rate (0-25%), discount rate (5-20%), terminal multiple (5-30x), projection years (5-15)
- Live calculation — updates as inputs change (client-side math)
- Output: intrinsic value, current price, margin of safety (color-coded: green > 25%, yellow 0-25%, red < 0%)
- "Save" button (auth required) — saves inputs + result to server
- Table showing year-by-year projected values

#### Saved DCFs:
- `POST /api/v1/dcf/{symbol}/` saves: method, growth_rate, discount_rate, terminal_multiple, years_projected, fair_value_result, current_price_at_save
- `GET /api/v1/dcf/{symbol}/` returns user's saved DCFs for this stock
- `DELETE /api/v1/dcf/{id}/` removes a saved DCF
- Max 10 saved DCFs per user per stock

#### Default Value Logic:
- **Growth rate:** Average YoY EPS growth (or FCF growth) from available financial history. Capped at 20%, floored at 0%.
- **Discount rate:** Fixed 10% default. (Could use 10-Year Treasury + 6% risk premium, but keep it simple in V1.)
- **Terminal multiple:** 15x for EPS, 18x for FCF.
- **Years:** 10.

#### Edge Cases:
- Negative EPS/FCF: show warning "Current EPS is negative — DCF results may not be meaningful"
- No financial data: disable DCF, show "Financial data required for DCF calculation"
- Extreme inputs (growth 50%, multiple 100x): allow but show warning "Aggressive assumptions"

---

### Feature 8: Stock Comparison

**Route:** `/compare?symbols=AAPL,MSFT` (query param)
**Auth:** Public

#### Behavior:
1. User selects 2-3 stocks via search inputs
2. Page loads comparison view side by side
3. URL updates with symbols for shareability

#### Comparison Table:

| Metric | AAPL | MSFT | GOOG |
|--------|------|------|------|
| Price | $185.50 | $420.30 | $175.80 |
| Market Cap | $3.2T | $3.1T | $2.2T |
| P/E | 25.4x | 32.1x | 22.8x |
| P/S | 8.2x | 12.5x | 6.3x |
| P/FCF | 22.1x | 28.4x | 19.5x |
| ROE | 45.2% | 38.1% | 28.3% |
| Debt/Equity | 1.87 | 0.42 | 0.05 |
| Dividend Yield | 0.55% | 0.72% | 0.49% |
| Revenue Growth | 8.5% | 15.2% | 12.1% |
| Net Margin | 26.3% | 34.2% | 25.8% |
| Health Score | 78 | 82 | 85 |

- Best-in-comparison value per row highlighted (bold or green)
- Side-by-side charts: revenue, net income, EPS (same chart, different colors per stock)

#### Data Source:
- Same cached FMP data as stock dashboard
- Multiple symbols = multiple API requests (all cached)

#### Edge Cases:
- One symbol invalid: show data for valid ones, error badge for invalid
- Same stock twice: prevent in UI
- Only 1 stock selected: show single stock with "Add another stock to compare" prompt

---

### Feature 9: Portfolio Tracker

**Route:** `/portfolio`
**Auth:** Required

#### Add Holding:
- Fields: Stock (search autocomplete), shares (decimal, e.g., 10.5), avg cost per share ($)
- Validation: shares > 0, avg_cost > 0, stock must exist in FMP

#### Holdings Table:

| Column | Calculation |
|--------|-------------|
| Ticker | From holding |
| Company | From stocks table |
| Shares | User input |
| Avg Cost | User input |
| Current Price | stocks.last_price |
| Current Value | shares × current_price |
| Cost Basis | shares × avg_cost |
| Gain/Loss ($) | current_value - cost_basis |
| Gain/Loss (%) | (current_value - cost_basis) / cost_basis × 100 |

- Sort by any column
- Edit holding (change shares or avg cost)
- Delete holding (confirm dialog)

#### Summary Section:
- Total portfolio value: sum of all current_values
- Total cost basis: sum of all cost_bases
- Total gain/loss ($ and %)
- Sector allocation pie chart (sectors from stocks table)

#### Simplifications (V1):
- No transaction history — just current holdings
- No FIFO, no lots, no stock splits
- No dividend income tracking
- No benchmark comparison
- No performance over time chart
- Gain/loss = (current_price - avg_cost) × shares. Period.

#### Limits:
- Max 50 holdings per user
- Same stock can only appear once (edit to update shares/cost)

---

### Feature 10: Basic Screener

**Route:** `/screener`
**Auth:** Public

#### Data Pool:
- S&P 500 stocks pre-seeded in `key_metrics` table (phased: ~80–100 stocks in first days, growing to 500 over ~7 days of seeding)
- UI shows "Screening {pool_size} stocks" where `pool_size` = actual count of `KeyMetric.objects.filter(is_latest=True, stock__is_sp500=True).count()` — not hardcoded 500

#### Filters (10 total):

| Filter | Type | Options |
|--------|------|---------|
| Sector | Dropdown (multi-select) | Technology, Healthcare, Financial Services, Consumer Cyclical, Communication Services, Industrials, Consumer Defensive, Energy, Utilities, Real Estate, Basic Materials |
| Market Cap | Range selector | Nano (<$50M), Micro ($50M-$300M), Small ($300M-$2B), Mid ($2B-$10B), Large ($10B-$200B), Mega (>$200B) |
| P/E Ratio | Min/Max inputs | Suggested presets: <10, 10-15, 15-25, 25-50, >50 |
| Dividend Yield | Min/Max inputs | Presets: >1%, >2%, >3%, >5% |
| ROE | Minimum input | Presets: >5%, >10%, >15%, >25% |
| Debt/Equity | Maximum input | Presets: <0.5, <1.0, <2.0 |
| Revenue Growth | Minimum input | Presets: >0%, >5%, >10%, >25% |
| Net Income Growth | Minimum input | Same presets as revenue growth |
| Positive FCF | Toggle (yes/no) | FCF per share > 0 |
| Net Margin | Minimum input | Presets: >0%, >5%, >10%, >20% |

#### Results Table:

| Column | Sortable |
|--------|----------|
| Ticker | Yes |
| Company Name | Yes |
| Sector | Yes |
| Price | Yes |
| Market Cap | Yes |
| P/E | Yes |
| Dividend Yield | Yes |
| ROE | Yes |
| Debt/Equity | Yes |
| Revenue Growth | Yes |
| Net Margin | Yes |
| Health Score | Yes |

- Default sort: market cap descending
- Pagination: 25 results per page (server-side)
- Click row → navigate to `/stocks/{symbol}`
- Clear all filters button
- Show: "X results out of {pool_size} stocks" (pool_size = current seeded count, not hardcoded 500)
- Active filters shown as chips above results

#### All filtering and sorting is Django ORM on cached `key_metrics` table — no FMP calls.

---

### Feature 11: AI Stock Summary

**Location:** Stock Dashboard Section F
**Auth:** Public to view

#### Generation:
1. When dashboard loads, check `ai_summary_cache` for this symbol
2. If cached and `financial_data_hash` matches current data → return cached summary
3. If no cache or hash mismatch → generate:
   - Collect: revenue (5yr), net income (5yr), EPS (5yr), FCF (5yr), margins (5yr), key metrics (latest), company profile
   - Send to Claude Haiku with system prompt (below)
   - Store result in `ai_summary_cache` with data hash
4. Return summary to frontend

#### System Prompt:
```
You are a financial analyst writing a brief stock analysis for individual investors.

Given the financial data below, write a 3-5 paragraph analysis covering:
1. Business overview and recent financial trajectory
2. Profitability and margins trend
3. Cash flow and balance sheet health
4. Key strengths and concerns

Rules:
- Use plain English, no jargon without explanation
- Reference specific numbers from the data provided
- Never say "buy", "sell", "recommend", or "should invest"
- Never predict future stock price
- End with: "This is an AI-generated summary and should not be considered financial advice."
- Keep under 300 words
```

#### Display:
- Heading: "AI Analysis"
- Subtext: "Generated from {company_name}'s financial data"
- Summary text (markdown rendered)
- "Last updated: {generated_at}"
- Subtle label: "AI-generated — not financial advice"

#### Rate Limiting:
- Generate max 50 new summaries per UTC calendar day (across all users). Day resets at UTC midnight (`TIME_ZONE = "UTC"`).
- Tracked via DB count query: `AISummaryCache.objects.filter(generated_at__date=timezone.now().date()).count()`
- If limit reached **and stale cache exists:** return stale cached summary with `"status": "stale"` flag (still useful — financials don't change intraday)
- If limit reached **and no cache exists:** return 429 with `"status": "rate_limited"` message
- There are no background workers in V1. All generation is synchronous within the request.
- Cost control: ~$0.005/summary, 50/day = $0.25/day max = ~$7.50/month

#### Edge Cases:
- Insufficient financial data (< 2 years): skip AI summary, show "Not enough data for AI analysis"
- Haiku API error: show "AI summary temporarily unavailable", serve stale cache if exists
- Very new company: same as insufficient data

---

### Feature 12: Financial Health Score

**Location:** Stock Dashboard Section E
**Auth:** Public

#### Methodology: Composite 0-100 Score

**Category 1: Profitability (30 points)**

| Metric | Good (full) | Average (half) | Poor (zero) | Points |
|--------|-------------|----------------|-------------|--------|
| ROE | > 15% | 5-15% | < 5% | 10 |
| Net Margin | > 15% | 5-15% | < 5% | 8 |
| Positive Operating Cash Flow | Yes + growing YoY | Yes but declining | Negative | 7 |
| Earnings Quality (OCF > Net Income) | OCF > 1.1× NI | OCF ≈ NI | OCF < 0.8× NI | 5 |

**Category 2: Growth (20 points)**

| Metric | Good | Average | Poor | Points |
|--------|------|---------|------|--------|
| Revenue Growth (YoY) | > 10% | 3-10% | < 3% | 8 |
| EPS Growth (YoY) | > 10% | 3-10% | < 3% | 7 |
| FCF Growth (YoY) | > 10% | 0-10% | Negative | 5 |

**Category 3: Financial Strength (25 points)**

| Metric | Good | Average | Poor | Points |
|--------|------|---------|------|--------|
| Debt/Equity | < 0.5 | 0.5-1.0 | > 1.0 | 10 |
| FCF Yield (FCF/Share ÷ Price) | > 5% | 2-5% | < 2% | 8 |
| Positive Free Cash Flow | Yes | — | No | 7 |

**Category 4: Valuation (15 points)**

| Metric | Good | Average | Poor | Points |
|--------|------|---------|------|--------|
| P/E Ratio | < 15 | 15-25 | > 25 or negative | 5 |
| P/FCF Ratio | < 15 | 15-25 | > 25 | 5 |
| PEG Ratio (P/E ÷ EPS Growth) | < 1.0 | 1.0-2.0 | > 2.0 or N/A | 5 |

> **PEG Ratio:** Computed on-the-fly as `pe_ratio / eps_growth` from existing `KeyMetric` fields. Not stored as a separate column.

**Category 5: Efficiency (10 points)**

| Metric | Good | Average | Poor | Points |
|--------|------|---------|------|--------|
| Gross Margin Trend | Improving YoY | Flat (±1%) | Declining | 4 |
| Share Dilution | Buybacks (shares decreasing) | Flat | Diluting > 2%/yr | 3 |
| Operating Margin Trend | Improving YoY | Flat | Declining | 3 |

**Data source notes:**
- Gross/Operating margin trends: computed from `KeyMetric` rows (current vs prior fiscal year). `KeyMetric` margin fields are populated from `/stable/ratios` (`grossProfitMargin`, `operatingProfitMargin`, `netProfitMargin`) — NOT from FMP income-statement ratio fields (which are absent on free tier).
- Share dilution: computed from `FinancialStatement` JSON data → `weightedAverageShsOutDil` field in FMP income-statement. Compare consecutive years.

#### Score Interpretation:

| Range | Label | Color |
|-------|-------|-------|
| 80-100 | Excellent | Green |
| 60-79 | Good | Light Green |
| 40-59 | Fair | Yellow |
| 20-39 | Poor | Orange |
| 0-19 | Critical | Red |

#### Computation:
- Stored in `health_scores` table with JSON breakdown
- Primary path: recomputed in `stock_service.get_metrics()` after KeyMetric rows are saved/refreshed
- **Self-sufficient endpoint contract (no workers in V1):**
  - If `HealthScore` exists and `calculated_at` is after the latest `KeyMetric.fetched_at` and `FinancialStatement.fetched_at` for this stock → return cached score
  - If missing or stale → synchronously ensure KeyMetric + FinancialStatement data is fresh (via cache-through proxy), recompute score, save, then return
- Health score freshness is tied to **both** KeyMetric and FinancialStatement inputs, not only metrics refresh

#### V1 Note on Sector Adjustment:
- V1 uses absolute thresholds (not sector-adjusted)
- Known limitation: tech stocks may score lower on valuation, utilities lower on growth
- Sector-adjusted scoring is a V2 improvement
- Document this on the UI: "Score uses absolute thresholds across all sectors"

#### Edge Cases:
- Missing metric: that sub-score = 0, total max reduced proportionally
- Negative EPS: PEG ratio not applicable, score that sub-metric as 0
- < 2 years of data: show "Insufficient data for health score"

---

### Feature 13: Natural Language Search

**Location:** Top of screener page, above manual filters
**Route:** `/screener` (same page as manual screener)
**Auth:** Public

#### Flow:
```
1. User types: "tech stocks with P/E under 20 and positive free cash flow"
2. Frontend sends: POST /api/v1/screener/nl/ { "query": "..." }
3. Django validates: query length (5-200 chars), rate limit check
4. Django sends query to Claude Haiku with system prompt:

   System prompt:
   "You are a stock screener filter parser. Extract structured filters from
   natural language queries about stocks.

   Available filter fields:
     sector: string (one of: Technology, Healthcare, Financial Services,
       Consumer Cyclical, Communication Services, Industrials,
       Consumer Defensive, Energy, Utilities, Real Estate, Basic Materials)
     market_cap: number (in billions)
     pe_ratio: number
     ps_ratio: number
     pfcf_ratio: number
     roe: number (as decimal fraction, e.g., 0.15 means 15%)
     debt_to_equity: number
     dividend_yield: number (as decimal fraction, e.g., 0.02 means 2%)
     fcf_per_share: number
     eps: number
     revenue_growth: number (as decimal fraction, e.g., 0.10 means 10%)
     net_income_growth: number (as decimal fraction)
     gross_margin: number (as decimal fraction)
     operating_margin: number (as decimal fraction)
     net_margin: number (as decimal fraction)

   All percentage-based fields use decimal fractions matching the database format.
   Example: ROE of 15% = 0.15, dividend yield of 2% = 0.02.

   Available operators: gt, lt, gte, lte, eq
   For sector: use exact match (no operator needed)

   Return ONLY valid JSON. No explanation. No markdown.
   Format: { \"filters\": { ... } }
   If you cannot parse the query, return: { \"filters\": {}, \"error\": \"unparseable\" }"

5. Haiku returns JSON:
   {
     "filters": {
       "sector": "Technology",
       "pe_ratio": {"op": "lt", "value": 20},
       "fcf_per_share": {"op": "gt", "value": 0}
     }
   }

6. Django validates JSON:
   - All field names must be in allowed list
   - All operators must be in allowed list
   - All values must be numeric (except sector = string)
   - Percentage fields already in decimal fraction format (Haiku prompt enforces this)
   - If validation fails: return error

7. Django maps to ORM (values map directly — no conversion needed):
   KeyMetric.objects.filter(
     stock__sector="Technology",
     pe_ratio__lt=20,
     fcf_per_share__gt=0
   )

8. Response:
   {
     "interpreted_as": {
       "Sector": "Technology",
       "P/E Ratio": "< 20",
       "FCF/Share": "> 0"
     },
     "results": [...],
     "count": 12,
     "pool_size": 487,
     "query": "tech stocks with P/E under 20 and positive free cash flow"
   }
```

#### UI:
- Large text input: "Describe the stocks you're looking for..."
- Submit button + Enter key
- Loading state during Haiku call (typically < 1 second)
- Display interpreted filters as chips: "Sector: Technology" "P/E < 20" "FCF > 0"
- Same results table as manual screener
- "Not what you meant? Try the manual filters below."

#### Rate Limiting:
- Max 10 NL queries per user per hour (authenticated)
- Max 5 NL queries per IP per hour (unauthenticated)
- Max 200 NL queries total per UTC calendar day (system-wide cost control). Day resets at UTC midnight.
- All limits tracked via `NLSearchLog` model (DB counter queries, no django-ratelimit dependency)
- Show remaining queries: "X searches remaining"

#### Edge Cases:
- Unparseable query: "I couldn't understand that query. Try something like: 'tech stocks with P/E under 20' or 'high dividend stocks in energy sector'"
- Haiku returns invalid JSON: retry once, then show fallback message
- Haiku timeout (> 5 seconds): show error, suggest manual filters
- Query about unavailable data (e.g., "stocks with good analyst ratings"): Haiku returns `{ "filters": {}, "error": "unparseable" }`, show "I can filter by: sector, P/E, ROE, dividend yield, market cap, margins, growth rates, and FCF"
- Empty results: "No stocks match these criteria. Try broader filters."

---

### Feature 14: Trend Indicators

**Location:** Every metric on stock dashboard (charts, metrics panel)
**Auth:** Public

#### Calculation:
```
YoY Change % = (Current Year Value - Previous Year Value) / |Previous Year Value| × 100
```

#### Display:
- ↑ 12.3% (green) — value increased
- ↓ 5.2% (red) — value decreased
- → 0.0% (gray) — no change (within ±0.5%)

#### Applied To:
- Revenue, Net Income, EPS, FCF (on financial charts)
- All metrics in Key Metrics Panel
- Margins (on margin chart)

#### Edge Cases:
- Previous year value is 0: show "N/A" instead of infinity
- Previous year value is negative, current is positive: show "Turned Positive" (green)
- No previous year data: no arrow shown

---

### Feature 15: Dividend Analysis

**Location:** Stock Dashboard Section G (only if stock pays dividends)
**Auth:** Public

#### Display:

| Data Point | FMP Source | Format |
|------------|-----------|--------|
| Dividend Yield | `dividendYield` from `/stable/ratios` | 0.55% |
| Annual Dividend/Share | Computed from yield × price, or from `/stable/dividends` history | $0.96 |
| Payout Ratio | `dividendPayoutRatio` from `/stable/ratios` | 14.8% |
| Dividend Growth (YoY) | Computed from `/stable/dividends` history cached in `StockCache` JSON (2+ years required). Sum annual dividends per year, compute YoY change. | +5.2% |

#### Payout Ratio Health Indicator:
- < 30%: "Conservative" (green)
- 30-60%: "Healthy" (light green)
- 60-80%: "Elevated" (yellow)
- 80%+: "At Risk" (red)
- > 100%: "Unsustainable — paying more than earnings" (red, bold)

#### Edge Cases:
- No dividend (yield = 0): hide entire section
- Only 1 year of dividend data: show current year, no growth rate
- Negative EPS with positive dividend: payout ratio shown as "N/A — negative earnings"

---

### Feature 16: Recently Viewed + Pre-built Watchlists

**Auth:** Recently viewed requires auth. Pre-built watchlists are public.

#### Recently Viewed:
- Track last 10 unique stocks viewed by authenticated user
- Stored in `recently_viewed` table
- Displayed as: horizontal scroll of stock cards OR sidebar list
- Each card: ticker, company name, price, change %
- Click → navigate to stock dashboard
- Duplicate views: update `viewed_at`, don't create new entry
- **When shown:** On dashboard sidebar or landing page after login

#### Pre-built Watchlists:
- Seeded via `python manage.py seed_watchlists`
- Available to all users (including unauthenticated on screener/compare pages)
- Content:
  - **FAANG+:** META, AAPL, AMZN, NFLX, GOOG, MSFT
  - **Dividend Aristocrats (sample):** KO, JNJ, PG, PEP, WMT, MMM, ABT, EMR, CL, SYY
  - **S&P Top 10:** Top 10 by market cap (AAPL, MSFT, NVDA, AMZN, GOOG, META, BRK-B, LLY, AVGO, JPM — update during seeding). Note: FMP uses `BRK-B` (hyphen), not `BRK.B` (dot).
- On screener: "Quick filters" dropdown with pre-built list names
- On landing page: "Explore popular stocks" section

---

## 5. Non-Functional Requirements

These are mandatory. Not features — just the expected quality bar.

### Dark Mode
- Toggle in header navbar
- Persisted in localStorage
- Tailwind `dark:` classes
- All charts must be dark-mode aware (axis labels, gridlines, tooltips)
- Default: system preference (`prefers-color-scheme`)

### Responsive Design
- Breakpoints: 375px (mobile), 768px (tablet), 1024px+ (desktop)
- Mobile: single column, stacked charts, hamburger nav
- Tablet: 2-column where appropriate
- Desktop: full layout
- Charts: resize properly, touch-friendly tooltips on mobile
- Tables: horizontal scroll on mobile

### Loading States
- Skeleton screens for every data section (not spinners)
- Dashboard: skeleton for each section independently (header, chart, metrics, AI summary)
- Tables: skeleton rows
- Search: subtle loading indicator in input

### Error States
- API down: "Unable to load data. Please try again later." + retry button
- Stock not found: "We couldn't find '{symbol}'. Check the ticker and try again."
- Rate limited: "Too many requests. Please wait a moment."
- Network error: "Connection lost. Check your internet connection."
- Never show raw error messages or stack traces

### Empty States
- Watchlist: "Your watchlist is empty. Search for stocks to add." + search CTA
- Portfolio: "No holdings yet. Add your first stock." + add button
- Screener (no results): "No stocks match your filters. Try broader criteria."
- Recently viewed: don't show the section at all

### Legal & Attribution
- Footer on every page: "Not financial advice. Data provided by Financial Modeling Prep."
- AI summaries labeled: "AI-generated summary — not financial advice"
- Health score labeled: "Proprietary score — see methodology"
- Link to disclaimer page (simple static page)

### Meta & SEO
- `<title>` per page: "AAPL — Apple Inc. | StockLens", "Stock Screener | StockLens"
- Favicon
- OG tags: title, description, image (generic preview image for V1)
- Robots: allow indexing of public stock pages

---

## 6. Out of Scope & Completion

**V2+ exclusions and V1 completion checklist** — see `CLAUDE.md` (Deliberately Excluded, V1 Success Criteria).
