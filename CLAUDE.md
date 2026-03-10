# StockLens — Investment Research Platform

> Qualtrim-inspired stock analysis platform built by a solo engineer.
> **Primary goal:** Outstanding resume/portfolio project.
> **Secondary:** Potential side revenue via freemium ($5-10/mo gates in V1.5).
> **Inspired by:** Joseph Carlson's Qualtrim ($9.99/mo, 12K+ users, ~$1.4M/yr)

---

## Read Before Working

Before making any decisions or writing code, **read `CLAUDE_DOCS/research.md`** first. It's the source of truth — covering data sources (verified FMP endpoints), caching design, data model (13 tables), V1 scope, NL search architecture, costs, timeline, and risks. Do NOT re-derive or re-debate decisions documented there.

```
CLAUDE_DOCS/research.md     — FINAL ✓  (read first)
CLAUDE_DOCS/features.md     — FINAL ✓  (endpoints verified Mar 2026)
CLAUDE_DOCS/architecture.md — FINAL ✓
CLAUDE_DOCS/techstack.md    — FINAL ✓
CLAUDE_DOCS/schema.md       — FINAL ✓
CLAUDE_DOCS/api-spec.md     — FINAL ✓
CLAUDE_DOCS/buildplan.md    — FINAL ✓  (6-week plan, start Week 1)
CLAUDE_DOCS/progress.md     — LIVE    (read + update every session)
```

---

## User Preferences & Workflow

### Doc Workflow
GPT generates first draft → `GPT_DOCS/`. Claude refines with **own independent research** → `CLAUDE_DOCS/`. Iterate until approved. `CLAUDE_DOCS/` is the source of truth.

**When refining GPT docs:**
- Do your own web research — verify API pricing, check real user reviews, find competitors
- Challenge GPT's vagueness — replace "use a financial API" with "FMP free tier, 250 calls/day, these endpoints"
- Add concrete details GPT omits — exact endpoints, pricing, schema designs
- Remove fluff — no "this is important because..." padding
- Verify claims against actual pricing pages

### Hard Rules
- **No Next.js** — React + Django. Do not suggest Next.js.
- **No over-engineering** — No Celery, no Redis, no microservices in V1.
- **Ambitious scope** — 16 features in V1. Do not reduce scope without being asked.
- **Portfolio is deliberately simplified** — avg cost × shares. No FIFO/lots/splits. Debated and decided.
- **Update this CLAUDE.md** when docs are completed or decisions change.

---

## Current Status

- **Phase:** Implementation — Week 1
- **All docs FINAL:** research.md, features.md, architecture.md, techstack.md, schema.md, api-spec.md, buildplan.md, progress.md
- **Current task:** Week 1 — Django project setup + CustomUser + auth endpoints + React scaffold
- **Build guide:** Follow `CLAUDE_DOCS/buildplan.md` week by week. Schema in `schema.md`, API shapes in `api-spec.md`.
- **FMP API:** All endpoints use `/stable/` format (v3 is dead). Tested with real API key Mar 2026. See research.md Section 3.2.

---

## Tech Stack (DECIDED)

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React (Vite) + TypeScript + Tailwind CSS | **Decided** |
| UI Components | Shadcn/ui + TanStack Table | **Decided** |
| Charts | TradingView Lightweight Charts (price) + Recharts (financial) | **Decided** |
| Backend | Django + Django REST Framework | **Decided** |
| Auth | SimpleJWT (JWT for SPA) | **Decided** |
| Database | PostgreSQL | **Decided** |
| Caching | Custom DB-backed cache (StockCache model in V1, Redis in V1.5) | **Decided** |
| AI | Claude Haiku 4.5 via Anthropic API | **Decided** |
| Task Queue | None in V1. Celery + Redis deferred to V2. | **Decided** |
| Deployment | Render (backend) + Neon (PostgreSQL) + Vercel (frontend) | **Decided** |
| Testing | pytest + factory_boy (backend), vitest + RTL + MSW (frontend) | **Decided** |
| State Management | TanStack Query v5 (server state) + Zustand (client state) | **Decided** |

---

## V1 Scope (16 Features, ~6 weeks)

### Core (1-10)
1. **Stock Dashboard** — price chart + financials + metrics + AI summary + health score
2. **Financial Charts** — revenue, net income, EPS, FCF, margins — 5yr, interactive
3. **Key Metrics Panel** — P/E, P/S, P/FCF, debt/equity, ROE, dividend yield, market cap
4. **Stock Search** — autocomplete, debounced, works without auth
5. **User Auth** — JWT via SimpleJWT, sign up / log in, protected routes
6. **Watchlist** — save stocks, pre-built lists (FAANG, Dividend Aristocrats, S&P Top 10)
7. **DCF Calculator** — EPS + FCF modes, auto-fill from API, saved per user
8. **Stock Comparison** — 2-3 stocks side by side
9. **Portfolio Tracker** — shares × avg cost, gain/loss, sector allocation (no FIFO/splits/lots)
10. **Basic Screener** — S&P 500 pre-cached, 8-10 filters, sortable results

### AI + Intelligence (11-14)
11. **AI Stock Summary** — Claude Haiku on cached financials, cached until data changes
12. **Financial Health Score** — 0-100 composite (P/E, debt/equity, ROE, FCF growth, margins)
13. **Natural Language Search** — LLM parses query → structured filters → ORM query → transparent results
14. **Trend Indicators** — YoY green/red arrows on every metric

### Polish (15-16)
15. **Dividend Analysis** — yield, payout ratio, growth rate, consecutive years
16. **Recently Viewed + Pre-built Watchlists** — last 10 viewed, seed content on first login

### Quality Baseline (expected, not counted as features)
Landing page, dark mode, responsive (375px+), skeleton loading, error/empty states, "Not financial advice" footer, "Data by FMP" attribution, meta tags, favicon, OG tags.

---

## V1 Success Criteria

V1 is done when a user can:
1. Search any US stock by ticker or name
2. View a dashboard with charts, metrics, trend arrows, health score, dividend analysis, and AI summary
3. Run a DCF valuation with auto-filled data and save it
4. Save stocks to watchlists (with pre-built lists on first login)
5. Track a portfolio with holdings, gain/loss, and sector allocation
6. Screen S&P 500 stocks using manual filters or natural language
7. Compare 2-3 stocks side by side
8. All above works on mobile, in dark mode, with proper loading/error/empty states

---

## Deliberately Excluded from V1 (DO NOT BUILD)

| Feature | Why |
|---------|-----|
| Earnings Calendar | Requires second API (Finnhub) |
| Background Data Refresh | Requires Celery + Redis |
| Earnings Transcripts | Needs paid API ($10-79/mo) |
| Advanced Screener (40+ filters) | Needs full US stock ingestion |
| Mobile Apps | Web-first. V2. |
| News / Sentiment | Different data source |
| Dip Finder / Price Alerts | Needs Celery + notifications |
| Portfolio Performance Chart | Complex time-weighted math. V2. |
| Public API / Export / Learn Mode | V2 features |
| Revenue by Segment | FMP paid tier only |

---

## Key Architecture Decisions (FINAL)

- **Single API (FMP)** — no Finnhub in V1. One data source = simpler.
- **Cache-through proxy** — Django caches all FMP responses with TTL (12hr-30d). Frontend never calls FMP directly.
- **S&P 500 seeding** — hardcoded ticker list (FMP `sp500-constituent` restricted). Screener-ready seed (3 calls/stock) in ~6 days. Full data fetched on-demand per stock visit.
- **No Celery/Redis in V1** — custom DB-backed StockCache table only.
- **AI cached with data hash** — regenerate only when financials change.
- **Portfolio simplified** — avg cost × shares. No lots, splits, or transaction history.
- **NL Search** — Haiku parses query → JSON filters → ORM. LLM never generates data. ~$0.001/query.
- **Django apps:** `stocks/`, `users/`, `watchlists/`, `portfolio/`, `screener/`, `ai/`
- **Frontend pages:** Landing, Dashboard, Search, Watchlist, DCF, Compare, Screener, Portfolio

---

## Important Constraints

- FMP free tier: 250 calls/day — caching is the #1 backend concern
- EOD data only (no real-time — same as Qualtrim)
- 5-year history on free tier ($19/mo unlocks 30+ years)
- AI costs ~$2-10/mo (all cached)
- Mock/fixture data for dev — never burn API calls on UI work
- API keys server-side only (.env, never in frontend)
- CORS: React (localhost:5173) ↔ Django (localhost:8000)
- "Not financial advice" + "Data by FMP" on every page

---

## Resolved Questions (all decided — do not re-litigate)

1. ~~Shadcn/ui vs Ant Design?~~ — **Resolved:** Shadcn/ui + TanStack Table.
2. ~~Recharts vs TradingView Lightweight Charts?~~ — **Resolved:** TradingView Lightweight Charts (price) + Recharts (financial).
3. ~~Frontend state management?~~ — **Resolved:** TanStack Query v5 (server) + Zustand (client).
4. ~~Health score methodology~~ — **Resolved in features.md** (5 categories, 13 metrics, 100 points).
5. ~~Docker Compose for local dev?~~ — **Resolved:** No Docker. PostgreSQL via `brew install postgresql@16`.
6. ~~Auth token storage?~~ — **Resolved:** Access token in Zustand (in-memory). Refresh token + user `{id, email}` in localStorage. No cookies for auth in V1.
7. ~~Deployment?~~ — **Resolved:** Render (backend) + Neon (PostgreSQL) + Vercel (frontend). See architecture.md §15.

---

## Decisions Made Through Debate

Context so new sessions don't re-litigate:

| Decision | Why |
|----------|-----|
| **16 features in V1** | Claude cut to 7, user pushed back. All 16 are feasible — portfolio is CRUD, screener uses pre-cached data. |
| **Cut Earnings Calendar** | Second API (Finnhub) not worth arch complexity for a date list. |
| **Cut Background Refresh** | Celery infra invisible to users. Cache-through handles freshness. |
| **No Next.js** | User vetoed. React + Django = clearer separation, better resume signal, Python for financial logic. |
| **NL Search replaces Public Stock Pages** | User swapped them. High wow-factor, cheap (~$0.001/query), no hallucination. |
| **FMP `/stable/` endpoints only** | Tested Mar 2026: all `/api/v3/` endpoints are dead ("Legacy Endpoint" error). V1-required endpoints verified live (Mar 10, 2026). Ticker search broken (404) — use local DB + `search-name`. S&P 500 list hardcoded (402). |
| **Dual endpoint for metrics** | P/E, margins, dividend yield in `/stable/ratios`. ROE, ROIC, FCF yield in `/stable/key-metrics`. Need both per stock. |

---

## Folder Structure

```
Hitesh_Investment_Project/
├── CLAUDE.md              ← this file
├── GPT_DOCS/              ← raw GPT drafts (reference only)
├── CLAUDE_DOCS/           ← refined docs (SOURCE OF TRUTH)
│   ├── research.md        ← FINAL ✓
│   ├── features.md        ← FINAL ✓
│   ├── architecture.md    ← FINAL ✓
│   ├── techstack.md       ← FINAL ✓
│   ├── schema.md          ← FINAL ✓
│   ├── api-spec.md        ← FINAL ✓
│   ├── buildplan.md       ← FINAL ✓
│   └── progress.md        ← LIVE (update each session)
├── backend/               ← Django (TODO)
└── frontend/              ← React (TODO)
```
