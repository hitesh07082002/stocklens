from datetime import date, timedelta
from decimal import Decimal

from django.contrib import admin
from django.test import Client
from django.urls import reverse
from django.utils import timezone
import pytest

from apps.stocks.models import (
    DCFCalculation,
    FinancialStatement,
    KeyMetric,
    PriceHistory,
    RecentlyViewed,
    Stock,
    StockCache,
)
from apps.users.tests.factories import UserFactory
from .factories import StockFactory


pytestmark = pytest.mark.django_db


@pytest.fixture
def staff_client():
    admin_user = UserFactory(
        email="stocks-admin@example.com",
        password="SecurePass123!",
        is_staff=True,
        is_superuser=True,
    )
    client = Client()
    client.force_login(admin_user)
    return client


@pytest.fixture
def stock_admin_objects():
    user = UserFactory(email="investor@example.com")
    stock = StockFactory(symbol="AAPL", name="Apple Inc.")
    financial_statement = FinancialStatement.objects.create(
        stock=stock,
        statement_type=FinancialStatement.INCOME,
        period=FinancialStatement.ANNUAL,
        fiscal_year=2025,
        fiscal_quarter=None,
        data={"date": "2025-09-28", "revenue": 1000},
    )
    key_metric = KeyMetric.objects.create(
        stock=stock,
        period=FinancialStatement.ANNUAL,
        fiscal_year=2025,
        is_latest=True,
        pe_ratio=Decimal("25.1000"),
        roe=Decimal("0.2200"),
        market_cap=3_000_000_000_000,
    )
    price_history = PriceHistory.objects.create(
        stock=stock,
        date=date(2026, 3, 10),
        open=Decimal("180.0000"),
        high=Decimal("186.0000"),
        low=Decimal("179.5000"),
        close=Decimal("185.5000"),
        volume=52_340_100,
    )
    stock_cache = StockCache.objects.create(
        symbol=stock.symbol,
        endpoint="profile",
        params={},
        params_hash=StockCache.make_params_hash({}),
        response_data=[{"symbol": stock.symbol, "companyName": stock.name}],
        expires_at=timezone.now() + timedelta(hours=24),
    )
    dcf_calculation = DCFCalculation.objects.create(
        user=user,
        stock=stock,
        method=DCFCalculation.EPS,
        growth_rate=Decimal("0.1000"),
        discount_rate=Decimal("0.1200"),
        terminal_multiple=Decimal("18.00"),
        years_projected=10,
        fair_value_result=Decimal("210.0000"),
        current_price_at_save=Decimal("185.5000"),
    )
    recently_viewed = RecentlyViewed.objects.create(user=user, stock=stock)

    return {
        Stock: stock,
        FinancialStatement: financial_statement,
        KeyMetric: key_metric,
        PriceHistory: price_history,
        StockCache: stock_cache,
        DCFCalculation: dcf_calculation,
        RecentlyViewed: recently_viewed,
    }


@pytest.mark.parametrize(
    "model",
    [
        Stock,
        FinancialStatement,
        KeyMetric,
        PriceHistory,
        StockCache,
        DCFCalculation,
        RecentlyViewed,
    ],
)
def test_stock_models_are_registered_in_admin(model):
    assert admin.site.is_registered(model)


@pytest.mark.parametrize(
    "model",
    [
        Stock,
        FinancialStatement,
        KeyMetric,
        PriceHistory,
        StockCache,
        DCFCalculation,
        RecentlyViewed,
    ],
)
def test_stock_admin_changelists_load(staff_client, stock_admin_objects, model):
    response = staff_client.get(reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist"))

    assert response.status_code == 200
    assert b"Traceback" not in response.content


@pytest.mark.parametrize(
    "model",
    [
        Stock,
        FinancialStatement,
        KeyMetric,
        PriceHistory,
        StockCache,
        DCFCalculation,
        RecentlyViewed,
    ],
)
def test_stock_admin_add_pages_load(staff_client, model):
    response = staff_client.get(reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_add"))

    assert response.status_code == 200
    assert b"Traceback" not in response.content


@pytest.mark.parametrize(
    "model",
    [
        Stock,
        FinancialStatement,
        KeyMetric,
        PriceHistory,
        StockCache,
        DCFCalculation,
        RecentlyViewed,
    ],
)
def test_stock_admin_change_pages_load(staff_client, stock_admin_objects, model):
    object_instance = stock_admin_objects[model]
    response = staff_client.get(
        reverse(
            f"admin:{model._meta.app_label}_{model._meta.model_name}_change",
            args=[object_instance.pk],
        )
    )

    assert response.status_code == 200
    assert b"Traceback" not in response.content
