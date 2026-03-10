# StockLens — API Specification

> Status: **FINAL**
> Last updated: Mar 2026
> Base URL: `/api/v1/`
> All endpoints follow Django REST Framework conventions (trailing slash, JSON body/response).

---

## 1. Conventions

### Base URL
All endpoints are prefixed with `/api/v1/`. Examples use this prefix.

### Authentication
Protected endpoints require a JWT access token:
```
Authorization: Bearer <access_token>
```
Missing or invalid token → `401 Unauthorized`.

### Content Type
All request bodies: `Content-Type: application/json`
All responses: `Content-Type: application/json`

### Numeric Serialization
DRF's default `DecimalField` serializes decimal values as **JSON strings** (e.g. `"25.4000"`), not JSON numbers. `IntegerField` and `BigIntegerField` serialize as **JSON integers**. This is the V1 contract — do not override it.

- **DecimalField → JSON string:** ratios (`"25.4000"`), percentages/fractions (`"0.4520"`), per-share values (`"6.5700"`), prices (`"185.5000"`)
- **IntegerField / BigIntegerField → JSON integer:** market_cap (`3200000000000`), revenue, net_income, free_cash_flow, operating_cash_flow, volume, score
- **Percentage convention:** ROE, margins, growth rates, yields are stored as decimal fractions — `"0.4520"` means 45.2%, `"0.005500"` means 0.55%. Note: some metrics like ROE can exceed `"1.0000"` (100%) for highly-leveraged companies (e.g., `"1.4700"` = 147% ROE).

Formatting ($3.2T, 45.2%) is done **client-side**. Frontend TypeScript types must use `string` for all decimal-sourced fields, not `number`.

### Date Format
ISO 8601: `"2025-03-15"`. Timestamps: `"2025-03-15T10:30:00Z"`.

### Pagination
Paginated endpoints accept:
- `page` (integer, default: 1)
- `page_size` (integer, default: 25, max: 100)

Paginated response wrapper:
```json
{
  "count": 142,
  "next": "/api/v1/screener/?page=2",
  "previous": null,
  "results": [...]
}
```

### Standard Error Format
```json
{ "detail": "Not found." }
```
Validation errors use field names as keys:
```json
{ "email": ["A user with this email already exists."] }
```

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE success) |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (authenticated but no permission) |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

---

## 2. Public Endpoints

No `Authorization` header required.

---

### 2.1 Stock Search (Autocomplete)

```
GET /api/v1/stocks/search/?q={query}
```

**Description:** Autocomplete search. Searches local DB first (seeded S&P 500 stocks), falls back to FMP `search-name` for non-seeded stocks.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| q | string | Yes | Search term (ticker or company name). Min 1 char. |

**Response `200`:**
```json
{
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "sector": "Technology"
    },
    {
      "symbol": "AAPLX",
      "name": "Apple Growth Fund",
      "exchange": "NYSE",
      "sector": ""
    }
  ],
  "count": 2,
  "source": "local"
}
```

`source`: `"local"` (DB hit) or `"fmp"` (FMP fallback). Max 10 results.

**Errors:**
- `400` — `{ "detail": "Query parameter 'q' is required." }`

---

### 2.2 Stock Profile

```
GET /api/v1/stocks/{symbol}/
```

**Description:** Company profile and current EOD price. Merged view of FMP `/stable/profile` (identity fields: name, sector, industry, description, ceo, website) + `/stable/quote` (price fields: last_price, price_change, price_change_pct). Quote is preferred for price data; if quote returns 402 for a valid symbol, profile's price/change/changePercentage fields are used as fallback. Primary data for dashboard header.

**Path Parameters:** `symbol` — stock ticker (e.g. `AAPL`)

**Response `200`:**
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "exchange": "NASDAQ",
  "description": "Apple Inc. designs, manufactures, and markets smartphones...",
  "ceo": "Tim Cook",
  "website": "https://www.apple.com",
  "market_cap": 3200000000000,
  "last_price": "185.5000",
  "price_change": "2.1500",
  "price_change_pct": "0.0117",
  "is_sp500": true,
  "updated_at": "2025-03-15T16:00:00Z"
}
```

**Errors:**
- `404` — `{ "detail": "Stock 'XYZ' not found." }`
- `502` — FMP API unreachable during synchronous cache-through fetch

---

### 2.3 Financial Statements

```
GET /api/v1/stocks/{symbol}/financials/
```

**Description:** 5 years of annual income statement and cash flow data. Used for financial charts.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | `annual` | `annual` only in V1 |

**Response `200`:**
```json
{
  "symbol": "AAPL",
  "period": "annual",
  "income_statements": [
    {
      "fiscal_year": 2024,
      "revenue": 383285000000,
      "gross_profit": 169148000000,
      "operating_income": 114301000000,
      "net_income": 93736000000,
      "eps_diluted": "6.1100",
      "weighted_avg_shares_diluted": 15408095000,
      "gross_margin": "0.4413",
      "operating_margin": "0.2981",
      "net_margin": "0.2444"
    },
    {
      "fiscal_year": 2023,
      "revenue": 394328000000,
      "gross_profit": 169148000000,
      "operating_income": 114301000000,
      "net_income": 96995000000,
      "eps_diluted": "6.1300",
      "weighted_avg_shares_diluted": 15744231000,
      "gross_margin": "0.4408",
      "operating_margin": "0.2897",
      "net_margin": "0.2460"
    }
  ],
  "balance_sheets": [
    {
      "fiscal_year": 2024,
      "total_assets": 364980000000,
      "total_liabilities": 308030000000,
      "total_stockholders_equity": 56950000000,
      "total_debt": 108040000000,
      "cash_and_equivalents": 29965000000
    },
    {
      "fiscal_year": 2023,
      "total_assets": 352583000000,
      "total_liabilities": 290437000000,
      "total_stockholders_equity": 62146000000,
      "total_debt": 111088000000,
      "cash_and_equivalents": 29965000000
    }
  ],
  "cash_flow_statements": [
    {
      "fiscal_year": 2024,
      "operating_cash_flow": 118254000000,
      "free_cash_flow": 108807000000,
      "capital_expenditure": -9447000000
    },
    {
      "fiscal_year": 2023,
      "operating_cash_flow": 110543000000,
      "free_cash_flow": 99584000000,
      "capital_expenditure": -10959000000
    }
  ]
}
```

Returns up to 5 years per statement type. If fewer years are available, returns what exists. No padding with null rows.

**Margin fields (`gross_margin`, `operating_margin`, `net_margin`) are computed by the backend** from statement values (e.g. `grossProfit / revenue`), not read directly from FMP. FMP's `/stable/income-statement` does not return `grossProfitRatio`, `operatingIncomeRatio`, or `netIncomeRatio` on the verified free-tier key. The `weighted_avg_shares_diluted` field comes from FMP's `weightedAverageShsOutDil`.

The `balance_sheets` array contains key fields for reference; balance sheet data is stored as JSONField and may include additional FMP fields not listed here. The frontend financial charts only use income and cash flow data — balance sheet is included for completeness and future use.

**Errors:**
- `404` — stock not found
- `502` — FMP API unreachable during synchronous cache-through fetch

---

### 2.4 Key Metrics

```
GET /api/v1/stocks/{symbol}/metrics/
```

**Description:** Latest key metrics (P/E, ROE, etc.) with YoY trend. Populated from `/stable/ratios`, `/stable/key-metrics`, and `/stable/financial-growth`.

**Response `200`:**
```json
{
  "symbol": "AAPL",
  "fiscal_year": 2024,
  "period": "annual",
  "metrics": {
    "pe_ratio": "25.4000",
    "ps_ratio": "8.2000",
    "pfcf_ratio": "22.1000",
    "debt_to_equity": "1.8700",
    "dividend_yield": "0.005500",
    "dividend_payout_ratio": "0.1480",
    "gross_margin": "0.4413",
    "operating_margin": "0.2981",
    "net_margin": "0.2444",
    "fcf_per_share": "6.9200",
    "revenue_per_share": "24.8000",
    "roe": "1.4700",
    "roa": "0.2800",
    "roic": "0.5400",
    "market_cap": 3200000000000,
    "fcf_yield": "0.030000",
    "current_ratio": "0.9880",
    "revenue_growth": "0.0240",
    "net_income_growth": "-0.0319",
    "eps_growth": "-0.0016",
    "fcf_growth": "0.0920",
    "eps": "6.1100",
    "revenue": 383285000000,
    "net_income": 93736000000,
    "free_cash_flow": 108807000000,
    "operating_cash_flow": 118254000000
  },
  "trends": {
    "pe_ratio": { "prev_year": "26.1000", "change_pct": "-0.0268" },
    "roe": { "prev_year": "1.5600", "change_pct": "-0.0577" },
    "revenue_growth": { "prev_year": "-0.0274", "change_pct": null },
    "net_margin": { "prev_year": "0.2460", "change_pct": "-0.0065" },
    "eps": { "prev_year": "6.1300", "change_pct": "-0.0033" }
  }
}
```

`trends.{metric}.change_pct`: YoY change as decimal fraction (`-0.0268` = -2.68%). `null` if previous year is 0 or unavailable.

The example shows 5 trend fields for brevity. The full response includes trends for **all numeric metric fields** (pe_ratio, ps_ratio, pfcf_ratio, debt_to_equity, dividend_yield, gross_margin, operating_margin, net_margin, fcf_per_share, roe, roa, roic, fcf_yield, revenue_growth, net_income_growth, eps_growth, fcf_growth, eps). Fields with no prior-year data omit the key entirely.

**Errors:**
- `404` — stock not found
- `502` — FMP API unreachable during synchronous cache-through fetch

---

### 2.5 Price History

```
GET /api/v1/stocks/{symbol}/prices/
```

**Description:** EOD price history for the price chart. Returns close prices and volume.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| range | string | `1y` | `1y`, `3y`, or `5y` |

**Response `200`:**
```json
{
  "symbol": "AAPL",
  "range": "1y",
  "prices": [
    { "date": "2025-03-14", "close": "185.5000", "volume": 52340100 },
    { "date": "2025-03-13", "close": "183.2500", "volume": 48920000 },
    { "date": "2025-03-12", "close": "184.1000", "volume": 51230000 }
  ],
  "count": 252
}
```

Prices ordered newest-first. Frontend reverses for chart display (left = oldest, right = newest).

**Errors:**
- `404` — stock not found
- `502` — FMP API unreachable during synchronous cache-through fetch

---

### 2.6 Health Score

```
GET /api/v1/stocks/{symbol}/health-score/
```

**Description:** Financial health score (0-100) with category breakdown. Self-sufficient: if the score exists and is current, returns it. If missing or stale (inputs refreshed since last computation), synchronously ensures fresh KeyMetric + FinancialStatement data and recomputes before responding. No background workers involved.

**Response `200`:**
```json
{
  "symbol": "AAPL",
  "score": 78,
  "label": "Good",
  "breakdown": {
    "profitability": 25,
    "growth": 15,
    "strength": 20,
    "valuation": 10,
    "efficiency": 8
  },
  "max_scores": {
    "profitability": 30,
    "growth": 20,
    "strength": 25,
    "valuation": 15,
    "efficiency": 10
  },
  "calculated_at": "2025-03-15T10:00:00Z",
  "note": "Score uses absolute thresholds across all sectors."
}
```

Score labels: `Excellent` (80-100), `Good` (60-79), `Fair` (40-59), `Poor` (20-39), `Critical` (0-19).

**Errors:**
- `404` — stock not found
- `502` — FMP API unreachable during synchronous cache-through fetch
- `200` with `{ "score": null, "label": "Insufficient Data", ... }` if fewer than 2 years of data exist

---

### 2.7 AI Summary

```
GET /api/v1/stocks/{symbol}/ai-summary/
```

**Description:** AI-generated stock analysis from Claude Haiku. Returns cached summary if data hash unchanged; regenerates if financials updated.

**Response `200`:**
```json
{
  "symbol": "AAPL",
  "company_name": "Apple Inc.",
  "summary": "Apple Inc. has demonstrated consistent revenue generation... [300 words max]\n\nThis is an AI-generated summary and should not be considered financial advice.",
  "status": "cached",
  "model_used": "claude-haiku-4-5-20251001",
  "generated_at": "2025-03-10T08:30:00Z"
}
```

**Response `200` — freshly generated:**
```json
{
  "symbol": "AAPL",
  "company_name": "Apple Inc.",
  "summary": "Apple Inc. has demonstrated consistent revenue generation...",
  "status": "fresh",
  "model_used": "claude-haiku-4-5-20251001",
  "generated_at": "2025-03-10T08:30:00Z"
}
```

**Response `200` — stale (daily limit reached but cached summary exists):**
```json
{
  "symbol": "AAPL",
  "company_name": "Apple Inc.",
  "summary": "Apple Inc. has demonstrated consistent revenue generation...",
  "status": "stale",
  "model_used": "claude-haiku-4-5-20251001",
  "generated_at": "2025-02-20T08:30:00Z"
}
```

**Response `200` — insufficient data:**
```json
{
  "symbol": "NEWCO",
  "summary": null,
  "status": "unavailable",
  "message": "Not enough financial data for AI analysis (minimum 2 years required)."
}
```

**`status` is always present** in the response. Possible values: `cached`, `fresh`, `stale`, `unavailable`. All generation is **synchronous within the request** (no background workers in V1). If the hash matches, the cached summary is returned instantly. If a new summary is needed and the daily budget allows, it is generated in-request (~1-3 seconds).

**View transform:** The service (`ai_service.get_or_generate_summary`) returns `{summary_text, status, generated_at}`. The view adds `symbol`, `company_name`, `model_used` (from `AISummaryCache` row) and maps `summary_text` → `summary` for the API response.

**Errors:**
- `404` — stock not found
- `429` — system-wide daily limit reached (50 new generations/UTC calendar day, resets at UTC midnight) AND no cached summary exists: `{ "detail": "AI summary daily limit reached. No cached summary available." }`

---

### 2.8 Dividend Data

```
GET /api/v1/stocks/{symbol}/dividends/
```

**Description:** Dividend metrics for the dividend analysis section. Returns `null` data if stock pays no dividend.

**Response `200` — dividend-paying stock:**
```json
{
  "symbol": "AAPL",
  "pays_dividend": true,
  "dividend_yield": "0.005500",
  "annual_dividend_per_share": "0.9600",
  "dividend_payout_ratio": "0.1480",
  "payout_health": "Conservative",
  "dividend_growth_yoy": "0.0417",
  "fiscal_year": 2024
}
```

`payout_health`: `Conservative` (<30%), `Healthy` (30-60%), `Elevated` (60-80%), `At Risk` (80-100%), `Unsustainable` (>100%).
`dividend_growth_yoy`: null if only 1 year of dividend data.

**Response `200` — non-dividend stock:**
```json
{
  "symbol": "AMZN",
  "pays_dividend": false,
  "dividend_yield": null,
  "annual_dividend_per_share": null,
  "dividend_payout_ratio": null,
  "payout_health": null,
  "dividend_growth_yoy": null,
  "fiscal_year": null
}
```

**Errors:**
- `404` — stock not found
- `502` — FMP API unreachable during synchronous cache-through fetch

---

### 2.9 Screener

```
GET /api/v1/screener/
```

**Description:** Filter S&P 500 stocks using structured query params. All filtering is ORM on pre-cached `key_metrics` table — no FMP calls made.

**Query Parameters:**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| sector | string | Exact sector name | `Technology` |
| market_cap_min | integer | Minimum market cap (USD) | `10000000000` |
| market_cap_max | integer | Maximum market cap (USD) | `200000000000` |
| pe_ratio_min | decimal | Min P/E ratio | `5` |
| pe_ratio_max | decimal | Max P/E ratio | `20` |
| dividend_yield_min | decimal | Min yield (decimal fraction, e.g. `0.02` = 2%) | `0.02` |
| dividend_yield_max | decimal | Max yield | `0.05` |
| roe_min | decimal | Min ROE (decimal, e.g. `0.15` = 15%) | `0.15` |
| debt_to_equity_max | decimal | Max D/E ratio | `1.0` |
| revenue_growth_min | decimal | Min revenue growth YoY | `0.05` |
| net_income_growth_min | decimal | Min net income growth YoY | `0.05` |
| net_margin_min | decimal | Min net margin | `0.10` |
| positive_fcf | boolean | FCF per share > 0 | `true` |
| sort | string | Field to sort by | `market_cap` |
| order | string | `asc` or `desc` (default: `desc`) | `desc` |
| page | integer | Page number (default: 1) | `1` |

Valid `sort` values: `symbol`, `name`, `market_cap`, `pe_ratio`, `dividend_yield`, `roe`, `debt_to_equity`, `revenue_growth`, `net_margin`, `health_score`.

All filters are optional. Default: all seeded S&P 500 stocks, sorted by market cap descending. Target pool is 500; actual count depends on seeding progress.

**Response `200`:**
```json
{
  "count": 142,
  "next": "/api/v1/screener/?pe_ratio_max=20&page=2",
  "previous": null,
  "pool_size": 487,
  "active_filters": {
    "pe_ratio_max": 20
  },
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "sector": "Technology",
      "last_price": "185.5000",
      "market_cap": 3200000000000,
      "pe_ratio": "25.4000",
      "dividend_yield": "0.005500",
      "roe": "1.4700",
      "debt_to_equity": "1.8700",
      "revenue_growth": "0.0240",
      "net_margin": "0.2444",
      "health_score": 78
    }
  ]
}
```

`pool_size` is the **current** count of seeded S&P 500 stocks with `is_latest=True` KeyMetric rows — not hardcoded 500. During initial seeding it will be lower (e.g. 100-200). Target is 500 when seeding completes.

**Errors:**
- `400` — invalid filter value: `{ "pe_ratio_max": ["Must be a valid number."] }`
- `400` — invalid sort field: `{ "sort": ["Invalid sort field 'foobar'."] }`

---

### 2.10 Natural Language Screener

```
POST /api/v1/screener/nl/
```

**Description:** Parse a natural language query into structured filters via Claude Haiku, then run the screener.

**Rate Limits (DB counter via `NLSearchLog` model — no django-ratelimit):**
- Authenticated: 10 requests/user/hour
- Unauthenticated: 5 requests/IP/hour
- System-wide: 200 requests/UTC calendar day (resets at UTC midnight)

**Request Body:**
```json
{
  "query": "tech stocks with P/E under 20 and positive free cash flow"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| query | string | Yes | 5-200 characters |

**Pagination:** NL screener returns all matching results in one response, capped at 100. No page param — POST makes stateless pagination awkward. If `count` exceeds 100, add a `"truncated": true` flag and prompt the user to narrow down with manual filters.

**Response `200` — success:**
```json
{
  "query": "tech stocks with P/E under 20 and positive free cash flow",
  "interpreted_as": {
    "Sector": "Technology",
    "P/E Ratio": "< 20",
    "FCF/Share": "> 0"
  },
  "filters_applied": {
    "sector": "Technology",
    "pe_ratio_max": 20,
    "positive_fcf": true
  },
  "count": 28,
  "pool_size": 487,
  "truncated": false,
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "sector": "Technology",
      "last_price": "185.5000",
      "market_cap": 3200000000000,
      "pe_ratio": "18.4000",
      "dividend_yield": "0.005500",
      "roe": "1.4700",
      "debt_to_equity": "1.8700",
      "revenue_growth": "0.0240",
      "net_margin": "0.2444",
      "health_score": 78
    }
  ]
}
```

**Response `200` — unparseable query:**
```json
{
  "query": "stocks with good vibes",
  "interpreted_as": {},
  "filters_applied": {},
  "count": 0,
  "pool_size": 487,
  "results": [],
  "error": "unparseable",
  "message": "I couldn't understand that query. Try something like: 'tech stocks with P/E under 20' or 'high dividend stocks in the energy sector'. I can filter by: sector, P/E, ROE, dividend yield, market cap, margins, growth rates, and FCF."
}
```

**Errors:**
- `400` — `{ "query": ["This field is required."] }`
- `400` — `{ "query": ["Query must be between 5 and 200 characters."] }`
- `429` — `{ "detail": "Rate limit exceeded. You have 0 NL searches remaining this hour." }`
- `503` — `{ "detail": "AI service temporarily unavailable. Use manual filters below." }`

---

### 2.11 Stock Comparison

```
GET /api/v1/compare/?symbols=AAPL,MSFT,GOOG
```

**Description:** Side-by-side comparison data for 2-3 stocks.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| symbols | string | Yes | Comma-separated tickers, 2-3 stocks |

**Response `200`:**
```json
{
  "stocks": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "sector": "Technology",
      "last_price": "185.5000",
      "market_cap": 3200000000000,
      "pe_ratio": "25.4000",
      "ps_ratio": "8.2000",
      "pfcf_ratio": "22.1000",
      "roe": "1.4700",
      "debt_to_equity": "1.8700",
      "dividend_yield": "0.005500",
      "revenue_growth": "0.0240",
      "net_margin": "0.2444",
      "health_score": 78,
      "revenue_history": [
        { "fiscal_year": 2024, "revenue": 383285000000 },
        { "fiscal_year": 2023, "revenue": 394328000000 }
      ],
      "net_income_history": [
        { "fiscal_year": 2024, "net_income": 93736000000 },
        { "fiscal_year": 2023, "net_income": 96995000000 }
      ],
      "eps_history": [
        { "fiscal_year": 2024, "eps_diluted": "6.1100" },
        { "fiscal_year": 2023, "eps_diluted": "6.1300" }
      ]
    },
    {
      "symbol": "MSFT",
      "name": "Microsoft Corporation",
      "sector": "Technology",
      "last_price": "420.3000",
      "market_cap": 3100000000000,
      "pe_ratio": "32.1000",
      "ps_ratio": "12.5000",
      "pfcf_ratio": "28.4000",
      "roe": "0.3810",
      "debt_to_equity": "0.4200",
      "dividend_yield": "0.007200",
      "revenue_growth": "0.1520",
      "net_margin": "0.3420",
      "health_score": 82,
      "revenue_history": [
        { "fiscal_year": 2024, "revenue": 245122000000 }
      ],
      "net_income_history": [
        { "fiscal_year": 2024, "net_income": 88136000000 }
      ],
      "eps_history": [
        { "fiscal_year": 2024, "eps_diluted": "11.8000" }
      ]
    }
  ],
  "best_per_metric": {
    "pe_ratio": "AAPL",
    "roe": "AAPL",
    "debt_to_equity": "MSFT",
    "revenue_growth": "MSFT",
    "net_margin": "MSFT",
    "health_score": "MSFT"
  }
}
```

`best_per_metric` marks the best-in-comparison per row (lowest for pe/pfcf/ps/d_e, highest for roe/growth/margin/health_score).

**Errors:**
- `400` — `{ "detail": "symbols parameter requires 2-3 comma-separated tickers." }`
- `400` — `{ "detail": "Duplicate symbol: AAPL appears more than once." }`
- `207` (partial success) — if one symbol is invalid, valid stocks return with error entry:
```json
{
  "stocks": [ { "symbol": "AAPL", ... } ],
  "errors": [ { "symbol": "INVALID", "detail": "Stock 'INVALID' not found." } ]
}
```

---

## 3. Authentication Endpoints

No `Authorization` header required.

---

### 3.1 Sign Up

```
POST /api/v1/auth/signup/
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "confirm_password": "securepassword123"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| email | string | Yes | Valid email format, unique |
| password | string | Yes | 8+ characters |
| confirm_password | string | Yes | Must match password |

**Response `201`:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "user@example.com"
  }
}
```

**Errors:**
- `400` — email taken: `{ "email": ["A user with this email already exists."] }`
- `400` — password mismatch: `{ "confirm_password": ["Passwords do not match."] }`
- `400` — weak password: `{ "password": ["This password is too short. It must contain at least 8 characters."] }`

---

### 3.2 Login

```
POST /api/v1/auth/login/
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response `200`:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "email": "user@example.com"
  }
}
```

Access token lifetime: 60 minutes. Refresh token lifetime: 7 days.

**Errors:**
- `401` — `{ "detail": "No active account found with the given credentials." }`

---

### 3.3 Refresh Token

```
POST /api/v1/auth/refresh/
```

**Request Body:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `200`:**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

`ROTATE_REFRESH_TOKENS = True` — every refresh returns a new refresh token. Client must store the new one.

**Errors:**
- `401` — `{ "detail": "Token is invalid or expired." }`

---

## 4. Watchlist Endpoints

All require `Authorization: Bearer <token>`.

---

### 4.1 List Watchlists

```
GET /api/v1/watchlists/
```

**Description:** Returns all of the authenticated user's custom watchlists with their items.

**Response `200`:**
```json
[
  {
    "id": 14,
    "name": "My Tech Picks",
    "is_preset": false,
    "created_at": "2025-03-01T12:00:00Z",
    "stock_count": 5,
    "stocks": [
      {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "last_price": "185.5000",
        "price_change_pct": "0.0117",
        "market_cap": 3200000000000,
        "pe_ratio": "25.4000",
        "dividend_yield": "0.005500",
        "health_score": 78,
        "added_at": "2025-03-01T12:05:00Z"
      }
    ]
  }
]
```

---

### 4.2 Create Watchlist

```
POST /api/v1/watchlists/
```

**Request Body:**
```json
{
  "name": "My Tech Picks"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | 1-50 characters |

**Response `201`:**
```json
{
  "id": 14,
  "name": "My Tech Picks",
  "is_preset": false,
  "created_at": "2025-03-15T10:00:00Z",
  "stock_count": 0,
  "stocks": []
}
```

**Errors:**
- `400` — `{ "name": ["Watchlist name must be between 1 and 50 characters."] }`
- `400` — `{ "detail": "Maximum 5 custom watchlists per user." }`

---

### 4.3 Rename Watchlist

```
PATCH /api/v1/watchlists/{id}/
```

**Request Body:**
```json
{
  "name": "Renamed Watchlist"
}
```

**Response `200`:**
```json
{
  "id": 14,
  "name": "Renamed Watchlist",
  "is_preset": false,
  "updated_at": "2025-03-15T11:00:00Z"
}
```

**Errors:**
- `403` — trying to rename a preset watchlist
- `404` — watchlist not found or belongs to another user

---

### 4.4 Delete Watchlist

```
DELETE /api/v1/watchlists/{id}/
```

**Response `204` — No Content**

**Errors:**
- `403` — trying to delete a preset watchlist
- `404` — not found or belongs to another user

---

### 4.5 Add Stock to Watchlist

```
POST /api/v1/watchlists/{id}/stocks/
```

**Request Body:**
```json
{
  "symbol": "AAPL"
}
```

**Response `201`:**
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "added_at": "2025-03-15T10:00:00Z"
}
```

**Errors:**
- `400` — `{ "detail": "Maximum 50 stocks per watchlist." }`
- `400` — `{ "detail": "AAPL is already in this watchlist." }`
- `403` — trying to add to a preset watchlist
- `404` — watchlist not found
- `404` — `{ "detail": "Stock 'INVALID' not found." }`

---

### 4.6 Remove Stock from Watchlist

```
DELETE /api/v1/watchlists/{id}/stocks/{symbol}/
```

**Response `204` — No Content**

**Errors:**
- `403` — trying to remove from a preset watchlist
- `404` — stock not in this watchlist

---

### 4.7 Preset Watchlists

```
GET /api/v1/watchlists/presets/
```

**Description:** Returns the 3 pre-seeded watchlists. Public access (no auth required, but endpoint documented here for completeness). Auth header optional.

**Response `200`:**
```json
[
  {
    "id": 1,
    "name": "FAANG+",
    "is_preset": true,
    "stock_count": 6,
    "stocks": [
      {
        "symbol": "META",
        "name": "Meta Platforms Inc.",
        "last_price": "540.2000",
        "price_change_pct": "0.0085",
        "market_cap": 1380000000000,
        "pe_ratio": "27.1000",
        "dividend_yield": null,
        "health_score": 82
      }
    ]
  },
  {
    "id": 2,
    "name": "Dividend Aristocrats",
    "is_preset": true,
    "stock_count": 10,
    "stocks": [...]
  },
  {
    "id": 3,
    "name": "S&P Top 10",
    "is_preset": true,
    "stock_count": 10,
    "stocks": [...]
  }
]
```

---

## 5. Portfolio Endpoints

All require `Authorization: Bearer <token>`.

---

### 5.1 Get Holdings

```
GET /api/v1/portfolio/
```

**Description:** Returns all portfolio holdings with current value and gain/loss computed server-side.

**Response `200`:**
```json
[
  {
    "id": 23,
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "sector": "Technology",
    "shares": "10.500000",
    "avg_cost_per_share": "155.0000",
    "current_price": "185.5000",
    "current_value": "1947.7500",
    "cost_basis": "1627.5000",
    "gain_loss": "320.2500",
    "gain_loss_pct": "0.1968",
    "added_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-03-01T14:00:00Z"
  }
]
```

`gain_loss_pct` = `(current_value - cost_basis) / cost_basis`. Negative values indicate a loss.

---

### 5.2 Add Holding

```
POST /api/v1/portfolio/
```

**Request Body:**
```json
{
  "symbol": "AAPL",
  "shares": 10.5,
  "avg_cost_per_share": 155.00
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| symbol | string | Yes | Must exist in stocks table |
| shares | decimal | Yes | > 0, max 6 decimal places |
| avg_cost_per_share | decimal | Yes | > 0 |

**Response `201`:**
```json
{
  "id": 23,
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "sector": "Technology",
  "shares": "10.500000",
  "avg_cost_per_share": "155.0000",
  "current_price": "185.5000",
  "current_value": "1947.7500",
  "cost_basis": "1627.5000",
  "gain_loss": "320.2500",
  "gain_loss_pct": "0.1968",
  "added_at": "2025-03-15T10:00:00Z",
  "updated_at": "2025-03-15T10:00:00Z"
}
```

**Errors:**
- `400` — `{ "detail": "Maximum 50 holdings per user." }`
- `400` — `{ "detail": "You already have AAPL in your portfolio. Edit the existing holding instead." }`
- `400` — `{ "shares": ["Shares must be greater than 0."] }`
- `400` — `{ "avg_cost_per_share": ["Average cost must be greater than 0."] }`
- `404` — `{ "detail": "Stock 'INVALID' not found." }`

---

### 5.3 Edit Holding

```
PATCH /api/v1/portfolio/{id}/
```

**Request Body (partial update — any combination):**
```json
{
  "shares": 15.0,
  "avg_cost_per_share": 160.00
}
```

**Response `200`:**
```json
{
  "id": 23,
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "shares": "15.000000",
  "avg_cost_per_share": "160.0000",
  "current_price": "185.5000",
  "current_value": "2782.5000",
  "cost_basis": "2400.0000",
  "gain_loss": "382.5000",
  "gain_loss_pct": "0.1594",
  "updated_at": "2025-03-15T11:00:00Z"
}
```

**Errors:**
- `404` — holding not found or belongs to another user

---

### 5.4 Remove Holding

```
DELETE /api/v1/portfolio/{id}/
```

**Response `204` — No Content**

**Errors:**
- `404` — not found or belongs to another user

---

### 5.5 Portfolio Summary

```
GET /api/v1/portfolio/summary/
```

**Description:** Aggregate portfolio stats and sector allocation.

**Response `200`:**
```json
{
  "total_value": "45820.50",
  "total_cost_basis": "38250.00",
  "total_gain_loss": "7570.50",
  "total_gain_loss_pct": "0.1979",
  "holdings_count": 8,
  "sector_allocation": [
    {
      "sector": "Technology",
      "value": "28400.00",
      "weight": "0.6198",
      "holdings_count": 3
    },
    {
      "sector": "Healthcare",
      "value": "9800.00",
      "weight": "0.2139",
      "holdings_count": 2
    },
    {
      "sector": "Consumer Cyclical",
      "value": "7620.50",
      "weight": "0.1663",
      "holdings_count": 3
    }
  ]
}
```

`weight` = sector value / total value. Sector allocations sum to 1.0.

**Response `200` — empty portfolio:**
```json
{
  "total_value": "0.00",
  "total_cost_basis": "0.00",
  "total_gain_loss": "0.00",
  "total_gain_loss_pct": "0.0000",
  "holdings_count": 0,
  "sector_allocation": []
}
```

---

## 6. DCF Endpoints

All require `Authorization: Bearer <token>`.

---

### 6.1 Get Saved DCFs for a Stock

```
GET /api/v1/dcf/{symbol}/
```

**Response `200`:**
```json
[
  {
    "id": 7,
    "symbol": "AAPL",
    "method": "eps",
    "growth_rate": "0.1200",
    "discount_rate": "0.1000",
    "terminal_multiple": "15.00",
    "years_projected": 10,
    "fair_value_result": "198.4500",
    "current_price_at_save": "185.5000",
    "margin_of_safety": "0.0653",
    "created_at": "2025-03-10T09:30:00Z"
  },
  {
    "id": 8,
    "symbol": "AAPL",
    "method": "fcf",
    "growth_rate": "0.0900",
    "discount_rate": "0.1000",
    "terminal_multiple": "18.00",
    "years_projected": 10,
    "fair_value_result": "210.2000",
    "current_price_at_save": "185.5000",
    "margin_of_safety": "0.1175",
    "created_at": "2025-03-12T14:00:00Z"
  }
]
```

`margin_of_safety` = `(fair_value_result - current_price_at_save) / fair_value_result`. Negative = overvalued at time of save.

Returns `[]` if user has no saved DCFs for this stock.

**Errors:**
- `404` — stock not found

---

### 6.2 Save DCF Calculation

```
POST /api/v1/dcf/{symbol}/
```

**Request Body:**
```json
{
  "method": "eps",
  "growth_rate": 0.12,
  "discount_rate": 0.10,
  "terminal_multiple": 15.0,
  "years_projected": 10,
  "fair_value_result": 198.45,
  "current_price_at_save": 185.50
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| method | string | Yes | `"eps"` or `"fcf"` |
| growth_rate | decimal | Yes | 0.0 – 1.0 (i.e. 0% – 100%) |
| discount_rate | decimal | Yes | 0.0 – 1.0 |
| terminal_multiple | decimal | Yes | 1.0 – 100.0 |
| years_projected | integer | Yes | 1 – 30 |
| fair_value_result | decimal | Yes | Result of client-side DCF calculation |
| current_price_at_save | decimal | Yes | Current price snapshot |

**Response `201`:**
```json
{
  "id": 7,
  "symbol": "AAPL",
  "method": "eps",
  "growth_rate": "0.1200",
  "discount_rate": "0.1000",
  "terminal_multiple": "15.00",
  "years_projected": 10,
  "fair_value_result": "198.4500",
  "current_price_at_save": "185.5000",
  "margin_of_safety": "0.0653",
  "created_at": "2025-03-15T10:00:00Z"
}
```

**Errors:**
- `400` — `{ "detail": "Maximum 10 saved DCFs per stock. Delete one to save another." }`
- `400` — `{ "method": ["Must be 'eps' or 'fcf'."] }`
- `404` — stock not found

---

### 6.3 Delete Saved DCF

```
DELETE /api/v1/dcf/{id}/
```

Note: `{id}` is the DCF calculation ID (integer), not the symbol.

**Response `204` — No Content**

**Errors:**
- `404` — not found or belongs to another user

---

## 7. Recently Viewed

Requires `Authorization: Bearer <token>`.

---

### 7.1 Get Recently Viewed

```
GET /api/v1/recently-viewed/
```

**Description:** Returns the last 10 stocks viewed by the authenticated user, most recent first.

**Response `200`:**
```json
[
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "sector": "Technology",
    "last_price": "185.5000",
    "price_change_pct": "0.0117",
    "viewed_at": "2025-03-15T14:30:00Z"
  },
  {
    "symbol": "MSFT",
    "name": "Microsoft Corporation",
    "sector": "Technology",
    "last_price": "420.3000",
    "price_change_pct": "-0.0042",
    "viewed_at": "2025-03-15T12:00:00Z"
  }
]
```

Max 10 entries. Empty array if user has viewed no stocks.

**Side Effect (implicit):** The stock dashboard endpoint (`GET /api/v1/stocks/{symbol}/`) triggers a recently viewed upsert server-side for authenticated requests. The frontend does not call a separate "track view" endpoint.

---

## 8. Endpoint Summary

### Public (12)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stocks/search/?q=` | Autocomplete search |
| GET | `/stocks/{symbol}/` | Profile + current price |
| GET | `/stocks/{symbol}/financials/` | Income, balance sheet + cash flow statements (5yr) |
| GET | `/stocks/{symbol}/metrics/` | Key metrics + trends |
| GET | `/stocks/{symbol}/prices/` | EOD price history |
| GET | `/stocks/{symbol}/health-score/` | Health score + breakdown |
| GET | `/stocks/{symbol}/ai-summary/` | AI-generated analysis |
| GET | `/stocks/{symbol}/dividends/` | Dividend data |
| GET | `/screener/` | Manual screener with ORM filters |
| POST | `/screener/nl/` | Natural language screener |
| GET | `/compare/?symbols=` | Side-by-side comparison |
| GET | `/watchlists/presets/` | Get preset watchlists (public, no auth required) |

### Authenticated (18)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/signup/` | Create account |
| POST | `/auth/login/` | Get JWT tokens |
| POST | `/auth/refresh/` | Refresh access token |
| GET | `/watchlists/` | List user watchlists |
| POST | `/watchlists/` | Create watchlist |
| PATCH | `/watchlists/{id}/` | Rename watchlist |
| DELETE | `/watchlists/{id}/` | Delete watchlist |
| POST | `/watchlists/{id}/stocks/` | Add stock to watchlist |
| DELETE | `/watchlists/{id}/stocks/{symbol}/` | Remove stock from watchlist |
| GET | `/portfolio/` | Get holdings |
| POST | `/portfolio/` | Add holding |
| PATCH | `/portfolio/{id}/` | Edit holding |
| DELETE | `/portfolio/{id}/` | Remove holding |
| GET | `/portfolio/summary/` | Total value + sector allocation |
| GET | `/dcf/{symbol}/` | Get saved DCFs for a stock |
| POST | `/dcf/{symbol}/` | Save DCF calculation |
| DELETE | `/dcf/{id}/` | Delete saved DCF |
| GET | `/recently-viewed/` | Last 10 viewed stocks |

---

## 9. Django URL Configuration

```python
# config/urls.py
from django.urls import path, include

urlpatterns = [
    path("api/v1/auth/",         include("apps.users.urls")),
    path("api/v1/stocks/",       include("apps.stocks.urls")),
    path("api/v1/screener/",     include("apps.screener.urls")),
    path("api/v1/compare/",      include("apps.stocks.compare_urls")),
    path("api/v1/watchlists/",   include("apps.watchlists.urls")),
    path("api/v1/portfolio/",    include("apps.portfolio.urls")),
    path("api/v1/dcf/",          include("apps.stocks.dcf_urls")),
    path("api/v1/recently-viewed/", include("apps.stocks.recently_viewed_urls")),
]
```

```python
# apps/stocks/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("search/",                            views.StockSearchView.as_view()),
    path("<str:symbol>/",                      views.StockProfileView.as_view()),
    path("<str:symbol>/financials/",           views.StockFinancialsView.as_view()),
    path("<str:symbol>/metrics/",              views.StockMetricsView.as_view()),
    path("<str:symbol>/prices/",               views.StockPricesView.as_view()),
    path("<str:symbol>/health-score/",         views.StockHealthScoreView.as_view()),
    path("<str:symbol>/ai-summary/",           views.StockAISummaryView.as_view()),
    path("<str:symbol>/dividends/",            views.StockDividendsView.as_view()),
]
```

```python
# apps/stocks/dcf_urls.py
from django.urls import path
from . import views

# IMPORTANT: <int:pk> must come before <str:symbol> so integer IDs (delete)
# are not captured by the broader string pattern.
urlpatterns = [
    path("<int:pk>/",      views.DCFDeleteView.as_view()),     # DELETE /dcf/7/
    path("<str:symbol>/",  views.DCFListCreateView.as_view()), # GET/POST /dcf/AAPL/
]
```

```python
# apps/watchlists/urls.py
from django.urls import path
from . import views

# IMPORTANT: "presets/" must come before "<int:pk>/" so it is not captured as an ID.
urlpatterns = [
    path("",                                   views.WatchlistListCreateView.as_view()),  # GET, POST
    path("presets/",                           views.WatchlistPresetsView.as_view()),     # GET
    path("<int:pk>/",                          views.WatchlistDetailView.as_view()),      # PATCH, DELETE
    path("<int:pk>/stocks/",                   views.WatchlistStocksView.as_view()),      # POST
    path("<int:pk>/stocks/<str:symbol>/",      views.WatchlistStockDetailView.as_view()), # DELETE
]
```

---

## 10. Notes for Implementation

### Recently Viewed — Implicit Tracking
The `GET /stocks/{symbol}/` view triggers a recently viewed upsert for authenticated requests. No separate tracking endpoint needed. Logic:
```python
if request.user.is_authenticated:
    stock_service.record_view(user=request.user, stock=stock)
```

### DCF — Client-Side Math, Server-Side Storage
The DCF calculation itself runs in the browser (React state, no API call). The server only stores the result. Endpoint `POST /dcf/{symbol}/` accepts the already-calculated `fair_value_result`.

### Screener — ORM Only
The screener never calls FMP. All filtering is on `is_latest=True` rows only (one row per stock, most recent fiscal year):
```python
KeyMetric.objects.select_related("stock").filter(
    period="annual",
    is_latest=True,              # ← prevents duplicate rows across fiscal years
    stock__is_sp500=True,
    pe_ratio__lte=20,
    stock__sector="Technology",
    fcf_per_share__gt=0,
).order_by("-market_cap")
```

### Screener `sort=health_score` — Subquery Required
`health_score` lives in the `health_scores` table, not `key_metrics`. Sorting by it requires a subquery annotation:
```python
from django.db.models import OuterRef, Subquery
from apps.ai.models import HealthScore

queryset = KeyMetric.objects.select_related("stock").filter(...).annotate(
    health_score=Subquery(
        HealthScore.objects.filter(stock=OuterRef("stock")).values("score")[:1]
    )
).order_by("-health_score")
```
All other sort fields are direct `key_metrics` or `stocks` columns — no annotation needed.

### NL Screener — JSON Validation Before ORM
Claude Haiku's JSON output is validated before reaching the ORM. All field names and operators are checked against an allowlist. Claude never generates SQL or ORM code — only filter values.

### Health Score — Self-Sufficient Endpoint
`GET /health-score/` reads from the `health_scores` table. If the stored score is current (i.e. `calculated_at` is after the latest `KeyMetric.fetched_at` and `FinancialStatement.fetched_at` for this stock), it is returned directly. If missing or stale, the view synchronously ensures fresh inputs via the cache-through proxy, recomputes the score, saves it, then responds. Primary recomputation also occurs in the service layer when `KeyMetric` data is saved or refreshed via `stock_service.get_metrics()`.

### AI Summary — Hash-Based Regen, Synchronous
`GET /ai-summary/` checks `AISummaryCache.financial_data_hash` against `MD5(json.dumps(current_financials))`. If hash matches → return cached. If hash changed and daily budget allows → generate synchronously within the request (no workers). If daily limit reached and stale cache exists → return stale with `"status": "stale"`. If daily limit reached and no cache → return 429. If insufficient data (< 2yr) → return `"status": "unavailable"`.
