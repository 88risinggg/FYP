import requests


class TestPayments:
    """Test payment endpoints."""

    def test_payments_require_auth(self, base_url):
        """GET /api/payments without token should return 401."""
        response = requests.get(f"{base_url}/api/payments")
        assert response.status_code == 401

    def test_get_payments_workspace(self, base_url, auth_headers):
        """GET /api/payments should return outstanding invoices and payments."""
        response = requests.get(f"{base_url}/api/payments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "outstandingInvoices" in data
        assert "payments" in data
        assert isinstance(data["outstandingInvoices"], list)
        assert isinstance(data["payments"], list)

    def test_manual_payment_missing_invoice(self, base_url, auth_headers):
        """POST /api/payments/manual without invoice_id should return 400."""
        response = requests.post(f"{base_url}/api/payments/manual", headers=auth_headers, json={
            "amount": 100,
            "transaction_id": "TRF-TEST"
        })
        assert response.status_code == 400

    def test_manual_payment_missing_amount(self, base_url, auth_headers):
        """POST /api/payments/manual without amount should return 400."""
        response = requests.post(f"{base_url}/api/payments/manual", headers=auth_headers, json={
            "invoice_id": 1,
            "transaction_id": "TRF-TEST"
        })
        assert response.status_code == 400

    def test_stripe_link_missing_invoice(self, base_url, auth_headers):
        """POST /api/payments/stripe-link without invoice_id should return 400."""
        response = requests.post(f"{base_url}/api/payments/stripe-link", headers=auth_headers, json={})
        assert response.status_code == 400
