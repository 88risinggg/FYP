import requests


class TestAuthentication:
    """Test authentication endpoints."""

    def test_login_missing_fields(self, base_url):
        """POST /api/auth/login with missing fields should return 400."""
        response = requests.post(f"{base_url}/api/auth/login", json={})
        assert response.status_code == 400

    def test_login_invalid_email(self, base_url):
        """POST /api/auth/login with wrong email should return 401."""
        response = requests.post(f"{base_url}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "Password@123"
        })
        assert response.status_code == 401
        assert response.json()["message"] == "Invalid email or password"

    def test_login_wrong_password(self, base_url):
        """POST /api/auth/login with wrong password should return 401."""
        response = requests.post(f"{base_url}/api/auth/login", json={
            "email": "finance@paynivo.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert response.json()["message"] == "Invalid email or password"

    def test_login_success(self, base_url):
        """POST /api/auth/login with valid credentials should return token and user."""
        response = requests.post(f"{base_url}/api/auth/login", json={
            "email": "finance@paynivo.com",
            "password": "Password@123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "Finance"
        assert data["user"]["email"] == "finance@paynivo.com"
        assert "invoicing" in data["user"]["allowedModules"]
