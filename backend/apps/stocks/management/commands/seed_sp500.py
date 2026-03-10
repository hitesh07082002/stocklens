from django.core.management.base import BaseCommand, CommandError

from apps.stocks.models import Stock
from apps.stocks.services.fmp_service import FMPAPIError
from apps.stocks.services.stock_service import get_metrics, get_profile


SP500_TICKERS_BY_MARKET_CAP = [
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "BRK-B", "LLY", "AVGO", "JPM",
    "V", "XOM", "MA", "COST", "WMT", "NFLX", "HD", "PG", "JNJ", "ABBV",
    "BAC", "KO", "ORCL", "CVX", "MRK", "ADBE", "CRM", "AMD", "PEP", "TMO",
    "CSCO", "ACN", "LIN", "MCD", "IBM", "DIS", "ABT", "PM", "NOW", "INTU",
    "QCOM", "GE", "TXN", "UNP", "AMGN", "ISRG", "CAT", "SPGI", "RTX", "VZ",
    "AXP", "BKNG", "PGR", "GS", "PLD", "MS", "NEE", "LOW", "SCHW", "HON",
    "TJX", "SYK", "CMCSA", "DHR", "BLK", "AMAT", "ETN", "T", "MDT", "DE",
    "VRTX", "COP", "ADI", "CB", "LMT", "MMC", "C", "TMUS", "PANW", "ANET",
]


class Command(BaseCommand):
    help = "Seed the bundled market-cap-ordered Week 2 stock universe using cache-aware profile + metrics fetches."

    def add_arguments(self, parser):
        parser.add_argument("--start", type=int, default=0)
        parser.add_argument("--count", type=int, default=80)

    def handle(self, *args, **options):
        start = options["start"]
        count = options["count"]
        if start < 0:
            raise CommandError("--start must be >= 0")
        if count <= 0:
            raise CommandError("--count must be > 0")
        if start >= len(SP500_TICKERS_BY_MARKET_CAP):
            raise CommandError(f"--start must be less than {len(SP500_TICKERS_BY_MARKET_CAP)}")

        tickers = SP500_TICKERS_BY_MARKET_CAP[start : start + count]
        total_fmp_calls = 0
        seeded = 0
        skipped: list[str] = []
        for index, symbol in enumerate(tickers, start=1):
            calls_used = 0
            try:
                stock, profile_calls = get_profile(symbol, include_quote=False, include_fetch_count=True)
                calls_used += profile_calls
                latest_metric, metric_calls = get_metrics(symbol, include_growth=False, include_fetch_count=True)
                calls_used += metric_calls
            except FMPAPIError as exc:
                calls_used += getattr(exc, "upstream_fetches", 0)
                total_fmp_calls += calls_used
                skipped.append(symbol)
                self.stdout.write(
                    self.style.WARNING(
                        f"[{index}/{len(tickers)}] Skipped {symbol} ({calls_used} FMP calls) - {exc.detail[:120]}"
                    )
                )
                continue

            Stock.objects.filter(symbol=stock.symbol).update(is_sp500=True)
            if latest_metric and latest_metric.market_cap and not stock.market_cap:
                Stock.objects.filter(symbol=stock.symbol).update(market_cap=latest_metric.market_cap)
            total_fmp_calls += calls_used
            seeded += 1
            self.stdout.write(f"[{index}/{len(tickers)}] Seeded {symbol} ({calls_used} FMP calls)")

        summary = f"Seeded {seeded} stocks, {total_fmp_calls} FMP calls used"
        if skipped:
            summary += f", skipped {len(skipped)}: {', '.join(skipped)}"
        self.stdout.write(self.style.SUCCESS(summary))
