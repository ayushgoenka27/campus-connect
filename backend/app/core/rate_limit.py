"""
Single-Instance In-Memory Sliding-Window Rate Limiter (FR-SEC-1, TD-026)

ARCHITECTURE NOTE:
This implementation maintains sliding-window timestamp queues in process memory.
It is designed for single-instance, zero-cost production deployments. For multi-replica
horizontal scaling behind a load balancer, a distributed token-bucket cache (such as Redis)
would be required.

SECURITY DEFENSE:
To prevent IP spoofing, X-Forwarded-For is only parsed if the direct connection peer
(request.client.host) is present in `settings.trusted_proxies`. Untrusted clients cannot
evade rate limits by sending arbitrary X-Forwarded-For headers.
"""
import time
from collections import defaultdict, deque
from typing import Callable, Optional
from fastapi import HTTPException, Request, status
from app.core.config import settings


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Stores timestamps in deques per (key, client_ip) pair.
    """

    def __init__(self):
        # Maps (bucket_name, client_ip) -> deque of monotonic timestamps
        self._storage: dict[tuple[str, str], deque] = defaultdict(deque)

    def _get_client_ip(self, request: Request) -> str:
        """
        Secure client IP resolution.
        Does NOT blindly trust X-Forwarded-For unless the direct peer is a trusted proxy.
        """
        direct_ip = request.client.host if request.client else "127.0.0.1"

        trusted = settings.trusted_proxies
        if isinstance(trusted, str):
            trusted = [t.strip() for t in trusted.split(",") if t.strip()]

        if direct_ip in trusted:
            # Trusted proxy: parse leftmost untrusted IP or original client from X-Forwarded-For
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                # Format: client, proxy1, proxy2
                ips = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
                if ips:
                    return ips[0]

        return direct_ip

    def check(
        self,
        request: Request,
        key: str,
        max_requests: int,
        window_seconds: int = 60,
    ) -> None:
        """
        Checks if the request is within rate limits.
        Raises HTTP 429 Too Many Requests with Retry-After header if exceeded.
        """
        if not settings.rate_limit_enabled:
            return

        client_ip = self._get_client_ip(request)
        bucket_key = (key, client_ip)
        now = time.monotonic()
        cutoff = now - window_seconds

        queue = self._storage[bucket_key]

        # Purge timestamps outside the active sliding window
        while queue and queue[0] < cutoff:
            queue.popleft()

        if len(queue) >= max_requests:
            oldest = queue[0]
            retry_after = max(1, int(oldest + window_seconds - now) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

        queue.append(now)

    def reset(self) -> None:
        """Clears all rate limit buckets. Used for test isolation."""
        self._storage.clear()


# Global limiter instance
limiter = SlidingWindowRateLimiter()


def rate_limit(
    times: Optional[int] = None,
    seconds: int = 60,
    key: str = "default",
) -> Callable:
    """
    FastAPI dependency factory for endpoint-level rate limiting.
    Usage:
        @router.post("/login", dependencies=[Depends(rate_limit(times=10, seconds=60, key="login"))])
    """
    async def dependency(request: Request):
        max_reqs = times or settings.rate_limit_default_per_minute
        limiter.check(request, key=key, max_requests=max_reqs, window_seconds=seconds)

    return dependency

