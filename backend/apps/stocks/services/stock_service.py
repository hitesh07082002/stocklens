from __future__ import annotations

import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone

from apps.stocks.constants import (
    METRICS_TTL_HOURS,
    PRICES_TTL_HOURS,
    PROFILE_TTL_HOURS,
    SEARCH_CACHE_SYMBOL,
    SEARCH_EXCHANGES,
    SEARCH_TTL_HOURS,
    STATEMENTS_TTL_HOURS,
)
from apps.stocks.exceptions import StockNotFoundError
from apps.stocks.models import FinancialStatement, KeyMetric, PriceHistory, RecentlyViewed, Stock
from . import cache_service, fmp_service

PRICE_RANGE_DAYS = {"1y": 365, "3y": 365 * 3, "5y": 365 * 5}


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("historical", "results", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
    return []


def _to_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(Decimal(str(value)))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _to_fractional_percent(value: Any) -> Decimal | None:
    decimal_value = _to_decimal(value)
    if decimal_value is None:
        return None
    return decimal_value / Decimal("100")


def _safe_ratio(numerator: Any, denominator: Any) -> Decimal | None:
    numerator_decimal = _to_decimal(numerator)
    denominator_decimal = _to_decimal(denominator)
    if numerator_decimal is None or denominator_decimal in (None, Decimal("0")):
        return None
    return numerator_decimal / denominator_decimal


def _extract_fiscal_year(row: dict[str, Any]) -> int | None:
    if row.get("calendarYear"):
        return _to_int(row["calendarYear"])
    if row.get("date"):
        try:
            return int(str(row["date"])[:4])
        except ValueError:
            return None
    return None


def _has_field_changes(instance: Any, values: dict[str, Any]) -> bool:
    return any(getattr(instance, field_name) != field_value for field_name, field_value in values.items())


def _count_upstream_fetches(*results: cache_service.CacheFetchResult | None) -> int:
    return sum(1 for result in results if result is not None and not result.cache_hit)


def _upsert_stock_snapshot(
    symbol: str,
    defaults: dict[str, Any],
    source_fetched_at,
    force_refresh: bool,
) -> Stock:
    stock = Stock.objects.filter(symbol=symbol).first()
    if stock and not force_refresh and not _has_field_changes(stock, defaults):
        return stock

    if stock:
        Stock.objects.filter(symbol=symbol).update(**defaults, updated_at=source_fetched_at)
    else:
        stock = Stock.objects.create(symbol=symbol, **defaults)
        Stock.objects.filter(symbol=symbol).update(updated_at=source_fetched_at)

    return Stock.objects.get(symbol=symbol)


def _ensure_stock_exists(symbol: str) -> Stock:
    normalized_symbol = _normalize_symbol(symbol)
    stock = Stock.objects.filter(symbol=normalized_symbol).first()
    if stock:
        return stock
    return get_profile(normalized_symbol, include_quote=False)


def _get_profile_fetch_result(symbol: str) -> tuple[cache_service.CacheFetchResult, dict[str, Any]]:
    profile_result = cache_service.get_or_fetch_with_meta(
        symbol,
        "profile",
        {},
        PROFILE_TTL_HOURS,
        lambda: fmp_service.fetch_profile(symbol),
    )
    profile_rows = _extract_rows(profile_result.data)
    if not profile_rows:
        raise StockNotFoundError(symbol)
    return profile_result, profile_rows[0]


def get_profile(
    symbol: str,
    include_quote: bool = True,
    include_fetch_count: bool = False,
) -> Stock | tuple[Stock, int]:
    normalized_symbol = _normalize_symbol(symbol)
    try:
        profile_result, profile_row = _get_profile_fetch_result(normalized_symbol)
    except fmp_service.FMPAPIError as exc:
        exc.upstream_fetches = max(exc.upstream_fetches, 1)
        raise
    upstream_fetches = _count_upstream_fetches(profile_result)

    quote_row: dict[str, Any] | None = None
    quote_result: cache_service.CacheFetchResult | None = None
    if include_quote:
        try:
            quote_result = cache_service.get_or_fetch_with_meta(
                normalized_symbol,
                "quote",
                {},
                PRICES_TTL_HOURS,
                lambda: fmp_service.fetch_quote(normalized_symbol),
            )
            upstream_fetches += _count_upstream_fetches(quote_result)
            quote_rows = _extract_rows(quote_result.data)
            quote_row = quote_rows[0] if quote_rows else None
        except fmp_service.FMPAPIError as exc:
            exc.upstream_fetches = max(exc.upstream_fetches, upstream_fetches + 1)
            if exc.status_code != 402:
                raise
            upstream_fetches = exc.upstream_fetches
            quote_row = None

    price_row = quote_row or profile_row
    defaults = {
        "name": profile_row.get("companyName") or profile_row.get("name") or normalized_symbol,
        "sector": profile_row.get("sector") or "",
        "industry": profile_row.get("industry") or "",
        "exchange": profile_row.get("exchangeShortName") or profile_row.get("exchange") or "",
        "market_cap": _to_int((quote_row or {}).get("marketCap") or profile_row.get("marketCap")),
        "description": profile_row.get("description") or "",
        "ceo": profile_row.get("ceo") or "",
        "website": profile_row.get("website") or "",
        "last_price": _to_decimal(price_row.get("price")),
        "price_change": _to_decimal(price_row.get("change")),
        "price_change_pct": _to_fractional_percent(price_row.get("changePercentage")),
    }
    source_fetched_at = quote_result.fetched_at if quote_row and quote_result else profile_result.fetched_at
    force_refresh = (not profile_result.cache_hit) or (quote_result is not None and not quote_result.cache_hit)

    stock = _upsert_stock_snapshot(
        normalized_symbol,
        defaults,
        source_fetched_at=source_fetched_at,
        force_refresh=force_refresh,
    )
    if include_fetch_count:
        return stock, upstream_fetches
    return stock


def _upsert_financial_rows(
    stock: Stock,
    statement_type: str,
    period: str,
    rows: list[dict[str, Any]],
    source_fetched_at,
    force_refresh: bool,
) -> None:
    existing_rows = {
        statement.fiscal_year: statement
        for statement in FinancialStatement.objects.filter(
            stock=stock,
            statement_type=statement_type,
            period=period,
            fiscal_quarter=None,
        )
    }
    for row in rows:
        fiscal_year = _extract_fiscal_year(row)
        if fiscal_year is None:
            continue
        statement = existing_rows.get(fiscal_year)
        if statement and not force_refresh and statement.data == row:
            continue

        if statement:
            FinancialStatement.objects.filter(pk=statement.pk).update(
                data=row,
                fetched_at=source_fetched_at,
            )
            continue

        statement = FinancialStatement.objects.create(
            stock=stock,
            statement_type=statement_type,
            period=period,
            fiscal_year=fiscal_year,
            fiscal_quarter=None,
            data=row,
        )
        FinancialStatement.objects.filter(pk=statement.pk).update(fetched_at=source_fetched_at)


def _income_statement_payload(statement: FinancialStatement) -> dict[str, Any]:
    data = statement.data
    revenue = _to_int(data.get("revenue"))
    gross_profit = _to_int(data.get("grossProfit"))
    operating_income = _to_int(data.get("operatingIncome"))
    net_income = _to_int(data.get("netIncome"))
    return {
        "fiscal_year": statement.fiscal_year,
        "revenue": revenue,
        "gross_profit": gross_profit,
        "operating_income": operating_income,
        "net_income": net_income,
        "eps_diluted": _to_decimal(data.get("epsDiluted") or data.get("eps")),
        "weighted_avg_shares_diluted": _to_int(data.get("weightedAverageShsOutDil")),
        "gross_margin": _safe_ratio(gross_profit, revenue),
        "operating_margin": _safe_ratio(operating_income, revenue),
        "net_margin": _safe_ratio(net_income, revenue),
    }


def _balance_sheet_payload(statement: FinancialStatement) -> dict[str, Any]:
    data = statement.data
    return {
        "fiscal_year": statement.fiscal_year,
        "total_assets": _to_int(data.get("totalAssets")),
        "total_liabilities": _to_int(data.get("totalLiabilities")),
        "total_stockholders_equity": _to_int(data.get("totalStockholdersEquity")),
        "total_debt": _to_int(data.get("totalDebt")),
        "cash_and_equivalents": _to_int(data.get("cashAndCashEquivalents")),
    }


def _cash_flow_payload(statement: FinancialStatement) -> dict[str, Any]:
    data = statement.data
    return {
        "fiscal_year": statement.fiscal_year,
        "operating_cash_flow": _to_int(data.get("operatingCashFlow")),
        "free_cash_flow": _to_int(data.get("freeCashFlow")),
        "capital_expenditure": _to_int(data.get("capitalExpenditure")),
    }


def _sync_key_metric_statement_fields(stock: Stock, period: str) -> None:
    metrics_by_year = {
        metric.fiscal_year: metric
        for metric in KeyMetric.objects.filter(stock=stock, period=period)
    }
    if not metrics_by_year:
        return

    income_rows = {
        statement.fiscal_year: statement
        for statement in FinancialStatement.objects.filter(
            stock=stock,
            statement_type=FinancialStatement.INCOME,
            period=period,
        )
    }
    cash_rows = {
        statement.fiscal_year: statement
        for statement in FinancialStatement.objects.filter(
            stock=stock,
            statement_type=FinancialStatement.CASHFLOW,
            period=period,
        )
    }

    for fiscal_year, metric in metrics_by_year.items():
        income_statement = income_rows.get(fiscal_year)
        cash_statement = cash_rows.get(fiscal_year)
        update_values: dict[str, Any] = {}
        if income_statement:
            income_data = income_statement.data
            update_values["eps"] = _to_decimal(income_data.get("epsDiluted") or income_data.get("eps"))
            update_values["revenue"] = _to_int(income_data.get("revenue"))
            update_values["net_income"] = _to_int(income_data.get("netIncome"))
        if cash_statement:
            cash_data = cash_statement.data
            update_values["free_cash_flow"] = _to_int(cash_data.get("freeCashFlow"))
            update_values["operating_cash_flow"] = _to_int(cash_data.get("operatingCashFlow"))
        if update_values and _has_field_changes(metric, update_values):
            KeyMetric.objects.filter(pk=metric.pk).update(**update_values)


def get_financials(symbol: str, period: str = FinancialStatement.ANNUAL) -> dict[str, Any]:
    stock = _ensure_stock_exists(symbol)
    normalized_symbol = stock.symbol

    income_result = cache_service.get_or_fetch_with_meta(
        normalized_symbol,
        "income-statement",
        {"period": period},
        STATEMENTS_TTL_HOURS,
        lambda: fmp_service.fetch_income_statement(normalized_symbol, period),
    )
    balance_result = cache_service.get_or_fetch_with_meta(
        normalized_symbol,
        "balance-sheet-statement",
        {"period": period},
        STATEMENTS_TTL_HOURS,
        lambda: fmp_service.fetch_balance_sheet_statement(normalized_symbol, period),
    )
    cash_flow_result = cache_service.get_or_fetch_with_meta(
        normalized_symbol,
        "cash-flow-statement",
        {"period": period},
        STATEMENTS_TTL_HOURS,
        lambda: fmp_service.fetch_cash_flow_statement(normalized_symbol, period),
    )
    income_rows = _extract_rows(income_result.data)
    balance_rows = _extract_rows(balance_result.data)
    cash_flow_rows = _extract_rows(cash_flow_result.data)

    with transaction.atomic():
        _upsert_financial_rows(
            stock,
            FinancialStatement.INCOME,
            period,
            income_rows,
            source_fetched_at=income_result.fetched_at,
            force_refresh=not income_result.cache_hit,
        )
        _upsert_financial_rows(
            stock,
            FinancialStatement.BALANCE,
            period,
            balance_rows,
            source_fetched_at=balance_result.fetched_at,
            force_refresh=not balance_result.cache_hit,
        )
        _upsert_financial_rows(
            stock,
            FinancialStatement.CASHFLOW,
            period,
            cash_flow_rows,
            source_fetched_at=cash_flow_result.fetched_at,
            force_refresh=not cash_flow_result.cache_hit,
        )
        _sync_key_metric_statement_fields(stock, period)

    income_statements = [
        _income_statement_payload(statement)
        for statement in FinancialStatement.objects.filter(
            stock=stock,
            statement_type=FinancialStatement.INCOME,
            period=period,
        ).order_by("-fiscal_year")[:5]
    ]
    balance_sheets = [
        _balance_sheet_payload(statement)
        for statement in FinancialStatement.objects.filter(
            stock=stock,
            statement_type=FinancialStatement.BALANCE,
            period=period,
        ).order_by("-fiscal_year")[:5]
    ]
    cash_flow_statements = [
        _cash_flow_payload(statement)
        for statement in FinancialStatement.objects.filter(
            stock=stock,
            statement_type=FinancialStatement.CASHFLOW,
            period=period,
        ).order_by("-fiscal_year")[:5]
    ]

    return {
        "symbol": stock.symbol,
        "period": period,
        "income_statements": income_statements,
        "balance_sheets": balance_sheets,
        "cash_flow_statements": cash_flow_statements,
    }


def _statement_metrics_by_year(stock: Stock, period: str) -> dict[int, dict[str, Any]]:
    metrics_by_year: dict[int, dict[str, Any]] = {}
    for statement in FinancialStatement.objects.filter(stock=stock, period=period):
        metrics = metrics_by_year.setdefault(statement.fiscal_year, {})
        data = statement.data
        if statement.statement_type == FinancialStatement.INCOME:
            metrics["eps"] = _to_decimal(data.get("epsDiluted") or data.get("eps"))
            metrics["revenue"] = _to_int(data.get("revenue"))
            metrics["net_income"] = _to_int(data.get("netIncome"))
        if statement.statement_type == FinancialStatement.CASHFLOW:
            metrics["free_cash_flow"] = _to_int(data.get("freeCashFlow"))
            metrics["operating_cash_flow"] = _to_int(data.get("operatingCashFlow"))
    return metrics_by_year


def _build_metric_defaults(
    stock: Stock,
    ratio: dict[str, Any],
    key_metric: dict[str, Any],
    growth: dict[str, Any],
    statement_values: dict[str, Any],
) -> dict[str, Any]:
    return {
        "pe_ratio": _to_decimal(ratio.get("priceToEarningsRatio")),
        "ps_ratio": _to_decimal(ratio.get("priceToSalesRatio")),
        "pfcf_ratio": _to_decimal(ratio.get("priceToFreeCashFlowRatio")),
        "debt_to_equity": _to_decimal(ratio.get("debtToEquityRatio")),
        "dividend_yield": _to_decimal(ratio.get("dividendYield")),
        "dividend_payout_ratio": _to_decimal(ratio.get("dividendPayoutRatio")),
        "gross_margin": _to_decimal(ratio.get("grossProfitMargin")),
        "operating_margin": _to_decimal(ratio.get("operatingProfitMargin")),
        "net_margin": _to_decimal(ratio.get("netProfitMargin")),
        "fcf_per_share": _to_decimal(ratio.get("freeCashFlowPerShare")),
        "revenue_per_share": _to_decimal(ratio.get("revenuePerShare")),
        "roe": _to_decimal(key_metric.get("returnOnEquity")),
        "roa": _to_decimal(key_metric.get("returnOnAssets")),
        "roic": _to_decimal(key_metric.get("returnOnInvestedCapital")),
        "market_cap": _to_int(key_metric.get("marketCap") or ratio.get("marketCap")) or stock.market_cap,
        "enterprise_value": _to_int(key_metric.get("enterpriseValue")),
        "fcf_yield": _to_decimal(key_metric.get("freeCashFlowYield")),
        "current_ratio": _to_decimal(key_metric.get("currentRatio")),
        "earnings_yield": _to_decimal(key_metric.get("earningsYield")),
        "revenue_growth": _to_decimal(growth.get("revenueGrowth")),
        "net_income_growth": _to_decimal(growth.get("netIncomeGrowth")),
        "eps_growth": _to_decimal(growth.get("epsgrowth")),
        "fcf_growth": _to_decimal(growth.get("freeCashFlowGrowth")),
        "eps": statement_values.get("eps"),
        "revenue": statement_values.get("revenue"),
        "net_income": statement_values.get("net_income"),
        "free_cash_flow": statement_values.get("free_cash_flow"),
        "operating_cash_flow": statement_values.get("operating_cash_flow"),
    }


def _ensure_latest_metric_flag(stock: Stock, period: str, latest_year: int) -> None:
    latest_queryset = KeyMetric.objects.filter(stock=stock, period=period, fiscal_year=latest_year)
    latest_is_flagged = latest_queryset.filter(is_latest=True).exists()
    stale_latest_exists = KeyMetric.objects.filter(stock=stock, period=period, is_latest=True).exclude(
        fiscal_year=latest_year
    ).exists()
    if not latest_is_flagged:
        latest_queryset.update(is_latest=True)
    if stale_latest_exists:
        KeyMetric.objects.filter(stock=stock, period=period, is_latest=True).exclude(
            fiscal_year=latest_year
        ).update(is_latest=False)


def get_metrics(
    symbol: str,
    period: str = FinancialStatement.ANNUAL,
    include_growth: bool = True,
    include_fetch_count: bool = False,
) -> KeyMetric | None | tuple[KeyMetric | None, int]:
    stock = _ensure_stock_exists(symbol)
    normalized_symbol = stock.symbol

    upstream_fetches = 0
    try:
        ratio_result = cache_service.get_or_fetch_with_meta(
            normalized_symbol,
            "ratios",
            {"period": period},
            METRICS_TTL_HOURS,
            lambda: fmp_service.fetch_ratios(normalized_symbol, period),
        )
        upstream_fetches += _count_upstream_fetches(ratio_result)
        key_metrics_result = cache_service.get_or_fetch_with_meta(
            normalized_symbol,
            "key-metrics",
            {"period": period},
            METRICS_TTL_HOURS,
            lambda: fmp_service.fetch_key_metrics(normalized_symbol, period),
        )
        upstream_fetches += _count_upstream_fetches(key_metrics_result)
        growth_rows: list[dict[str, Any]] = []
        growth_result: cache_service.CacheFetchResult | None = None
        if include_growth:
            growth_result = cache_service.get_or_fetch_with_meta(
                normalized_symbol,
                "financial-growth",
                {"period": period},
                METRICS_TTL_HOURS,
                lambda: fmp_service.fetch_financial_growth(normalized_symbol, period),
            )
            upstream_fetches += _count_upstream_fetches(growth_result)
            growth_rows = _extract_rows(growth_result.data)
    except fmp_service.FMPAPIError as exc:
        exc.upstream_fetches = max(exc.upstream_fetches, upstream_fetches + 1)
        raise

    ratio_rows = _extract_rows(ratio_result.data)
    key_metric_rows = _extract_rows(key_metrics_result.data)
    rows_by_year: dict[int, dict[str, Any]] = {}
    for collection, source in (
        (ratio_rows, "ratio"),
        (key_metric_rows, "key_metric"),
        (growth_rows, "growth"),
    ):
        for row in collection:
            fiscal_year = _extract_fiscal_year(row)
            if fiscal_year is None:
                continue
            rows_by_year.setdefault(fiscal_year, {})[source] = row

    statement_fields = _statement_metrics_by_year(stock, period)
    saved_metrics: list[KeyMetric] = []
    metrics_results = [ratio_result, key_metrics_result]
    if growth_result is not None:
        metrics_results.append(growth_result)
    source_fetched_at = max(result.fetched_at for result in metrics_results)
    force_refresh = any(not result.cache_hit for result in metrics_results)
    with transaction.atomic():
        existing_metrics = {
            metric.fiscal_year: metric
            for metric in KeyMetric.objects.filter(stock=stock, period=period)
        }
        for fiscal_year, payload in rows_by_year.items():
            ratio = payload.get("ratio", {})
            key_metric = payload.get("key_metric", {})
            growth = payload.get("growth", {})
            statement_values = statement_fields.get(fiscal_year, {})
            defaults = _build_metric_defaults(stock, ratio, key_metric, growth, statement_values)
            metric = existing_metrics.get(fiscal_year)
            if metric and not force_refresh and not _has_field_changes(metric, defaults):
                saved_metrics.append(metric)
                continue

            if metric:
                KeyMetric.objects.filter(pk=metric.pk).update(**defaults, fetched_at=source_fetched_at)
            else:
                metric = KeyMetric.objects.create(
                    stock=stock,
                    period=period,
                    fiscal_year=fiscal_year,
                    **defaults,
                )
                KeyMetric.objects.filter(pk=metric.pk).update(fetched_at=source_fetched_at)
            saved_metrics.append(KeyMetric.objects.get(pk=metric.pk))

        if not saved_metrics:
            if include_fetch_count:
                return None, upstream_fetches
            return None

        latest_year = max(metric.fiscal_year for metric in saved_metrics)
        _ensure_latest_metric_flag(stock, period, latest_year)

    latest_metric = KeyMetric.objects.filter(stock=stock, period=period, is_latest=True).first()
    if include_fetch_count:
        return latest_metric, upstream_fetches
    return latest_metric


def get_prices(symbol: str, range_value: str = "1y") -> dict[str, Any]:
    if range_value not in PRICE_RANGE_DAYS:
        valid_ranges = ", ".join(PRICE_RANGE_DAYS)
        raise ValueError(f"Unsupported price range '{range_value}'. Expected one of: {valid_ranges}.")

    stock = _ensure_stock_exists(symbol)
    normalized_symbol = stock.symbol
    today = timezone.now().date()
    start_date = today - timedelta(days=365 * 5)
    price_history_result = cache_service.get_or_fetch_with_meta(
        normalized_symbol,
        "historical-price-eod/full",
        {"from": start_date.isoformat(), "to": today.isoformat()},
        PRICES_TTL_HOURS,
        lambda: fmp_service.fetch_price_history(normalized_symbol, start_date, today),
    )
    history_rows = _extract_rows(price_history_result.data)

    with transaction.atomic():
        existing_rows = {
            price_row.date.isoformat(): price_row
            for price_row in PriceHistory.objects.filter(
                stock=stock,
                date__in=[row.get("date") for row in history_rows if row.get("date")],
            )
        }
        for row in history_rows:
            row_date = row.get("date")
            if not row_date:
                continue
            defaults = {
                "open": _to_decimal(row.get("open")) or Decimal("0"),
                "high": _to_decimal(row.get("high")) or Decimal("0"),
                "low": _to_decimal(row.get("low")) or Decimal("0"),
                "close": _to_decimal(row.get("close")) or Decimal("0"),
                "volume": _to_int(row.get("volume")) or 0,
            }
            existing_row = existing_rows.get(row_date)
            if existing_row and price_history_result.cache_hit:
                continue
            if existing_row:
                if _has_field_changes(existing_row, defaults) or existing_row.fetched_at != price_history_result.fetched_at:
                    PriceHistory.objects.filter(pk=existing_row.pk).update(
                        **defaults,
                        fetched_at=price_history_result.fetched_at,
                    )
                continue

            created_row = PriceHistory.objects.create(
                stock=stock,
                date=row_date,
                **defaults,
            )
            if created_row.fetched_at != price_history_result.fetched_at:
                PriceHistory.objects.filter(pk=created_row.pk).update(fetched_at=price_history_result.fetched_at)

    cutoff = today - timedelta(days=PRICE_RANGE_DAYS[range_value])
    queryset = PriceHistory.objects.filter(stock=stock, date__gte=cutoff).order_by("-date")
    prices = [
        {"date": row.date, "close": row.close, "volume": row.volume}
        for row in queryset
    ]
    return {
        "symbol": stock.symbol,
        "range": range_value,
        "prices": prices,
        "count": len(prices),
    }


def _clean_search_query(query: str) -> str:
    return re.sub(r"[^A-Za-z0-9\s.-]", "", query).strip()


def _serialize_search_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "symbol": _normalize_symbol(row.get("symbol", "")),
        "name": row.get("name") or row.get("companyName") or "",
        "exchange": row.get("exchange") or row.get("exchangeShortName") or "",
        "sector": row.get("sector") or "",
    }


def search(query: str) -> dict[str, Any]:
    cleaned_query = _clean_search_query(query)
    if not cleaned_query:
        return {"results": [], "count": 0, "source": "local"}

    exact_symbol = cleaned_query.upper()
    local_results = list(
        Stock.objects.filter(Q(symbol__icontains=exact_symbol) | Q(name__icontains=cleaned_query))
        .annotate(
            sort_rank=Case(
                When(symbol__iexact=exact_symbol, then=Value(0)),
                When(symbol__istartswith=exact_symbol, then=Value(1)),
                When(name__istartswith=cleaned_query, then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            )
        )
        .order_by("sort_rank", "symbol")[:10]
    )
    if local_results:
        results = [
            {
                "symbol": stock.symbol,
                "name": stock.name,
                "exchange": stock.exchange,
                "sector": stock.sector,
            }
            for stock in local_results
        ]
        return {"results": results, "count": len(results), "source": "local"}

    merged_results: list[dict[str, Any]] = []
    seen_symbols: set[str] = set()
    for exchange in SEARCH_EXCHANGES:
        rows = _extract_rows(
            cache_service.get_or_fetch(
                SEARCH_CACHE_SYMBOL,
                "search-name",
                {"query": cleaned_query, "exchange": exchange},
                SEARCH_TTL_HOURS,
                lambda exchange_name=exchange: fmp_service.fetch_search_name(cleaned_query, exchange_name),
            )
        )
        for row in rows:
            serialized = _serialize_search_row(row)
            symbol = serialized["symbol"]
            if not symbol or symbol in seen_symbols:
                continue
            seen_symbols.add(symbol)
            merged_results.append(serialized)
            if len(merged_results) >= 10:
                return {"results": merged_results, "count": len(merged_results), "source": "fmp"}

    return {"results": merged_results, "count": len(merged_results), "source": "fmp"}


def record_view(user: Any, stock: Stock) -> None:
    if not getattr(user, "is_authenticated", False):
        return

    view, created = RecentlyViewed.objects.get_or_create(user=user, stock=stock)
    if not created:
        view.save()

    stale_ids = list(
        RecentlyViewed.objects.filter(user=user)
        .order_by("-viewed_at")
        .values_list("pk", flat=True)[10:]
    )
    if stale_ids:
        RecentlyViewed.objects.filter(pk__in=stale_ids).delete()
