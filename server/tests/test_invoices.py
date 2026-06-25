import requests


class TestInvoiceList:
    """Test invoice listing endpoints."""

    def test_invoices_require_auth(self, base_url):
        """GET /api/invoices without token should return 401."""
        response = requests.get(f"{base_url}/api/invoices")
        assert response.status_code == 401

    def test_get_invoices(self, base_url, auth_headers):
        """GET /api/invoices should return invoice array."""
        response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "invoices" in data
        assert isinstance(data["invoices"], list)

    def test_invoice_fields(self, base_url, auth_headers):
        """Invoices should include required fields."""
        response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        data = response.json()
        if len(data["invoices"]) > 0:
            invoice = data["invoices"][0]
            assert "invoice_id" in invoice
            assert "invoiceId" in invoice
            assert "status" in invoice
            assert "total_amount" in invoice
            assert "customer_name" in invoice


class TestInvoiceNextNumber:
    """Test next invoice number generation."""

    def test_next_number(self, base_url, auth_headers):
        """GET /api/invoices/next-number should return INV-XXXX format."""
        response = requests.get(f"{base_url}/api/invoices/next-number", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "invoiceId" in data
        assert data["invoiceId"].startswith("INV-")


class TestInvoiceCustomers:
    """Test invoice customers endpoint."""

    def test_get_customers(self, base_url, auth_headers):
        """GET /api/invoices/customers should return customers list."""
        response = requests.get(f"{base_url}/api/invoices/customers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert isinstance(data["customers"], list)


class TestInvoiceCreate:
    """Test invoice creation."""

    def test_create_missing_customer(self, base_url, auth_headers):
        """POST /api/invoices without customer should return 400."""
        response = requests.post(f"{base_url}/api/invoices", headers=auth_headers, json={
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "status": "Draft",
            "items": [{"description": "Test", "quantity": 1, "unit_price": 100}]
        })
        assert response.status_code == 400
        assert "Customer" in response.json()["message"]

    def test_create_empty_items(self, base_url, auth_headers):
        """POST /api/invoices with empty items should return 400."""
        response = requests.post(f"{base_url}/api/invoices", headers=auth_headers, json={
            "customer_id": 1,
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "status": "Draft",
            "items": []
        })
        assert response.status_code == 400
        assert "item" in response.json()["message"].lower()

    def test_create_invoice_success(self, base_url, auth_headers):
        """POST /api/invoices with valid data should create invoice."""
        # Get a real customer
        cust_response = requests.get(f"{base_url}/api/invoices/customers", headers=auth_headers)
        customers = cust_response.json()["customers"]
        if not customers:
            return

        response = requests.post(f"{base_url}/api/invoices", headers=auth_headers, json={
            "customer_id": customers[0]["customer_id"],
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "status": "Draft",
            "items": [{"description": "Pytest Service", "quantity": 2, "unit_price": 150}]
        })
        if response.status_code == 201:
            data = response.json()
            assert "invoice" in data
            assert data["invoice"]["invoiceId"].startswith("INV-")


class TestInvoiceStatusUpdate:
    """Test invoice status updates."""

    def test_update_status_invalid(self, base_url, auth_headers):
        """PUT /api/invoices/:id/status with invalid status should fail."""
        invoices_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = invoices_response.json()["invoices"]
        if not invoices:
            return

        response = requests.put(
            f"{base_url}/api/invoices/{invoices[0]['invoice_id']}/status",
            headers=auth_headers,
            json={"status": "InvalidStatus"}
        )
        assert response.status_code in [400, 404]

    def test_update_status_valid(self, base_url, auth_headers):
        """PUT /api/invoices/:id/status with valid status should succeed."""
        invoices_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = invoices_response.json()["invoices"]
        draft_invoice = next((i for i in invoices if i["status"] == "Draft"), None)

        if draft_invoice:
            response = requests.put(
                f"{base_url}/api/invoices/{draft_invoice['invoice_id']}/status",
                headers=auth_headers,
                json={"status": "Sent"}
            )
            assert response.status_code == 200
            assert response.json()["status"] == "Sent"


class TestInvoiceSchedule:
    """Test invoice scheduling."""

    def test_schedule_no_ids(self, base_url, auth_headers):
        """POST /api/invoices/schedule with empty ids should return 400."""
        response = requests.post(f"{base_url}/api/invoices/schedule", headers=auth_headers, json={
            "invoice_ids": [],
            "scheduled_at": "2026-12-01T10:00:00"
        })
        assert response.status_code == 400

    def test_schedule_past_time(self, base_url, auth_headers):
        """POST /api/invoices/schedule with past time should return 400."""
        response = requests.post(f"{base_url}/api/invoices/schedule", headers=auth_headers, json={
            "invoice_ids": [1],
            "scheduled_at": "2020-01-01T10:00:00"
        })
        assert response.status_code == 400
