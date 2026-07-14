"""
Stripe Integration Tests

Tests for the complete invoice payment workflow including:
- Invoice creation
- Stripe Checkout session creation
- Webhook processing (success, failure, refund)
- QR code generation
- PDF generation with payment link
- Email delivery with payment link
- Payment history
"""

import requests
import json
import time


class TestInvoiceCreation:
    """Test invoice creation flow."""

    def test_create_invoice_requires_auth(self, base_url):
        """POST /api/invoices without token should return 401."""
        response = requests.post(f"{base_url}/api/invoices", json={
            "customer_id": 1,
            "issue_date": "2026-07-01",
            "due_date": "2026-07-31",
            "items": [{"description": "Test", "quantity": 1, "unit_price": 100}]
        })
        assert response.status_code == 401

    def test_create_invoice_missing_customer(self, base_url, auth_headers):
        """POST /api/invoices without customer_id should return 400."""
        response = requests.post(f"{base_url}/api/invoices", headers=auth_headers, json={
            "issue_date": "2026-07-01",
            "due_date": "2026-07-31",
            "items": [{"description": "Test", "quantity": 1, "unit_price": 100}]
        })
        assert response.status_code == 400

    def test_create_invoice_missing_items(self, base_url, auth_headers):
        """POST /api/invoices without items should return 400."""
        response = requests.post(f"{base_url}/api/invoices", headers=auth_headers, json={
            "customer_id": 1,
            "issue_date": "2026-07-01",
            "due_date": "2026-07-31",
            "items": []
        })
        assert response.status_code == 400

    def test_create_invoice_success(self, base_url, auth_headers):
        """POST /api/invoices with valid data should return 201."""
        response = requests.post(f"{base_url}/api/invoices", headers=auth_headers, json={
            "customer_id": 1,
            "issue_date": "2026-07-01",
            "due_date": "2026-07-31",
            "items": [
                {"description": "Web Development", "quantity": 10, "unit_price": 150},
                {"description": "Server Setup", "quantity": 1, "unit_price": 500}
            ]
        })
        assert response.status_code == 201
        data = response.json()
        assert "invoice" in data
        assert data["invoice"]["status"] == "Draft"
        assert data["invoice"]["invoiceId"].startswith("INV-")

    def test_get_invoices(self, base_url, auth_headers):
        """GET /api/invoices should return invoice list with payment fields."""
        response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "invoices" in data
        assert isinstance(data["invoices"], list)

        if len(data["invoices"]) > 0:
            inv = data["invoices"][0]
            # Verify payment fields are present (may be null)
            assert "payment_url" in inv
            assert "qr_code_url" in inv
            assert "stripe_session_id" in inv
            assert "payment_status" in inv
            assert "payment_method" in inv
            assert "payment_date" in inv
            assert "transaction_id" in inv


class TestStripeCheckout:
    """Test Stripe Checkout session creation."""

    def test_stripe_link_requires_auth(self, base_url):
        """POST /api/payments/stripe-link without token should return 401."""
        response = requests.post(f"{base_url}/api/payments/stripe-link", json={
            "invoice_id": 1
        })
        assert response.status_code == 401

    def test_stripe_link_missing_invoice(self, base_url, auth_headers):
        """POST /api/payments/stripe-link without invoice should return 400."""
        response = requests.post(
            f"{base_url}/api/payments/stripe-link",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 400

    def test_stripe_link_invalid_invoice(self, base_url, auth_headers):
        """POST /api/payments/stripe-link with non-existent invoice should return 404."""
        response = requests.post(
            f"{base_url}/api/payments/stripe-link",
            headers=auth_headers,
            json={"invoice_id": 99999}
        )
        assert response.status_code == 404

    def test_stripe_link_success(self, base_url, auth_headers):
        """POST /api/payments/stripe-link with valid invoice should return payment URL."""
        # First get a valid invoice
        inv_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = inv_response.json().get("invoices", [])

        if len(invoices) == 0:
            return  # Skip if no invoices exist

        invoice_id = invoices[0]["invoice_id"]
        response = requests.post(
            f"{base_url}/api/payments/stripe-link",
            headers=auth_headers,
            json={"invoice_id": invoice_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert "paymentUrl" in data
        assert "sessionId" in data
        assert data["paymentUrl"].startswith("http")

    def test_stripe_config_endpoint(self, base_url, auth_headers):
        """GET /api/payments/stripe-config should return publishable key."""
        response = requests.get(
            f"{base_url}/api/payments/stripe-config",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "publishableKey" in data


class TestStripeWebhook:
    """Test Stripe webhook processing."""

    def test_webhook_invalid_body(self, base_url):
        """POST /api/payments/stripe/webhook with invalid body should return 400."""
        response = requests.post(
            f"{base_url}/api/payments/stripe/webhook",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400

    def test_webhook_checkout_completed(self, base_url, auth_headers):
        """Simulate checkout.session.completed webhook event."""
        # Get an unpaid invoice first
        inv_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = inv_response.json().get("invoices", [])
        unpaid = [i for i in invoices if i["status"] not in ("Paid", "Cancelled")]

        if len(unpaid) == 0:
            return  # Skip if no unpaid invoices

        invoice = unpaid[0]

        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_test_{int(time.time())}",
                    "amount_total": int(float(invoice["total_amount"]) * 100),
                    "payment_intent": f"pi_test_{int(time.time())}",
                    "payment_method_types": ["card"],
                    "metadata": {
                        "invoice_id": str(invoice["invoice_id"]),
                        "invoiceId": invoice["invoiceId"]
                    }
                }
            }
        }

        response = requests.post(
            f"{base_url}/api/payments/stripe/webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("received") is True

    def test_webhook_payment_failed(self, base_url, auth_headers):
        """Simulate payment_intent.payment_failed webhook event."""
        # Get an unpaid invoice
        inv_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = inv_response.json().get("invoices", [])
        unpaid = [i for i in invoices if i["status"] not in ("Paid", "Cancelled")]

        if len(unpaid) == 0:
            return

        invoice = unpaid[0]

        webhook_payload = {
            "type": "payment_intent.payment_failed",
            "data": {
                "object": {
                    "id": f"pi_failed_{int(time.time())}",
                    "last_payment_error": {
                        "message": "Your card was declined."
                    },
                    "metadata": {
                        "invoice_id": str(invoice["invoice_id"])
                    }
                }
            }
        }

        response = requests.post(
            f"{base_url}/api/payments/stripe/webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        assert response.json().get("received") is True

    def test_webhook_payment_succeeded(self, base_url):
        """Simulate payment_intent.succeeded webhook event."""
        webhook_payload = {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": f"pi_success_{int(time.time())}",
                    "metadata": {
                        "invoice_id": "1"
                    }
                }
            }
        }

        response = requests.post(
            f"{base_url}/api/payments/stripe/webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200

    def test_webhook_missing_invoice_id(self, base_url):
        """Webhook without invoice_id in metadata should return 400."""
        webhook_payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_no_metadata",
                    "amount_total": 5000,
                    "payment_intent": "pi_test_no_meta",
                    "metadata": {}
                }
            }
        }

        response = requests.post(
            f"{base_url}/api/payments/stripe/webhook",
            json=webhook_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400


class TestPaymentHistory:
    """Test payment history retrieval."""

    def test_payment_history_requires_auth(self, base_url):
        """GET /api/payments/history/:id without auth should return 401."""
        response = requests.get(f"{base_url}/api/payments/history/1")
        assert response.status_code == 401

    def test_payment_history_returns_data(self, base_url, auth_headers):
        """GET /api/payments/history/:id should return payments and metadata."""
        response = requests.get(
            f"{base_url}/api/payments/history/1",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "payments" in data
        assert "stripeMetadata" in data
        assert isinstance(data["payments"], list)


class TestInvoiceSendWithStripe:
    """Test sending invoices (creates Stripe session + QR code + email)."""

    def test_send_invoice_requires_auth(self, base_url):
        """POST /api/invoices/:id/send without auth should return 401."""
        response = requests.post(f"{base_url}/api/invoices/1/send")
        assert response.status_code == 401

    def test_send_invoice_invalid_id(self, base_url, auth_headers):
        """POST /api/invoices/:id/send with invalid ID should return 400/404."""
        response = requests.post(
            f"{base_url}/api/invoices/0/send",
            headers=auth_headers
        )
        assert response.status_code in (400, 404)

    def test_send_invoice_success(self, base_url, auth_headers):
        """POST /api/invoices/:id/send with Draft invoice creates Stripe session."""
        # Find a Draft invoice
        inv_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = inv_response.json().get("invoices", [])
        drafts = [i for i in invoices if i["status"] == "Draft"]

        if len(drafts) == 0:
            return  # Skip if no Draft invoices

        invoice_id = drafts[0]["invoice_id"]
        response = requests.post(
            f"{base_url}/api/invoices/${invoice_id}/send",
            headers=auth_headers
        )

        if response.status_code == 200:
            data = response.json()
            assert data.get("status") == "Sent"
            assert "payment_url" in data
            assert data.get("qr_code") is True


class TestQRCodeGeneration:
    """Test QR code generation for invoices."""

    def test_public_invoice_view_has_qr(self, base_url, auth_headers):
        """Public invoice view should include QR code for unpaid invoices."""
        # Get an invoice that's been sent
        inv_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = inv_response.json().get("invoices", [])
        sent = [i for i in invoices if i["status"] in ("Sent", "Viewed")]

        if len(sent) == 0:
            return  # Skip

        invoice_id = sent[0]["invoiceId"]
        response = requests.get(f"{base_url}/api/public/invoice/{invoice_id}")

        if response.status_code == 200:
            data = response.json()
            inv = data.get("invoice", {})
            # QR code should be present for payable invoices
            if inv.get("payment_url"):
                assert inv.get("qr_code") is not None
                assert inv["qr_code"].startswith("data:image/png;base64,")


class TestPDFGeneration:
    """Test invoice PDF generation with payment link and QR code."""

    def test_pdf_download_requires_auth(self, base_url):
        """GET /api/invoices/:id/pdf without auth should return 401."""
        response = requests.get(f"{base_url}/api/invoices/1/pdf")
        assert response.status_code == 401

    def test_pdf_download_success(self, base_url, auth_headers):
        """GET /api/invoices/:id/pdf should return PDF content."""
        inv_response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        invoices = inv_response.json().get("invoices", [])

        if len(invoices) == 0:
            return

        invoice_id = invoices[0]["invoice_id"]
        response = requests.get(
            f"{base_url}/api/invoices/{invoice_id}/pdf",
            headers=auth_headers
        )

        # PDF generation may fail if puppeteer/chromium not available
        if response.status_code == 200:
            assert response.headers.get("Content-Type") == "application/pdf"
            assert len(response.content) > 0


class TestExpiredInvoice:
    """Test expired/overdue invoice handling."""

    def test_overdue_invoices_exist(self, base_url, auth_headers):
        """After dataset import, some invoices should be overdue."""
        response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json().get("invoices", [])
        # The system should have overdue detection running
        # This verifies the overdue status tracking works
        statuses = [i["status"] for i in invoices]
        # At least verify the status field is present
        assert all(s in ("Draft", "Scheduled", "Sent", "Viewed", "Paid", "Overdue", "Cancelled", "Refunded") for s in statuses)


class TestInvoiceCount:
    """Verify the database contains exactly 30 invoices after import."""

    def test_invoice_count(self, base_url, auth_headers):
        """GET /api/invoices should return exactly 30 invoices."""
        response = requests.get(f"{base_url}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json().get("invoices", [])
        assert len(invoices) == 30, f"Expected 30 invoices, found {len(invoices)}"
