"""
Security Headers & Content Security Policy (CSP) Middleware (FR-SEC-2, TD-027)

Defensive HTTP response headers added to every API response:
- X-Frame-Options: DENY (clickjacking protection)
- X-Content-Type-Options: nosniff (MIME sniffing protection)
- Referrer-Policy: strict-origin-when-cross-origin (privacy protection)
- Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=() (feature restrictions)
- Strict-Transport-Security: max-age=31536000; includeSubDomains (when production or HTTPS)
- Content-Security-Policy:
    * default-src 'self';
    * script-src 'self' (and jsdelivr CDN on /docs for Swagger UI);
    * style-src 'self' 'unsafe-inline' (justified: Tailwind CSS runtime style injection);
    * img-src 'self' data: https: blob: (justified: avatars, SVG icons, external resource icons);
    * connect-src 'self' ws: wss: http: https: (justified: REST API and WebSocket real-time connections);
    * font-src 'self' data:;
    * object-src 'none';
    * base-uri 'self';
    * frame-ancestors 'none';
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # Baseline defensive headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(), payment=()"

        # HSTS in production or when connection is HTTPS
        if settings.environment == "production" or request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Content Security Policy (CSP)
        is_docs = request.url.path in ("/docs", "/redoc", "/openapi.json")
        script_src = "'self' https://cdn.jsdelivr.net 'unsafe-inline'" if is_docs else "'self'"
        style_src = "'self' 'unsafe-inline' https://cdn.jsdelivr.net" if is_docs else "'self' 'unsafe-inline'"

        csp = (
            "default-src 'self'; "
            f"script-src {script_src}; "
            f"style-src {style_src}; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' ws: wss: http: https:; "
            "font-src 'self' data:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp

        return response

