import pytest
from app.core.ratelimit import reset_rate_limits


@pytest.fixture(autouse=True)
def _isolate_rate_limits():
    """Reset the in-memory rate limiter before every test.

    Buckets are process-global and keyed by IP+scope, so without this,
    tests that run later in the suite inherit earlier tests' usage and
    flake with 429s. DB isolation is handled by each module's client
    fixture (clear_memory_db).
    """
    reset_rate_limits()
    yield
    reset_rate_limits()
