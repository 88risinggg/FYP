import requests


class TestReports:
    """Test report endpoints."""

    def test_reports_require_auth(self, base_url):
        """GET /api/reports/invoices without token should return 401."""
        response = requests.get(f"{base_url}/api/reports/invoices")
        assert response.status_code == 401

    def test_get_invoice_reports(self, base_url, auth_headers):
        """GET /api/reports/invoices should return report data."""
        response = requests.get(f"{base_url}/api/reports/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "monthlyRevenue" in data
        assert "statusDistribution" in data
        assert "agingReceivables" in data
        assert "topCustomers" in data

    def test_financial_statement_included(self, base_url, auth_headers):
        """Reports should include financial statement data."""
        response = requests.get(f"{base_url}/api/reports/invoices", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "financialStatement" in data
        fs = data["financialStatement"]
        assert "incomeStatement" in fs
        assert "cashFlow" in fs
        assert "ratios" in fs

    def test_summary_fields(self, base_url, auth_headers):
        """Summary should have correct numeric fields."""
        response = requests.get(f"{base_url}/api/reports/invoices", headers=auth_headers)
        data = response.json()
        summary = data["summary"]
        assert isinstance(summary["total_revenue"], (int, float))
        assert isinstance(summary["paid_revenue"], (int, float))
        assert isinstance(summary["outstanding_revenue"], (int, float))
        assert isinstance(summary["invoice_count"], int)

    def test_financial_ratios(self, base_url, auth_headers):
        """Financial ratios should have correct types."""
        response = requests.get(f"{base_url}/api/reports/invoices", headers=auth_headers)
        data = response.json()
        ratios = data["financialStatement"]["ratios"]
        assert isinstance(ratios["collectionRate"], (int, float))
        assert isinstance(ratios["avgInvoiceValue"], (int, float))
        assert isinstance(ratios["revenuePerCustomer"], (int, float))
        assert isinstance(ratios["totalCustomers"], int)
        assert isinstance(ratios["paidInvoiceCount"], int)
        assert isinstance(ratios["overdueInvoiceCount"], int)

    def test_cash_flow_fields(self, base_url, auth_headers):
        """Cash flow should include all expected fields."""
        response = requests.get(f"{base_url}/api/reports/invoices", headers=auth_headers)
        data = response.json()
        cf = data["financialStatement"]["cashFlow"]
        assert "totalInflow" in cf
        assert "pendingInflow" in cf
        assert "overdueAmount" in cf
        assert "thisMonthRevenue" in cf
        assert "lastMonthRevenue" in cf
        assert "monthOverMonthGrowth" in cf
