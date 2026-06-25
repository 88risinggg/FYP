import requests


class TestCustomers:
    """Test customer endpoints."""

    def test_customers_require_auth(self, base_url):
        """GET /api/customers without token should return 401."""
        response = requests.get(f"{base_url}/api/customers")
        assert response.status_code == 401

    def test_get_customers(self, base_url, auth_headers):
        """GET /api/customers should return customers list."""
        response = requests.get(f"{base_url}/api/customers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert isinstance(data["customers"], list)
        assert len(data["customers"]) > 0

    def test_customer_fields(self, base_url, auth_headers):
        """Customers should include required fields."""
        response = requests.get(f"{base_url}/api/customers", headers=auth_headers)
        data = response.json()
        customer = data["customers"][0]
        assert "customer_id" in customer
        assert "name" in customer
        assert "email" in customer
