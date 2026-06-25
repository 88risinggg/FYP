import requests


class TestHealthCheck:
    """Test health check endpoints."""

    def test_server_health(self, base_url):
        """GET /api/health should return 200 with status ok."""
        response = requests.get(f"{base_url}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_database_health(self, base_url):
        """GET /api/health/database should return 200."""
        response = requests.get(f"{base_url}/api/health/database")
        assert response.status_code == 200

    def test_unknown_route_returns_404(self, base_url):
        """Unknown routes should return 404."""
        response = requests.get(f"{base_url}/api/nonexistent")
        assert response.status_code == 404
        data = response.json()
        assert data["message"] == "Route not found"
