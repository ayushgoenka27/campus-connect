"""
Phase 7 Security Hardening Test Suite (P7-03 to P7-06)
Verifies:
- Security headers and Content Security Policy (CSP)
- CORS origin safety validation
- Single-instance in-memory rate limiting and anti-spoofing
- Server-side logout token revocation (FR-AUTH-5)
- Production error sanitization (no stack trace / SQL leak)
- Health liveness and readiness endpoints (/health, /health/db)
"""
import pytest
from starlette.testclient import TestClient
from app.core.config import settings, Settings
from app.core.rate_limit import limiter
from app.core.security import create_access_token


class TestSecurityHeadersAndHealth:
    def test_security_headers_present_on_api_responses(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "geolocation=()" in response.headers.get("Permissions-Policy", "")

        csp = response.headers.get("Content-Security-Policy", "")
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "connect-src 'self' ws: wss:" in csp

    def test_health_liveness_and_readiness_endpoints(self, client: TestClient):
        # Liveness
        r_live = client.get("/health")
        assert r_live.status_code == 200
        assert r_live.json()["status"] == "healthy"
        assert "environment" in r_live.json()

        # Readiness
        r_ready = client.get("/health/db")
        assert r_ready.status_code == 200
        data = r_ready.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "latency_ms" in data


class TestCORSSafetyValidation:
    def test_wildcard_cors_rejected(self):
        with pytest.raises(ValueError, match="Insecure CORS configuration"):
            Settings(
                database_url="sqlite:///:memory:",
                jwt_secret_key="test-key",
                cors_origins="*",
            )

    def test_explicit_cors_origins_parsed(self):
        s = Settings(
            database_url="sqlite:///:memory:",
            jwt_secret_key="test-key",
            cors_origins="https://app.campus.edu, https://admin.campus.edu",
        )
        assert s.cors_origins == ["https://app.campus.edu", "https://admin.campus.edu"]


class TestRateLimiter:
    def setup_method(self):
        limiter.reset()

    def test_rate_limiter_allows_under_limit_and_blocks_when_exhausted(self, client: TestClient):
        limiter.reset()
        settings.rate_limit_enabled = True

        # Use 3 requests per 60s for deterministic test
        client_host = "192.168.1.50"
        headers = {"X-Real-IP": client_host}

        # First request to login with invalid credentials returns 401
        payload = {"email": "nonexistent@campus.edu", "password": "Password123!"}

        # Hit login within limit
        r1 = client.post("/api/v1/auth/login", json=payload, headers=headers)
        assert r1.status_code == 401

        # Fill up bucket by calling limiter directly with custom threshold
        for _ in range(14):
            client.post("/api/v1/auth/login", json=payload, headers=headers)

        # 16th request must exceed the 15/min limit
        r_blocked = client.post("/api/v1/auth/login", json=payload, headers=headers)
        assert r_blocked.status_code == 429
        assert "Retry-After" in r_blocked.headers
        assert "Rate limit exceeded" in r_blocked.json()["detail"]

    def test_rate_limiter_disabled_mode(self, client: TestClient):
        limiter.reset()
        settings.rate_limit_enabled = False
        try:
            payload = {"email": "nobody@campus.edu", "password": "WrongPassword!"}
            for _ in range(20):
                r = client.post("/api/v1/auth/login", json=payload)
                assert r.status_code == 401
        finally:
            settings.rate_limit_enabled = True
            limiter.reset()

    def test_untrusted_client_x_forwarded_for_is_ignored(self):
        from starlette.datastructures import Headers
        from unittest.mock import Mock

        limiter.reset()
        mock_req = Mock()
        mock_req.client.host = "203.0.113.195"  # Untrusted external IP
        mock_req.headers = Headers({"X-Forwarded-For": "10.0.0.1"})

        # Limiter must identify genuine direct IP, NOT spoofed 10.0.0.1
        resolved_ip = limiter._get_client_ip(mock_req)
        assert resolved_ip == "203.0.113.195"

    def test_trusted_proxy_x_forwarded_for_is_used(self):
        from starlette.datastructures import Headers
        from unittest.mock import Mock

        limiter.reset()
        mock_req = Mock()
        mock_req.client.host = "127.0.0.1"  # In settings.trusted_proxies
        mock_req.headers = Headers({"X-Forwarded-For": "198.51.100.25, 127.0.0.1"})

        resolved_ip = limiter._get_client_ip(mock_req)
        assert resolved_ip == "198.51.100.25"


class TestServerSideLogoutAndRevocation:
    def test_logout_revokes_jwt_access_token(self, client: TestClient):
        # 1. Register a test user
        user_data = {
            "full_name": "Logout Tester",
            "username": "logout_tester",
            "email": "logout_tester@campus.edu",
            "password": "Password123!",
        }
        r_reg = client.post("/api/v1/auth/register", json=user_data)
        assert r_reg.status_code == 201

        # 2. Login to obtain access token
        r_log = client.post("/api/v1/auth/login", json={"email": user_data["email"], "password": user_data["password"]})
        assert r_log.status_code == 200
        token = r_log.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {token}"}

        # 3. Verify token works
        r_me = client.get("/api/v1/auth/me", headers=auth_header)
        assert r_me.status_code == 200
        assert r_me.json()["username"] == "logout_tester"

        # 4. Perform server-side logout
        r_logout = client.post("/api/v1/auth/logout", headers=auth_header)
        assert r_logout.status_code == 200
        assert "Logged out successfully" in r_logout.json()["message"]

        # 5. Subsequent request with the same token MUST fail with 401
        r_me_after = client.get("/api/v1/auth/me", headers=auth_header)
        assert r_me_after.status_code == 401
        assert "revoked or invalidated" in r_me_after.json()["detail"].lower()


class TestProductionExceptionSanitization:
    def test_production_exception_does_not_leak_internals(self):
        original_env = settings.environment
        settings.environment = "production"
        try:
            from app.main import app
            from fastapi import APIRouter

            mock_router = APIRouter()

            @mock_router.get("/test-internal-crash")
            def crash():
                raise RuntimeError("SELECT * FROM users WHERE secret_password='leak'")

            app.include_router(mock_router)

            # TestClient with raise_server_exceptions=False inspects the HTTP 500 response
            p_client = TestClient(app, raise_server_exceptions=False)
            crash_resp = p_client.get("/test-internal-crash")
            assert crash_resp.status_code == 500
            # Must NOT expose the SQL string or internal traceback
            body = crash_resp.json()
            assert "SELECT" not in body["detail"]
            assert "secret_password" not in body["detail"]
            assert body["detail"] == "An internal server error occurred. Please try again later."
        finally:
            settings.environment = original_env
