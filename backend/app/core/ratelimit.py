import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

# Simple in-memory sliding-window rate limiter (no external deps).
# Suitable for single-process deployments; behind multiple workers each
# process keeps its own buckets (still bounds abuse per process).

_BUCKETS: dict = defaultdict(deque)


def rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    """Raise 429 when `limit` calls within `window_seconds` exceeded for client IP+scope."""
    client_ip = request.client.host if request.client else "unknown"
    bucket_key = f"{scope}:{client_ip}"
    now = time.monotonic()
    q = _BUCKETS[bucket_key]
    while q and now - q[0] > window_seconds:
        q.popleft()
    if len(q) >= limit:
        retry_after = int(window_seconds - (now - q[0])) if q else window_seconds
        retry_after = max(1, retry_after)
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )
    q.append(now)
