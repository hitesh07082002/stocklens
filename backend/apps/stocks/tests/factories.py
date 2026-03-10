import factory

from apps.stocks.models import Stock


class StockFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Stock

    symbol = factory.Sequence(lambda n: f"T{n:04d}")
    name = factory.Sequence(lambda n: f"Test Stock {n}")
    sector = "Technology"
    industry = "Software"
    exchange = "NASDAQ"
