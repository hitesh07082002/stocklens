from django.urls import path

from .views import StockFinancialsView, StockPricesView, StockProfileView, StockSearchView


urlpatterns = [
    path("search/", StockSearchView.as_view(), name="stocks-search"),
    path("<str:symbol>/", StockProfileView.as_view(), name="stocks-profile"),
    path("<str:symbol>/financials/", StockFinancialsView.as_view(), name="stocks-financials"),
    path("<str:symbol>/prices/", StockPricesView.as_view(), name="stocks-prices"),
]
