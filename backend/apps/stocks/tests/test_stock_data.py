import re
from datetime import timedelta
from decimal import Decimal

import pytest
import responses
from django.urls import reverse
from django.utils import timezone

from apps.stocks.models import FinancialStatement, KeyMetric, PriceHistory, Stock, StockCache
from apps.stocks.services.stock_service import get_financials, get_metrics, get_profile
from apps.stocks.tests.factories import StockFactory


pytestmark = pytest.mark.django_db

FMP_BASE = "https://financialmodelingprep.com/stable"


def add_json_response(mock_responses: responses.RequestsMock, endpoint: str, payload, status: int = 200) -> None:
    mock_responses.add(
        responses.GET,
        re.compile(rf"{re.escape(FMP_BASE)}/{re.escape(endpoint)}.*"),
        json=payload,
        status=status,
    )


def profile_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "companyName": "Apple Inc.",
            "sector": "Technology",
            "industry": "Consumer Electronics",
            "exchangeShortName": "NASDAQ",
            "marketCap": 3200000000000,
            "description": "Maker of iPhone.",
            "ceo": "Tim Cook",
            "website": "https://www.apple.com",
            "price": 185.50,
            "change": 2.15,
            "changePercentage": 1.17,
        }
    ]


def quote_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "price": 186.00,
            "change": 2.50,
            "changePercentage": 1.25,
            "marketCap": 3210000000000,
        }
    ]


def income_statement_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "calendarYear": "2024",
            "date": "2024-09-28",
            "revenue": 383285000000,
            "grossProfit": 169148000000,
            "operatingIncome": 114301000000,
            "netIncome": 93736000000,
            "epsDiluted": 6.11,
            "weightedAverageShsOutDil": 15408095000,
        },
        {
            "symbol": symbol,
            "calendarYear": "2023",
            "date": "2023-09-30",
            "revenue": 394328000000,
            "grossProfit": 170782000000,
            "operatingIncome": 114301000000,
            "netIncome": 96995000000,
            "epsDiluted": 6.13,
            "weightedAverageShsOutDil": 15744231000,
        },
    ]


def balance_sheet_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "calendarYear": "2024",
            "date": "2024-09-28",
            "totalAssets": 364980000000,
            "totalLiabilities": 308030000000,
            "totalStockholdersEquity": 56950000000,
            "totalDebt": 108040000000,
            "cashAndCashEquivalents": 29965000000,
        }
    ]


def cash_flow_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "calendarYear": "2024",
            "date": "2024-09-28",
            "operatingCashFlow": 118254000000,
            "freeCashFlow": 108807000000,
            "capitalExpenditure": -9447000000,
        }
    ]


def ratios_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "calendarYear": "2024",
            "date": "2024-09-28",
            "priceToEarningsRatio": 25.4,
            "priceToSalesRatio": 8.2,
            "priceToFreeCashFlowRatio": 22.1,
            "debtToEquityRatio": 1.87,
            "dividendYield": 0.0055,
            "dividendPayoutRatio": 0.148,
            "grossProfitMargin": 0.4413,
            "operatingProfitMargin": 0.2981,
            "netProfitMargin": 0.2444,
            "freeCashFlowPerShare": 6.92,
            "revenuePerShare": 24.8,
        }
    ]


def key_metrics_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "calendarYear": "2024",
            "date": "2024-09-28",
            "returnOnEquity": 1.47,
            "returnOnAssets": 0.28,
            "returnOnInvestedCapital": 0.54,
            "marketCap": 3200000000000,
            "enterpriseValue": 3300000000000,
            "freeCashFlowYield": 0.03,
            "currentRatio": 0.988,
            "earningsYield": 0.039,
        }
    ]


def financial_growth_payload(symbol: str = "AAPL") -> list[dict]:
    return [
        {
            "symbol": symbol,
            "calendarYear": "2024",
            "date": "2024-09-28",
            "revenueGrowth": 0.024,
            "netIncomeGrowth": -0.0319,
            "epsgrowth": -0.0016,
            "freeCashFlowGrowth": 0.092,
        }
    ]


def historical_price_payload(symbol: str = "AAPL") -> dict:
    today = timezone.now().date()
    return {
        "symbol": symbol,
        "historical": [
            {
                "date": today.isoformat(),
                "open": 184.10,
                "high": 186.10,
                "low": 183.80,
                "close": 185.50,
                "volume": 52340100,
            },
            {
                "date": (today - timedelta(days=1)).isoformat(),
                "open": 183.10,
                "high": 184.20,
                "low": 182.50,
                "close": 183.25,
                "volume": 48920000,
            },
        ],
    }


@responses.activate
def test_cache_miss_fetches_fmp_once_per_endpoint():
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", quote_payload())

    stock = get_profile("AAPL")

    assert stock.symbol == "AAPL"
    assert stock.last_price == Decimal("186.0000")
    assert stock.price_change_pct == Decimal("0.0125")
    assert StockCache.objects.count() == 2
    assert len(responses.calls) == 2


@responses.activate
def test_cache_hit_avoids_repeat_fmp_calls():
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", quote_payload())

    first_stock = get_profile("AAPL")
    second_stock = get_profile("AAPL")

    assert first_stock.pk == second_stock.pk
    assert StockCache.objects.count() == 2
    assert len(responses.calls) == 2


@responses.activate
def test_warm_cache_profile_read_preserves_stock_updated_at():
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", quote_payload())

    get_profile("AAPL")
    frozen_updated_at = timezone.now() - timedelta(days=30)
    Stock.objects.filter(symbol="AAPL").update(updated_at=frozen_updated_at)

    get_profile("AAPL")

    assert Stock.objects.get(symbol="AAPL").updated_at == frozen_updated_at
    assert len(responses.calls) == 2


@responses.activate
def test_profile_view_uses_quote_price_and_normalizes_change_percentage(api_client):
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", quote_payload())

    response = api_client.get(reverse("stocks-profile", kwargs={"symbol": "AAPL"}))

    assert response.status_code == 200
    assert response.data["symbol"] == "AAPL"
    assert response.data["last_price"] == "186.0000"
    assert response.data["price_change"] == "2.5000"
    assert response.data["price_change_pct"] == "0.0125"


@responses.activate
def test_profile_view_falls_back_to_profile_price_when_quote_fails(api_client):
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", {"error": "payment required"}, status=402)

    response = api_client.get(reverse("stocks-profile", kwargs={"symbol": "AAPL"}))

    assert response.status_code == 200
    assert response.data["last_price"] == "185.5000"
    assert response.data["price_change"] == "2.1500"
    assert response.data["price_change_pct"] == "0.0117"


@responses.activate
def test_profile_view_returns_502_when_quote_fails_outside_fallback_case(api_client):
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", {"error": "temporarily unavailable"}, status=503)

    response = api_client.get(reverse("stocks-profile", kwargs={"symbol": "AAPL"}))

    assert response.status_code == 502
    assert response.data["detail"] == "FMP API unreachable during synchronous cache-through fetch."


@responses.activate
def test_profile_view_returns_404_for_unknown_stock(api_client):
    add_json_response(responses, "profile", [])

    response = api_client.get(reverse("stocks-profile", kwargs={"symbol": "ZZZZ"}))

    assert response.status_code == 404
    assert response.data["detail"] == "Stock 'ZZZZ' not found."


def test_search_view_uses_local_db_results_before_fmp(api_client):
    StockFactory(symbol="AAPL", name="Apple Inc.", exchange="NASDAQ", sector="Technology")

    response = api_client.get(reverse("stocks-search"), {"q": "AAPL"})

    assert response.status_code == 200
    assert response.data["source"] == "local"
    assert response.data["count"] == 1
    assert response.data["results"][0]["symbol"] == "AAPL"


@responses.activate
def test_search_view_falls_back_to_fmp_search_name_only(api_client):
    add_json_response(
        responses,
        "search-name",
        [
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ"},
            {"symbol": "AAPLX", "name": "Apple Growth Fund", "exchange": "NYSE"},
        ],
    )
    add_json_response(
        responses,
        "search-name",
        [{"symbol": "AAPLX", "name": "Apple Growth Fund", "exchange": "NYSE"}],
    )

    response = api_client.get(reverse("stocks-search"), {"q": "Apple"})

    assert response.status_code == 200
    assert response.data["source"] == "fmp"
    assert response.data["count"] == 2
    assert {item["symbol"] for item in response.data["results"]} == {"AAPL", "AAPLX"}


@responses.activate
def test_financials_view_is_self_sufficient_on_cold_cache(api_client):
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", quote_payload())
    add_json_response(responses, "income-statement", income_statement_payload())
    add_json_response(responses, "balance-sheet-statement", balance_sheet_payload())
    add_json_response(responses, "cash-flow-statement", cash_flow_payload())

    response = api_client.get(reverse("stocks-financials", kwargs={"symbol": "AAPL"}))

    assert response.status_code == 200
    assert response.data["symbol"] == "AAPL"
    assert response.data["income_statements"][0]["fiscal_year"] == 2024
    assert response.data["income_statements"][0]["gross_margin"] == "0.4413"
    assert FinancialStatement.objects.filter(stock_id="AAPL").count() == 4


@responses.activate
def test_warm_cache_financials_read_preserves_statement_fetched_at():
    StockFactory(symbol="AAPL", name="Apple Inc.", exchange="NASDAQ", sector="Technology")
    add_json_response(responses, "income-statement", income_statement_payload())
    add_json_response(responses, "balance-sheet-statement", balance_sheet_payload())
    add_json_response(responses, "cash-flow-statement", cash_flow_payload())

    get_financials("AAPL")
    frozen_fetched_at = timezone.now() - timedelta(days=30)
    statement = FinancialStatement.objects.get(
        stock_id="AAPL",
        statement_type=FinancialStatement.INCOME,
        fiscal_year=2024,
    )
    FinancialStatement.objects.filter(pk=statement.pk).update(fetched_at=frozen_fetched_at)

    get_financials("AAPL")

    statement.refresh_from_db()
    assert statement.fetched_at == frozen_fetched_at
    assert len(responses.calls) == 3


@responses.activate
def test_warm_cache_metrics_read_preserves_key_metric_fetched_at():
    StockFactory(symbol="AAPL", name="Apple Inc.", exchange="NASDAQ", sector="Technology")
    add_json_response(responses, "ratios", ratios_payload())
    add_json_response(responses, "key-metrics", key_metrics_payload())
    add_json_response(responses, "financial-growth", financial_growth_payload())

    get_metrics("AAPL")
    frozen_fetched_at = timezone.now() - timedelta(days=30)
    metric = KeyMetric.objects.get(stock_id="AAPL", fiscal_year=2024, period=FinancialStatement.ANNUAL)
    KeyMetric.objects.filter(pk=metric.pk).update(fetched_at=frozen_fetched_at)

    get_metrics("AAPL")

    metric.refresh_from_db()
    assert metric.fetched_at == frozen_fetched_at
    assert len(responses.calls) == 3


@responses.activate
def test_prices_view_is_self_sufficient_on_cold_cache(api_client):
    add_json_response(responses, "profile", profile_payload())
    add_json_response(responses, "quote", quote_payload())
    add_json_response(responses, "historical-price-eod/full", historical_price_payload())

    response = api_client.get(reverse("stocks-prices", kwargs={"symbol": "AAPL"}), {"range": "1y"})

    assert response.status_code == 200
    assert response.data["symbol"] == "AAPL"
    assert response.data["count"] == 2
    assert response.data["prices"][0]["close"] == "185.5000"
    assert PriceHistory.objects.filter(stock_id="AAPL").count() == 2
