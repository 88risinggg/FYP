import pytest
import requests

BASE_URL = "http://localhost:5000"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def finance_token(base_url):
    """Login as Finance user and return the JWT token."""
    response = requests.post(f"{base_url}/api/auth/login", json={
        "email": "finance@paynivo.com",
        "password": "Password@123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(finance_token):
    """Return headers with Authorization Bearer token."""
    return {"Authorization": f"Bearer {finance_token}"}
