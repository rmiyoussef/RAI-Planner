"""Static Blade variable extraction — never executes PHP."""
import re
from typing import List, Dict

# {{ $x }}, {!! $x !!}, {{{ $x }}}
_ECHO_RE = re.compile(r"\{\{\{?\s*(.+?)\s*\}?\}\}|\\{!!\s*(.+?)\s*!!\\}", re.DOTALL)
_ECHO_SIMPLE_RE = re.compile(r"\{\!\!\s*(.+?)\s*\!\!\}|\{\{\s*(.+?)\s*\}\}", re.DOTALL)
_DIRECTIVE_RE = re.compile(r"@(if|elseif|unless|isset|empty|foreach|forelse|while|switch|case|include|each)\s*\((.*?)\)", re.DOTALL | re.IGNORECASE)
# $var, $var->prop, $var['key'], $var["key"]
_VAR_RE = re.compile(r"\$([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*->\s*([a-zA-Z_][a-zA-Z0-9_]*))?")
# foreach ($employees as $employee) — capture loop var as well (still static)
_FOREACH_AS_RE = re.compile(r"@foreach\s*\(\s*(.+?)\s+as\s+(\$[a-zA-Z_][a-zA-Z0-9_]*)\s*\)", re.DOTALL | re.IGNORECASE)


def _friendly(expression: str) -> str:
    e = expression.strip()
    e = e.lstrip("$")
    # $employee->name => employee.name
    e = re.sub(r"\s*->\s*", ".", e)
    # $user['email'] / $user["email"] => user.email
    e = re.sub(r"\[\s*['\"]([^'\"\]]+)['\"]\s*\]", r".\1", e)
    # strip function-call wrappers like optional($x) -> keep inner? keep simple: take first $var match
    m = _VAR_RE.search(expression)
    if m:
        base = m.group(1)
        prop = m.group(2)
        return f"{base}.{prop}" if prop else base
    # fallback: alnum + dot only, truncate
    e = re.sub(r"[^a-zA-Z0-9_.]", "", e)[:80]
    return e or "value"


def _add(store: Dict[str, dict], expression: str, syntax: str, raw: str):
    expression = expression.strip()
    if not expression or len(expression) > 300:
        return
    # ignore pure literals / numbers
    if not _VAR_RE.search(expression):
        return
    name = _friendly(expression)
    if name not in store:
        store[name] = {"name": name, "expression": expression, "syntax": syntax, "raw": raw.strip()[:300]}


def _bare_name(expression: str) -> str:
    """Fallback friendly name for echo expressions without $ (e.g. {{ company_name }})."""
    e = expression.strip()
    # strip quoted strings and filters: take first identifier
    m = re.search(r"[a-zA-Z_][a-zA-Z0-9_]*", e)
    if not m:
        return ""
    # avoid php keywords
    if m.group(0).lower() in {"if", "else", "foreach", "echo", "empty", "isset", "true", "false", "null"}:
        return ""
    return m.group(0)[:80]


def _add_bare(store: Dict[str, dict], expression: str, raw: str):
    name = _bare_name(expression)
    if not name:
        return
    if name not in store:
        store[name] = {"name": name, "expression": expression.strip()[:300], "syntax": "blade_echo", "raw": raw.strip()[:300]}


class BladeEmailVariableExtractor:
    """Statically inspect Blade source for variables."""

    @staticmethod
    def extract(content: str) -> List[dict]:
        store: Dict[str, dict] = {}
        if not content:
            return []
        # echo statements
        for m in _ECHO_SIMPLE_RE.finditer(content):
            expr = m.group(1) or m.group(2) or ""
            found = False
            # handle ternary / coalesce: take all $vars inside
            for vm in _VAR_RE.finditer(expr):
                found = True
                full = vm.group(0)
                # preserve object chain start: $a->b
                _add(store, full, "blade_echo", m.group(0))
            if not found:
                # e.g. {{ company_name }} without $ — still a variable
                _add_bare(store, expr, m.group(0))
        # directives
        for m in _DIRECTIVE_RE.finditer(content):
            inner = m.group(2) or ""
            for vm in _VAR_RE.finditer(inner):
                _add(store, vm.group(0), f"blade_{m.group(1).lower()}", m.group(0))
        # foreach loop variable
        for m in _FOREACH_AS_RE.finditer(content):
            _add(store, m.group(2), "blade_foreach", m.group(0))
        return list(store.values())


def render_blade_preview(content: str) -> str:
    """Safe static substitution: replace known echo expressions with mock values."""
    from app.services.email_variables import sample_value

    def _friendly_value(name: str) -> str:
        key = name.split(".")[0]
        # map common blade names to sample data
        mapping = {
            "company_name": sample_value("company_name"),
            "company": sample_value("company_name"),
            "employee": sample_value("employee_name"),
            "user": sample_value("employee_name"),
            "name": sample_value("name"),
            "message": "Welcome aboard! We're glad to have you.",
            "loginUrl": sample_value("login_url"),
            "login_url": sample_value("login_url"),
            "url": sample_value("url"),
            "email": sample_value("email"),
        }
        if name in mapping:
            return mapping[name]
        if key in mapping:
            return mapping[key]
        return sample_value(key)

    def _repl(m):
        full = m.group(0)
        expr = (m.group(1) or m.group(2) or "").strip()
        # find friendly name of first var
        vm = _VAR_RE.search(expr)
        if not vm:
            # $-less echo, e.g. {{ company_name }} — substitute dummy data too
            bare = _bare_name(expr)
            if bare:
                return _friendly_value(bare)
            return "Sample Value"
        base = vm.group(1)
        prop = vm.group(2)
        fname = f"{base}.{prop}" if prop else base
        return _friendly_value(fname)

    out = _ECHO_SIMPLE_RE.sub(_repl, content or "")
    # strip remaining directives for preview readability (no execution)
    out = re.sub(r"@\w+(\s*\(.*?\))?", "", out)
    out = out.replace("@endif", "").replace("@endforeach", "").replace("@endisset", "")
    return out
