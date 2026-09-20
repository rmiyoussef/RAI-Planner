import re
from typing import List

_GENERAL_VAR_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")

SAMPLE_VALUES = {
    "company_name": "Acme Corporation",
    "employee_name": "John Doe",
    "name": "John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1 555 0100",
    "job_title": "Software Engineer",
    "login_url": "https://example.com/login",
    "url": "https://example.com",
    "date": "2026-01-15",
}


def extract_general_variables(content: str) -> List[str]:
    """Detect {var} placeholders, deduplicated, order-preserving."""
    if not content:
        return []
    seen: List[str] = []
    for m in _GENERAL_VAR_RE.finditer(content):
        v = m.group(1)
        if v not in seen:
            seen.append(v)
    return seen


def sample_value(name: str) -> str:
    if name in SAMPLE_VALUES:
        return SAMPLE_VALUES[name]
    # friendly fallback for unknown names
    return "Sample Value"


def render_general_preview(content: str) -> str:
    """Safe substitution for general templates — no code execution."""
    def _repl(m):
        return sample_value(m.group(1))
    return _GENERAL_VAR_RE.sub(_repl, content or "")
