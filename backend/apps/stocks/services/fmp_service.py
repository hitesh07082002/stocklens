import logging
from datetime import date
from typing import Any

import requests
from django.conf import settings

from apps.stocks.exceptions import UpstreamServiceError


logger = logging.getLogger(__name__)
FMP_BASE_URL = "https://financialmodelingprep.com/stable"


class FMPAPIError(UpstreamServiceError):
    def __init__(self, endpoint: str, status_code: int | None, detail: str, upstream_fetches: int = 0):
        self.endpoint = endpoint
        self.status_code = status_code
        self.detail = detail
        self.upstream_fetches = upstream_fetches
        super().__init__(detail)


def fetch(endpoint: str, params: dict[str, Any]) -> Any:
    if not settings.FMP_API_KEY:
        raise FMPAPIError(endpoint, None, "FMP_API_KEY is not configured.")

    url = f"{FMP_BASE_URL}/{endpoint.lstrip('/')}"
    request_params = {**params, "apikey": settings.FMP_API_KEY}
    logger.info("FMP request %s params=%s", endpoint, params)

    try:
        response = requests.get(url, params=request_params, timeout=10)
    except requests.RequestException as exc:
        raise FMPAPIError(endpoint, None, str(exc)) from exc

    if response.status_code >= 400:
        raise FMPAPIError(endpoint, response.status_code, response.text or response.reason)

    try:
        return response.json()
    except ValueError as exc:
        raise FMPAPIError(endpoint, response.status_code, "Invalid JSON received from FMP.") from exc


def fetch_profile(symbol: str) -> Any:
    return fetch("profile", {"symbol": symbol})


def fetch_quote(symbol: str) -> Any:
    return fetch("quote", {"symbol": symbol})


def fetch_ratios(symbol: str, period: str = "annual") -> Any:
    return fetch("ratios", {"symbol": symbol, "period": period})


def fetch_key_metrics(symbol: str, period: str = "annual") -> Any:
    return fetch("key-metrics", {"symbol": symbol, "period": period})


def fetch_financial_growth(symbol: str, period: str = "annual") -> Any:
    return fetch("financial-growth", {"symbol": symbol, "period": period})


def fetch_income_statement(symbol: str, period: str = "annual") -> Any:
    return fetch("income-statement", {"symbol": symbol, "period": period})


def fetch_cash_flow_statement(symbol: str, period: str = "annual") -> Any:
    return fetch("cash-flow-statement", {"symbol": symbol, "period": period})


def fetch_balance_sheet_statement(symbol: str, period: str = "annual") -> Any:
    return fetch("balance-sheet-statement", {"symbol": symbol, "period": period})


def fetch_price_history(symbol: str, start_date: date, end_date: date) -> Any:
    return fetch(
        "historical-price-eod/full",
        {
            "symbol": symbol,
            "from": start_date.isoformat(),
            "to": end_date.isoformat(),
        },
    )


def fetch_search_name(query: str, exchange: str) -> Any:
    return fetch("search-name", {"query": query, "exchange": exchange})
