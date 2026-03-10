# StockLens — Database Schema

> Status: **FINAL**
> Last updated: Mar 2026
> Django model code — ready to paste into each app's `models.py`.
> 13 tables across 4 Django apps.

---

## Design Decisions

- **FinancialStatement uses JSONField** — FMP response structure varies per company (missing fields, extra fields). JSON avoids rigid column mapping. Never queried with filters.
- **KeyMetric uses individual columns** — Screener ORM filters require real columns (`pe_ratio__lt=20`). Indexed for screener performance.
- **KeyMetric.is_latest flag** — Only the most recent fiscal year row per stock has `is_latest=True`. Screener filters on `is_latest=True` to return one row per stock (not duplicate rows across years).
- **StockCache uses params_hash** — JSONField can't be in a Django unique_together directly. MD5 hash of canonical params JSON used instead.
- **PortfolioHolding unique per user+stock** — one row per holding, updated in place. No transaction history in V1.
- **Domain tables use auto_now for fetched_at** — `FinancialStatement.fetched_at` and `KeyMetric.fetched_at` use `auto_now=True` so timestamp updates when data is refreshed via `update_or_create`. `PriceHistory.fetched_at` uses `auto_now_add=True` since price rows are INSERT-only (one per date, never updated).
- **RecentlyViewed uses auto_now** — `viewed_at` auto-updates on every view. Service trims to last 10.
- **AISummaryCache is OneToOne** — one summary per stock. Regenerated when `financial_data_hash` changes.
- **HealthScore is OneToOne** — one score per stock. Recomputed when KeyMetric updates.

---

## Migration Order

Run in this order (foreign key dependencies):

```bash
python manage.py makemigrations users
python manage.py makemigrations stocks
python manage.py makemigrations watchlists
python manage.py makemigrations portfolio
python manage.py makemigrations ai
python manage.py migrate
```

---

## Required Settings

```python
# config/settings/base.py
AUTH_USER_MODEL = "users.CustomUser"
```

---

## 1. apps/users/models.py

```python
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):
    email      = models.EmailField(unique=True)
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email
```

---

## 2. apps/stocks/models.py

```python
import hashlib
import json

from django.conf import settings
from django.db import models


class Stock(models.Model):
    """
    Core stock record. Seeded for S&P 500. Created on-demand for other stocks.
    Primary key is the ticker symbol — no auto-increment id.
    """
    symbol          = models.CharField(max_length=10, primary_key=True)
    name            = models.CharField(max_length=255)
    sector          = models.CharField(max_length=100, blank=True)
    industry        = models.CharField(max_length=100, blank=True)
    exchange        = models.CharField(max_length=20, blank=True)   # NASDAQ, NYSE
    market_cap      = models.BigIntegerField(null=True, blank=True)
    description     = models.TextField(blank=True)
    ceo             = models.CharField(max_length=150, blank=True)
    website         = models.URLField(blank=True)
    last_price      = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)   # price (from /stable/quote)
    price_change    = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)  # change (from /stable/quote) — daily $ change
    price_change_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)  # changePercentage (from /stable/quote or /stable/profile fallback) — FMP returns percent-points (e.g. 1.17); backend divides by 100 before storing as decimal fraction (e.g. 0.0117 = 1.17%)
    is_sp500        = models.BooleanField(default=False, db_index=True)   # db_index here — not duplicated in Meta.indexes
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "stocks"
        indexes  = [
            models.Index(fields=["sector"]),
            models.Index(fields=["name"]),       # supports local name search
        ]

    def __str__(self):
        return f"{self.symbol} — {self.name}"


class FinancialStatement(models.Model):
    """
    Raw FMP financial statement data stored as JSON.
    One row per (stock, type, period, year, quarter).
    Never filtered by column — always fetched as a batch for a stock.
    """
    INCOME   = "income"
    BALANCE  = "balance"
    CASHFLOW = "cashflow"
    STATEMENT_TYPES = [
        (INCOME,   "Income Statement"),
        (BALANCE,  "Balance Sheet"),
        (CASHFLOW, "Cash Flow Statement"),
    ]
    ANNUAL    = "annual"
    QUARTERLY = "quarterly"
    PERIODS   = [
        (ANNUAL,    "Annual"),
        (QUARTERLY, "Quarterly"),
    ]

    stock           = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="financial_statements")
    statement_type  = models.CharField(max_length=10, choices=STATEMENT_TYPES)
    period          = models.CharField(max_length=10, choices=PERIODS)
    fiscal_year     = models.IntegerField()
    fiscal_quarter  = models.CharField(max_length=2, blank=True, null=True)  # Q1–Q4, null for annual
    data            = models.JSONField()    # full FMP response for this year/quarter
    fetched_at      = models.DateTimeField(auto_now=True)   # auto_now — updates on cache refresh via update_or_create

    class Meta:
        db_table        = "financial_statements"
        unique_together = [("stock", "statement_type", "period", "fiscal_year", "fiscal_quarter")]
        indexes         = [
            models.Index(fields=["stock", "statement_type", "period"]),
        ]

    def __str__(self):
        return f"{self.stock_id} {self.statement_type} {self.fiscal_year}"


class KeyMetric(models.Model):
    """
    Structured metrics for screener ORM filtering and health score computation.
    Populated from /stable/ratios + /stable/key-metrics + /stable/financial-growth.
    All FMP field names mapped to snake_case here.
    """
    stock             = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="key_metrics")
    period            = models.CharField(max_length=10)   # annual / quarterly
    fiscal_year       = models.IntegerField()
    is_latest         = models.BooleanField(default=False, db_index=True)  # True for most recent fiscal year only — screener filters on this

    # --- From /stable/ratios ---
    pe_ratio          = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # priceToEarningsRatio
    ps_ratio          = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # priceToSalesRatio
    pfcf_ratio        = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # priceToFreeCashFlowRatio
    debt_to_equity    = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # debtToEquityRatio
    dividend_yield    = models.DecimalField(max_digits=8,  decimal_places=6, null=True, blank=True)   # dividendYield
    dividend_payout_ratio = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)  # dividendPayoutRatio
    gross_margin      = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # grossProfitMargin
    operating_margin  = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # operatingProfitMargin (from /stable/ratios); for historical 5Y charts, computed as operatingIncome/revenue from income-statement rows
    net_margin        = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # netProfitMargin
    fcf_per_share     = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # freeCashFlowPerShare
    revenue_per_share = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # revenuePerShare

    # --- From /stable/key-metrics ---
    roe               = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # returnOnEquity
    roa               = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # returnOnAssets
    roic              = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # returnOnInvestedCapital
    market_cap        = models.BigIntegerField(null=True, blank=True)                                  # marketCap
    enterprise_value  = models.BigIntegerField(null=True, blank=True)                                  # enterpriseValue
    fcf_yield         = models.DecimalField(max_digits=8,  decimal_places=6, null=True, blank=True)   # freeCashFlowYield
    current_ratio     = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # currentRatio
    earnings_yield    = models.DecimalField(max_digits=8,  decimal_places=6, null=True, blank=True)   # earningsYield

    # --- From /stable/financial-growth (pre-computed YoY) ---
    revenue_growth    = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # revenueGrowth
    net_income_growth = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # netIncomeGrowth
    eps_growth        = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # epsgrowth
    fcf_growth        = models.DecimalField(max_digits=8,  decimal_places=4, null=True, blank=True)   # freeCashFlowGrowth

    # --- From income/cashflow statements (convenience copies for screener) ---
    eps               = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)   # epsDiluted
    revenue           = models.BigIntegerField(null=True, blank=True)
    net_income        = models.BigIntegerField(null=True, blank=True)
    free_cash_flow    = models.BigIntegerField(null=True, blank=True)
    operating_cash_flow = models.BigIntegerField(null=True, blank=True)

    fetched_at        = models.DateTimeField(auto_now=True)   # auto_now — updates on cache refresh via update_or_create

    class Meta:
        db_table        = "key_metrics"
        unique_together = [("stock", "period", "fiscal_year")]
        indexes         = [
            models.Index(fields=["stock", "period"]),
            # Screener filter indexes:
            models.Index(fields=["pe_ratio"]),
            models.Index(fields=["dividend_yield"]),
            models.Index(fields=["roe"]),
            models.Index(fields=["market_cap"]),
            models.Index(fields=["revenue_growth"]),
            models.Index(fields=["net_margin"]),
            models.Index(fields=["debt_to_equity"]),
            models.Index(fields=["fcf_per_share"]),
        ]

    def __str__(self):
        return f"{self.stock_id} metrics {self.fiscal_year}"


class PriceHistory(models.Model):
    """
    EOD price data from /stable/historical-price-eod/full.
    Used for price chart on stock dashboard.
    """
    stock      = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="price_history")
    date       = models.DateField()
    open       = models.DecimalField(max_digits=12, decimal_places=4)
    high       = models.DecimalField(max_digits=12, decimal_places=4)
    low        = models.DecimalField(max_digits=12, decimal_places=4)
    close      = models.DecimalField(max_digits=12, decimal_places=4)
    volume     = models.BigIntegerField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = "price_history"
        unique_together = [("stock", "date")]
        indexes         = [
            models.Index(fields=["stock", "date"]),
        ]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.stock_id} {self.date} close={self.close}"


class StockCache(models.Model):
    """
    Raw FMP API response cache. Cache-through proxy layer.
    params_hash = MD5(json.dumps(params, sort_keys=True)) — used for unique lookup.
    """
    symbol        = models.CharField(max_length=10)
    endpoint      = models.CharField(max_length=100)    # "profile", "ratios", "income-statement"
    params        = models.JSONField(default=dict)       # {"period": "annual"}
    params_hash   = models.CharField(max_length=32)     # MD5 of canonical params — for unique_together
    response_data = models.JSONField()
    fetched_at    = models.DateTimeField(auto_now=True)  # auto_now (not auto_now_add) — updates on cache refresh
    expires_at    = models.DateTimeField(db_index=True)

    class Meta:
        db_table        = "stock_cache"
        unique_together = [("symbol", "endpoint", "params_hash")]
        indexes         = [
            models.Index(fields=["symbol", "endpoint"]),
            models.Index(fields=["expires_at"]),
        ]

    @staticmethod
    def make_params_hash(params: dict) -> str:
        return hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()

    def __str__(self):
        return f"cache:{self.symbol}/{self.endpoint}"


class DCFCalculation(models.Model):
    """
    User-saved DCF valuations. Max 10 per user per stock (enforced in view).
    """
    EPS = "eps"
    FCF = "fcf"
    METHODS = [
        (EPS, "EPS-Based"),
        (FCF, "FCF-Based"),
    ]

    user                   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dcf_calculations")
    stock                  = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="dcf_calculations")
    method                 = models.CharField(max_length=3, choices=METHODS)
    growth_rate            = models.DecimalField(max_digits=6, decimal_places=4)   # 0.12 = 12%
    discount_rate          = models.DecimalField(max_digits=6, decimal_places=4)   # 0.10 = 10%
    terminal_multiple      = models.DecimalField(max_digits=6, decimal_places=2)   # 15.00
    years_projected        = models.IntegerField(default=10)
    fair_value_result      = models.DecimalField(max_digits=12, decimal_places=4)
    current_price_at_save  = models.DecimalField(max_digits=12, decimal_places=4)  # price snapshot at save time
    created_at             = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dcf_calculations"
        indexes  = [
            models.Index(fields=["user", "stock"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"DCF {self.stock_id} by {self.user_id} — ${self.fair_value_result}"


class RecentlyViewed(models.Model):
    """
    Last 10 stocks viewed per user. Upserted on each stock visit.
    viewed_at auto-updates so ordering always reflects most recent visit.
    Trim to 10 is handled in stock_service, not DB.
    """
    user      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recently_viewed")
    stock     = models.ForeignKey(Stock, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = "recently_viewed"
        unique_together = [("user", "stock")]
        ordering        = ["-viewed_at"]

    def __str__(self):
        return f"{self.user_id} viewed {self.stock_id}"
```

---

## 3. apps/watchlists/models.py

```python
from django.conf import settings
from django.db import models


class Watchlist(models.Model):
    """
    User-created or preset watchlist.
    is_preset=True: seeded lists (FAANG, Dividend Aristocrats, S&P Top 10).
    Preset lists are shared across all users — linked to a system user or null.
    Max 5 custom watchlists per user enforced in view.
    """
    user      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="watchlists")  # null for preset lists
    name      = models.CharField(max_length=50)
    is_preset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "watchlists"

    def __str__(self):
        prefix = "[PRESET] " if self.is_preset else ""
        return f"{prefix}{self.name}"


class WatchlistItem(models.Model):
    """
    Stock in a watchlist. Max 50 stocks per watchlist enforced in view.
    """
    watchlist  = models.ForeignKey(Watchlist, on_delete=models.CASCADE, related_name="items")
    stock      = models.ForeignKey("stocks.Stock", on_delete=models.CASCADE)
    added_at   = models.DateTimeField(auto_now_add=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table        = "watchlist_items"
        unique_together = [("watchlist", "stock")]
        ordering        = ["sort_order", "added_at"]

    def __str__(self):
        return f"{self.watchlist.name} → {self.stock_id}"
```

---

## 4. apps/portfolio/models.py

```python
from django.conf import settings
from django.db import models


class PortfolioHolding(models.Model):
    """
    Single holding per stock per user. No transaction history.
    Gain/loss = (current_price - avg_cost_per_share) × shares — computed in service.
    Max 50 holdings per user enforced in view.
    """
    user               = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="holdings")
    stock              = models.ForeignKey("stocks.Stock", on_delete=models.CASCADE)
    shares             = models.DecimalField(max_digits=14, decimal_places=6)     # supports fractional shares
    avg_cost_per_share = models.DecimalField(max_digits=12, decimal_places=4)
    added_at           = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = "portfolio_holdings"
        unique_together = [("user", "stock")]

    @property
    def cost_basis(self):
        """Decimal-safe: both fields are DecimalField, Decimal * Decimal returns Decimal."""
        return self.shares * self.avg_cost_per_share

    def __str__(self):
        return f"{self.user_id} — {self.shares} × {self.stock_id} @ ${self.avg_cost_per_share}"
```

---

## 5. apps/ai/models.py

```python
from django.db import models


class AISummaryCache(models.Model):
    """
    One AI summary per stock. Regenerated only when financial_data_hash changes.
    financial_data_hash = MD5 of the financial data JSON sent to Claude.
    """
    stock                = models.OneToOneField("stocks.Stock", on_delete=models.CASCADE, related_name="ai_summary")
    summary_text         = models.TextField()
    financial_data_hash  = models.CharField(max_length=32)   # MD5 — triggers regen when data changes
    model_used           = models.CharField(max_length=50, default="claude-haiku-4-5-20251001")
    generated_at         = models.DateTimeField(auto_now=True)  # auto_now — updates on every regeneration

    class Meta:
        db_table = "ai_summary_cache"

    def __str__(self):
        return f"AI summary — {self.stock_id} ({self.generated_at.date()})"


class HealthScore(models.Model):
    """
    Computed 0-100 health score per stock.
    Recomputed whenever KeyMetric or FinancialStatement updates.
    breakdown JSON: {"profitability": 25, "growth": 18, "strength": 20, "valuation": 12, "efficiency": 8}
    """
    stock          = models.OneToOneField("stocks.Stock", on_delete=models.CASCADE, related_name="health_score")
    score          = models.IntegerField()          # 0–100
    breakdown      = models.JSONField()             # per-category scores
    calculated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "health_scores"

    def __str__(self):
        return f"{self.stock_id} — {self.score}/100"
```

---

## Constraints Enforced in Views (not DB)

| Rule | Where Enforced |
|------|---------------|
| Max 5 custom watchlists per user | `watchlists/views.py` |
| Max 50 stocks per watchlist | `watchlists/views.py` |
| Max 50 holdings per user | `portfolio/views.py` |
| Max 10 saved DCFs per user per stock | `stocks/views.py` (dcf endpoint) |
| Keep only last 10 recently viewed | `stocks/services/stock_service.py` |
| Watchlist name max 50 chars | Serializer validation |

---

## Table Summary

| Table | App | Rows (est. V1) | Notes |
|-------|-----|---------------|-------|
| `users` | users | ~50 | CustomUser, email-based |
| `stocks` | stocks | ~500 | S&P 500 seeded + on-demand |
| `financial_statements` | stocks | ~8,000 | 500 stocks × 3 types × ~5yr |
| `key_metrics` | stocks | ~2,500 | 500 stocks × 5yr annual |
| `price_history` | stocks | ~625,000 | 500 stocks × 5yr × 250 trading days |
| `stock_cache` | stocks | ~5,000 | Raw FMP responses with TTL |
| `watchlists` | watchlists | ~300 | 3 presets + user lists |
| `watchlist_items` | watchlists | ~3,000 | stocks per watchlist |
| `portfolio_holdings` | portfolio | ~500 | holdings per user |
| `dcf_calculations` | stocks | ~200 | saved DCFs |
| `recently_viewed` | stocks | ~500 | 10 per user |
| `ai_summary_cache` | ai | ~500 | one per seeded stock |
| `health_scores` | ai | ~500 | one per seeded stock |

**Note on price_history:** 625K rows is small for PostgreSQL. No partitioning needed in V1. If it grows (more stocks, more history), add a `created_at` range partition on date.
