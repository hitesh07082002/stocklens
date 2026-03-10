from rest_framework import serializers

from apps.stocks.models import Stock


class StockSearchResultSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    name = serializers.CharField()
    exchange = serializers.CharField(allow_blank=True)
    sector = serializers.CharField(allow_blank=True)


class StockSearchResponseSerializer(serializers.Serializer):
    results = StockSearchResultSerializer(many=True)
    count = serializers.IntegerField()
    source = serializers.ChoiceField(choices=("local", "fmp"))


class StockProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stock
        fields = (
            "symbol",
            "name",
            "sector",
            "industry",
            "exchange",
            "description",
            "ceo",
            "website",
            "market_cap",
            "last_price",
            "price_change",
            "price_change_pct",
            "is_sp500",
            "updated_at",
        )


class IncomeStatementSerializer(serializers.Serializer):
    fiscal_year = serializers.IntegerField()
    revenue = serializers.IntegerField(allow_null=True)
    gross_profit = serializers.IntegerField(allow_null=True)
    operating_income = serializers.IntegerField(allow_null=True)
    net_income = serializers.IntegerField(allow_null=True)
    eps_diluted = serializers.DecimalField(max_digits=10, decimal_places=4, allow_null=True)
    weighted_avg_shares_diluted = serializers.IntegerField(allow_null=True)
    gross_margin = serializers.DecimalField(max_digits=8, decimal_places=4, allow_null=True)
    operating_margin = serializers.DecimalField(max_digits=8, decimal_places=4, allow_null=True)
    net_margin = serializers.DecimalField(max_digits=8, decimal_places=4, allow_null=True)


class BalanceSheetSerializer(serializers.Serializer):
    fiscal_year = serializers.IntegerField()
    total_assets = serializers.IntegerField(allow_null=True)
    total_liabilities = serializers.IntegerField(allow_null=True)
    total_stockholders_equity = serializers.IntegerField(allow_null=True)
    total_debt = serializers.IntegerField(allow_null=True)
    cash_and_equivalents = serializers.IntegerField(allow_null=True)


class CashFlowStatementSerializer(serializers.Serializer):
    fiscal_year = serializers.IntegerField()
    operating_cash_flow = serializers.IntegerField(allow_null=True)
    free_cash_flow = serializers.IntegerField(allow_null=True)
    capital_expenditure = serializers.IntegerField(allow_null=True)


class StockFinancialsSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    period = serializers.CharField()
    income_statements = IncomeStatementSerializer(many=True)
    balance_sheets = BalanceSheetSerializer(many=True)
    cash_flow_statements = CashFlowStatementSerializer(many=True)


class PricePointSerializer(serializers.Serializer):
    date = serializers.DateField()
    close = serializers.DecimalField(max_digits=12, decimal_places=4)
    volume = serializers.IntegerField()


class StockPricesSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    range = serializers.CharField()
    prices = PricePointSerializer(many=True)
    count = serializers.IntegerField()
