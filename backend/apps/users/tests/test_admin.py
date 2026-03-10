from django.contrib import admin
from django.test import Client
from django.urls import reverse
import pytest

from apps.users.models import CustomUser
from .factories import UserFactory


pytestmark = pytest.mark.django_db


@pytest.fixture
def staff_client():
    admin_user = UserFactory(
        email="admin@example.com",
        password="SecurePass123!",
        is_staff=True,
        is_superuser=True,
    )
    client = Client()
    client.force_login(admin_user)
    return client


def test_custom_user_is_registered_in_admin():
    assert admin.site.is_registered(CustomUser)


@pytest.mark.parametrize(
    "url_name",
    [
        "admin:index",
        "admin:users_customuser_changelist",
        "admin:users_customuser_add",
    ],
)
def test_user_admin_pages_load(staff_client, url_name):
    response = staff_client.get(reverse(url_name))

    assert response.status_code == 200
    assert b"Traceback" not in response.content


def test_custom_user_change_page_loads(staff_client):
    user = UserFactory(email="member@example.com")

    response = staff_client.get(reverse("admin:users_customuser_change", args=[user.pk]))

    assert response.status_code == 200
    assert b"member@example.com" in response.content
    assert b"Traceback" not in response.content
