import pytest
from django.urls import reverse

from .factories import UserFactory


pytestmark = pytest.mark.django_db


def test_signup_success(api_client):
    response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "new-user@example.com",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        },
        format="json",
    )

    assert response.status_code == 201
    assert set(response.data.keys()) == {"access", "refresh", "user"}
    assert response.data["user"]["email"] == "new-user@example.com"
    assert isinstance(response.data["user"]["id"], int)


def test_signup_duplicate_email(api_client):
    UserFactory(email="dupe@example.com")

    response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "dupe@example.com",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["email"] == ["A user with this email already exists."]


def test_signup_duplicate_email_is_case_insensitive(api_client):
    UserFactory(email="dupe@example.com")

    response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "DUPE@EXAMPLE.COM",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["email"] == ["A user with this email already exists."]


def test_signup_weak_password(api_client):
    response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "weak@example.com",
            "password": "short",
            "confirm_password": "short",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["password"] == [
        "This password is too short. It must contain at least 8 characters."
    ]


def test_signup_password_mismatch(api_client):
    response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "mismatch@example.com",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["confirm_password"] == ["Passwords do not match."]


def test_login_success(api_client):
    UserFactory(email="login@example.com", password="SecurePass123!")

    response = api_client.post(
        reverse("auth-login"),
        {
            "email": "login@example.com",
            "password": "SecurePass123!",
        },
        format="json",
    )

    assert response.status_code == 200
    assert set(response.data.keys()) == {"access", "refresh", "user"}
    assert response.data["user"]["email"] == "login@example.com"


def test_signup_normalizes_email(api_client):
    signup_response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "Mixed.User@Example.COM",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        },
        format="json",
    )

    assert signup_response.status_code == 201
    assert signup_response.data["user"]["email"] == "mixed.user@example.com"


def test_login_is_case_insensitive_for_email(api_client):
    UserFactory(email="mixed.user@example.com", password="SecurePass123!")

    login_response = api_client.post(
        reverse("auth-login"),
        {
            "email": "MIXED.user@example.com",
            "password": "SecurePass123!",
        },
        format="json",
    )

    assert login_response.status_code == 200
    assert login_response.data["user"]["email"] == "mixed.user@example.com"


def test_login_wrong_password(api_client):
    UserFactory(email="wrong@example.com", password="SecurePass123!")

    response = api_client.post(
        reverse("auth-login"),
        {
            "email": "wrong@example.com",
            "password": "not-the-right-password",
        },
        format="json",
    )

    assert response.status_code == 401
    assert response.data["detail"] == "No active account found with the given credentials."


def test_refresh_token(api_client):
    signup_response = api_client.post(
        reverse("auth-signup"),
        {
            "email": "refresh@example.com",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
        },
        format="json",
    )
    assert signup_response.status_code == 201
    original_refresh = signup_response.data["refresh"]

    response = api_client.post(
        reverse("auth-refresh"),
        {"refresh": original_refresh},
        format="json",
    )

    assert response.status_code == 200
    assert set(response.data.keys()) == {"access", "refresh"}
    assert response.data["refresh"] != original_refresh
