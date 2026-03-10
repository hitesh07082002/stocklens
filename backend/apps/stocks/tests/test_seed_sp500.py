from io import StringIO

import pytest
from django.core.management import call_command

from apps.stocks.management.commands import seed_sp500 as seed_command
from apps.stocks.models import FinancialStatement, KeyMetric, Stock
from apps.stocks.services.fmp_service import FMPAPIError


pytestmark = pytest.mark.django_db


def install_seed_fakes(monkeypatch, symbols: list[str], failing_symbols: set[str] | None = None) -> None:
    failing_symbols = failing_symbols or set()
    market_caps = {symbol: (len(symbols) - index) * 100 for index, symbol in enumerate(symbols)}

    monkeypatch.setattr(seed_command, "SP500_TICKERS_BY_MARKET_CAP", symbols)

    def fake_get_profile(symbol: str, include_quote: bool = False, include_fetch_count: bool = False):
        stock, _ = Stock.objects.get_or_create(
            symbol=symbol,
            defaults={"name": f"{symbol} Holdings"},
        )
        if include_fetch_count:
            return stock, 1
        return stock

    def fake_get_metrics(symbol: str, include_growth: bool = False, include_fetch_count: bool = False):
        if symbol in failing_symbols:
            raise FMPAPIError("key-metrics", 402, "payment required", upstream_fetches=1)

        stock = Stock.objects.get(symbol=symbol)
        metric, _ = KeyMetric.objects.get_or_create(
            stock=stock,
            period=FinancialStatement.ANNUAL,
            fiscal_year=2024,
            defaults={"market_cap": market_caps[symbol]},
        )
        if include_fetch_count:
            return metric, 2
        return metric

    monkeypatch.setattr(seed_command, "get_profile", fake_get_profile)
    monkeypatch.setattr(seed_command, "get_metrics", fake_get_metrics)


def test_seed_sp500_batches_with_start_and_count(monkeypatch):
    install_seed_fakes(monkeypatch, ["AAPL", "MSFT", "NVDA", "AMZN"])
    stdout = StringIO()

    call_command("seed_sp500", start=1, count=2, stdout=stdout)

    flagged_symbols = set(Stock.objects.filter(is_sp500=True).values_list("symbol", flat=True))
    assert flagged_symbols == {"MSFT", "NVDA"}
    assert "[1/2] Seeded MSFT (3 FMP calls)" in stdout.getvalue()
    assert "[2/2] Seeded NVDA (3 FMP calls)" in stdout.getvalue()


def test_seed_sp500_rerun_is_idempotent(monkeypatch):
    install_seed_fakes(monkeypatch, ["AAPL"])

    call_command("seed_sp500", count=1)
    call_command("seed_sp500", count=1)

    assert Stock.objects.filter(symbol="AAPL").count() == 1
    assert KeyMetric.objects.filter(stock_id="AAPL", period=FinancialStatement.ANNUAL, fiscal_year=2024).count() == 1
    assert Stock.objects.get(symbol="AAPL").is_sp500 is True


def test_seed_sp500_failure_keeps_existing_sp500_flag(monkeypatch):
    install_seed_fakes(monkeypatch, ["AAPL"], failing_symbols={"AAPL"})
    Stock.objects.create(symbol="AAPL", name="Apple Inc.", is_sp500=True)
    stdout = StringIO()

    call_command("seed_sp500", count=1, stdout=stdout)

    assert Stock.objects.get(symbol="AAPL").is_sp500 is True
    assert "Skipped AAPL (2 FMP calls)" in stdout.getvalue()
