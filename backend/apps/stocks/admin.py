from django.contrib import admin

from .models import DCFCalculation, FinancialStatement, KeyMetric, PriceHistory, RecentlyViewed, Stock, StockCache


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("symbol", "name", "exchange", "sector", "is_sp500", "updated_at")
    list_filter = ("is_sp500", "exchange", "sector")
    search_fields = ("symbol", "name")
    ordering = ("symbol",)


@admin.register(FinancialStatement)
class FinancialStatementAdmin(admin.ModelAdmin):
    list_display = ("stock", "statement_type", "period", "fiscal_year", "fetched_at")
    list_filter = ("statement_type", "period")
    search_fields = ("stock__symbol", "stock__name")
    ordering = ("stock__symbol", "-fiscal_year")


@admin.register(KeyMetric)
class KeyMetricAdmin(admin.ModelAdmin):
    list_display = ("stock", "fiscal_year", "period", "is_latest", "pe_ratio", "roe", "market_cap", "fetched_at")
    list_filter = ("period", "is_latest")
    search_fields = ("stock__symbol", "stock__name")
    ordering = ("stock__symbol", "-fiscal_year")


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    list_display = ("stock", "date", "close", "volume", "fetched_at")
    list_filter = ("stock",)
    search_fields = ("stock__symbol",)
    ordering = ("stock__symbol", "-date")


@admin.register(StockCache)
class StockCacheAdmin(admin.ModelAdmin):
    list_display = ("symbol", "endpoint", "fetched_at", "expires_at")
    list_filter = ("endpoint",)
    search_fields = ("symbol", "endpoint")
    ordering = ("-fetched_at",)


@admin.register(DCFCalculation)
class DCFCalculationAdmin(admin.ModelAdmin):
    list_display = ("user", "stock", "method", "fair_value_result", "current_price_at_save", "created_at")
    list_filter = ("method",)
    search_fields = ("user__email", "stock__symbol")
    ordering = ("-created_at",)


@admin.register(RecentlyViewed)
class RecentlyViewedAdmin(admin.ModelAdmin):
    list_display = ("user", "stock", "viewed_at")
    search_fields = ("user__email", "stock__symbol")
    ordering = ("-viewed_at",)

# Register your models here.
