import hashlib
import json

from django.conf import settings
from django.db import models


class Stock(models.Model):
    symbol = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=100, blank=True)
    industry = models.CharField(max_length=100, blank=True)
    exchange = models.CharField(max_length=20, blank=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    ceo = models.CharField(max_length=150, blank=True)
    website = models.URLField(blank=True)
    last_price = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    price_change = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    price_change_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    is_sp500 = models.BooleanField(default=False, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "stocks"
        indexes = [
            models.Index(fields=["sector"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.symbol} - {self.name}"


class FinancialStatement(models.Model):
    INCOME = "income"
    BALANCE = "balance"
    CASHFLOW = "cashflow"
    STATEMENT_TYPES = [
        (INCOME, "Income Statement"),
        (BALANCE, "Balance Sheet"),
        (CASHFLOW, "Cash Flow Statement"),
    ]
    ANNUAL = "annual"
    QUARTERLY = "quarterly"
    PERIODS = [
        (ANNUAL, "Annual"),
        (QUARTERLY, "Quarterly"),
    ]

    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="financial_statements")
    statement_type = models.CharField(max_length=10, choices=STATEMENT_TYPES)
    period = models.CharField(max_length=10, choices=PERIODS)
    fiscal_year = models.IntegerField()
    fiscal_quarter = models.CharField(max_length=2, blank=True, null=True)
    data = models.JSONField()
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "financial_statements"
        unique_together = [("stock", "statement_type", "period", "fiscal_year", "fiscal_quarter")]
        indexes = [
            models.Index(fields=["stock", "statement_type", "period"]),
        ]

    def __str__(self):
        return f"{self.stock_id} {self.statement_type} {self.fiscal_year}"


class KeyMetric(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="key_metrics")
    period = models.CharField(max_length=10)
    fiscal_year = models.IntegerField()
    is_latest = models.BooleanField(default=False, db_index=True)
    pe_ratio = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    ps_ratio = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    pfcf_ratio = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    debt_to_equity = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    dividend_yield = models.DecimalField(max_digits=8, decimal_places=6, null=True, blank=True)
    dividend_payout_ratio = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    gross_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    operating_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    net_margin = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    fcf_per_share = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    revenue_per_share = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    roe = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    roa = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    roic = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    enterprise_value = models.BigIntegerField(null=True, blank=True)
    fcf_yield = models.DecimalField(max_digits=8, decimal_places=6, null=True, blank=True)
    current_ratio = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    earnings_yield = models.DecimalField(max_digits=8, decimal_places=6, null=True, blank=True)
    revenue_growth = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    net_income_growth = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    eps_growth = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    fcf_growth = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    eps = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    revenue = models.BigIntegerField(null=True, blank=True)
    net_income = models.BigIntegerField(null=True, blank=True)
    free_cash_flow = models.BigIntegerField(null=True, blank=True)
    operating_cash_flow = models.BigIntegerField(null=True, blank=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "key_metrics"
        unique_together = [("stock", "period", "fiscal_year")]
        indexes = [
            models.Index(fields=["stock", "period"]),
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
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="price_history")
    date = models.DateField()
    open = models.DecimalField(max_digits=12, decimal_places=4)
    high = models.DecimalField(max_digits=12, decimal_places=4)
    low = models.DecimalField(max_digits=12, decimal_places=4)
    close = models.DecimalField(max_digits=12, decimal_places=4)
    volume = models.BigIntegerField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "price_history"
        unique_together = [("stock", "date")]
        indexes = [
            models.Index(fields=["stock", "date"]),
        ]
        ordering = ["-date"]

    def __str__(self):
        return f"{self.stock_id} {self.date} close={self.close}"


class StockCache(models.Model):
    symbol = models.CharField(max_length=10)
    endpoint = models.CharField(max_length=100)
    params = models.JSONField(default=dict)
    params_hash = models.CharField(max_length=32)
    response_data = models.JSONField()
    fetched_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "stock_cache"
        unique_together = [("symbol", "endpoint", "params_hash")]
        indexes = [
            models.Index(fields=["symbol", "endpoint"]),
            models.Index(fields=["expires_at"]),
        ]

    @staticmethod
    def make_params_hash(params: dict) -> str:
        return hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()

    def __str__(self):
        return f"cache:{self.symbol}/{self.endpoint}"


class DCFCalculation(models.Model):
    EPS = "eps"
    FCF = "fcf"
    METHODS = [
        (EPS, "EPS-Based"),
        (FCF, "FCF-Based"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dcf_calculations")
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="dcf_calculations")
    method = models.CharField(max_length=3, choices=METHODS)
    growth_rate = models.DecimalField(max_digits=6, decimal_places=4)
    discount_rate = models.DecimalField(max_digits=6, decimal_places=4)
    terminal_multiple = models.DecimalField(max_digits=6, decimal_places=2)
    years_projected = models.IntegerField(default=10)
    fair_value_result = models.DecimalField(max_digits=12, decimal_places=4)
    current_price_at_save = models.DecimalField(max_digits=12, decimal_places=4)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dcf_calculations"
        indexes = [
            models.Index(fields=["user", "stock"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"DCF {self.stock_id} by {self.user_id}"


class RecentlyViewed(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recently_viewed")
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "recently_viewed"
        unique_together = [("user", "stock")]
        ordering = ["-viewed_at"]

    def __str__(self):
        return f"{self.user_id} viewed {self.stock_id}"

# Create your models here.
