from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stocks.constants import VALID_PRICE_RANGES
from apps.stocks.exceptions import StockNotFoundError, UpstreamServiceError
from apps.stocks.models import FinancialStatement
from apps.stocks.serializers import (
    StockFinancialsSerializer,
    StockPricesSerializer,
    StockProfileSerializer,
    StockSearchResponseSerializer,
)
from apps.stocks.services import stock_service


class StockServiceView(APIView):
    permission_classes = [AllowAny]

    def handle_service_exception(self, exc: Exception) -> Response:
        if isinstance(exc, StockNotFoundError):
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        if isinstance(exc, UpstreamServiceError):
            return Response(
                {"detail": "FMP API unreachable during synchronous cache-through fetch."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        raise exc


class StockSearchView(StockServiceView):
    def get(self, request, *args, **kwargs):
        query = request.query_params.get("q", "")
        if not query.strip():
            return Response(
                {"detail": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = stock_service.search(query)
        except Exception as exc:
            return self.handle_service_exception(exc)

        serializer = StockSearchResponseSerializer(payload)
        return Response(serializer.data)


class StockProfileView(StockServiceView):
    def get(self, request, symbol: str, *args, **kwargs):
        try:
            stock = stock_service.get_profile(symbol)
            stock_service.record_view(request.user, stock)
        except Exception as exc:
            return self.handle_service_exception(exc)

        serializer = StockProfileSerializer(stock)
        return Response(serializer.data)


class StockFinancialsView(StockServiceView):
    def get(self, request, symbol: str, *args, **kwargs):
        period = request.query_params.get("period", FinancialStatement.ANNUAL)
        if period != FinancialStatement.ANNUAL:
            return Response(
                {"detail": "Only annual period is supported in V1."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = stock_service.get_financials(symbol, period=period)
        except Exception as exc:
            return self.handle_service_exception(exc)

        serializer = StockFinancialsSerializer(payload)
        return Response(serializer.data)


class StockPricesView(StockServiceView):
    def get(self, request, symbol: str, *args, **kwargs):
        range_value = request.query_params.get("range", "1y")
        if range_value not in VALID_PRICE_RANGES:
            return Response(
                {"detail": "Query parameter 'range' must be one of: 1y, 3y, 5y."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = stock_service.get_prices(symbol, range_value=range_value)
        except Exception as exc:
            return self.handle_service_exception(exc)

        serializer = StockPricesSerializer(payload)
        return Response(serializer.data)

# Create your views here.
