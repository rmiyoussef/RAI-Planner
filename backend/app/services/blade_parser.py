"""Static Blade analysis — understands Laravel Blade scoping, never executes PHP.

Knows that variables can legitimately come from:
- data passed to the view (the `known` set supplied by the caller)
- `@php ... @endphp` blocks (assignments, foreach/for/catch inside)
- `@foreach/@forelse (... as $x)` and `@for ($i = ...)` loop variables
- `@inject('name', ...)` service injection
- `@props([...])` / `@aware([...])` component props
- always-available `$errors` (ShareErrorsFromSession), `$attributes`/`$slot` (components)
- `$loop` inside @foreach/@forelse bodies
- `@isset(...)` / `@empty(...)` null-safe guards
- `$message` inside `@error ... @enderror` blocks
- ignores `{{-- comments --}}` and `@verbatim ... @endverbatim`
"""
import re
from typing import List, Dict, Set, Tuple

# {{ $x }}, {!! $x !!}, {{{ $x }}}
_ECHO_RE = re.compile(r"\{\{\{?\s*(.+?)\s*\}?\}\}|\\{!!\s*(.+?)\s*!!\\}", re.DOTALL)
_ECHO_SIMPLE_RE = re.compile(r"\{\!\!\s*(.+?)\s*\!\!\}|\{\{\s*(.+?)\s*\}\}", re.DOTALL)
_DIRECTIVE_RE = re.compile(r"@(if|elseif|unless|isset|empty|foreach|forelse|for|while|switch|case|include|each|checked|selected|disabled|readonly|required|json|js|class|style)\s*\((.*?)\)", re.DOTALL | re.IGNORECASE)
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


_COMMENT_RE = re.compile(r"\{\{--.*?--\}\}", re.DOTALL)
_VERBATIM_RE = re.compile(r"@verbatim.*?@endverbatim", re.DOTALL | re.IGNORECASE)


def strip_blade_noise(content: str) -> str:
    """Remove Blade comments and @verbatim blocks (never real variables)."""
    return _VERBATIM_RE.sub("", _COMMENT_RE.sub("", content or ""))


# Variables Laravel always shares: $errors (validated/session middleware),
# $attributes/$slot (Blade components).
_ALWAYS_KNOWN = {"errors", "attributes", "slot"}


def _defined_in_php(code: str, store: Set[str]):
    """Find variables a @php block defines: assignments, foreach/for/catch vars."""
    for m in re.finditer(
        r"foreach\s*\(.+?\bas\s+(\$[a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=>\s*(\$[a-zA-Z_][a-zA-Z0-9_]*))?",
        code, re.DOTALL | re.IGNORECASE,
    ):
        store.add(m.group(1)[1:])
        if m.group(2):
            store.add(m.group(2)[1:])
    for m in re.finditer(r"for\s*\(\s*(\$[a-zA-Z_][a-zA-Z0-9_]*)", code, re.IGNORECASE):
        store.add(m.group(1)[1:])
    for m in re.finditer(r"catch\s*\([^)]*?(\$[a-zA-Z_][a-zA-Z0-9_]*)", code, re.IGNORECASE):
        store.add(m.group(1)[1:])
    # $x = ... (exclude ==, =>, ->, ::, $this->x is handled via -> exclusion)
    for m in re.finditer(r"(?<![\$>:=\-a-zA-Z_])\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?![=>])", code):
        store.add(m.group(1))


def _block_ranges(content: str) -> Dict[str, List[Tuple[int, int]]]:
    """Nesting-aware (start, end) ranges for loop and @error blocks."""
    opens = {"foreach": "loop", "forelse": "loop", "error": "error"}
    closes = {"endforeach": "loop", "endforelse": "loop", "enderror": "error"}
    stack: List[Tuple[str, int]] = []
    ranges: Dict[str, List[Tuple[int, int]]] = {"loop": [], "error": []}
    for m in re.finditer(r"@(\w+)", content, re.IGNORECASE):
        name = m.group(1).lower()
        if name in opens:
            stack.append((opens[name], m.start()))
        elif name in closes and stack:
            # pop the nearest matching opener (tolerates mixed nesting)
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][0] == closes[name]:
                    _, start = stack.pop(i)
                    ranges[closes[name]].append((start, m.end()))
                    break
    return ranges


def _in_ranges(pos: int, ranges: List[Tuple[int, int]]) -> bool:
    return any(s <= pos <= e for s, e in ranges)


def extract_defined_variables(content: str) -> List[str]:
    """Variables the template itself defines (@php, loops, @inject, @props, @aware)."""
    body = strip_blade_noise(content)
    defined: Set[str] = set()
    # @php ... @endphp blocks (+ rare inline @php(...))
    for m in re.finditer(r"@php(.*?)@endphp", body, re.DOTALL | re.IGNORECASE):
        _defined_in_php(m.group(1), defined)
    for m in re.finditer(r"@php\(([^)]*)\)", body, re.IGNORECASE):
        _defined_in_php(m.group(1), defined)
    # loop variables at directive level
    for m in re.finditer(
        r"@(?:foreach|forelse)\s*\(.+?\bas\s+(\$[a-zA-Z_][a-zA-Z0-9_]*)(?:\s*=>\s*(\$[a-zA-Z_][a-zA-Z0-9_]*))?",
        body, re.DOTALL | re.IGNORECASE,
    ):
        defined.add(m.group(1)[1:])
        if m.group(2):
            defined.add(m.group(2)[1:])
    for m in re.finditer(r"@for\s*\(\s*(\$[a-zA-Z_][a-zA-Z0-9_]*)", body, re.IGNORECASE):
        defined.add(m.group(1)[1:])
    # @inject('metrics', ...) defines $metrics
    for m in re.finditer(r"@inject\s*\(\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]", body, re.IGNORECASE):
        defined.add(m.group(1))
    # @props(['type', 'x' => ..]) / @aware([...]) define component props.
    # Only keys count — 'x' in 'y' => 'x' is a default value, not a prop.
    for m in re.finditer(r"@(?:props|aware)\s*\(\s*\[(.*?)\]\)", body, re.DOTALL | re.IGNORECASE):
        inner = m.group(1)
        for k in re.finditer(r"['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]\s*=>", inner):
            defined.add(k.group(1))
        no_defaults = re.sub(r"=>[^,]+", "", inner)
        for k in re.finditer(r"['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]", no_defaults):
            defined.add(k.group(1))
    return sorted(defined)


def _guarded_variables(body: str) -> Set[str]:
    """Variables inside @isset(...) / @empty(...) — null-safe by design, not unknown."""
    guarded: Set[str] = set()
    for m in re.finditer(r"@(isset|empty)\s*\((.*?)\)", body, re.DOTALL | re.IGNORECASE):
        for vm in _VAR_RE.finditer(m.group(2)):
            guarded.add(vm.group(1))
    return guarded


def analyze_blade(content: str, known: List[str] | Tuple[str, ...] = ()) -> Dict[str, object]:
    """Smart Blade analysis.

    `known` = friendly variable names already passed to the view (e.g. from a
    previous scan). Returns used/defined/unknown; unknown entries carry the raw
    Blade expression for display. Never executes PHP.
    """
    body = strip_blade_noise(content)
    known_bases = {str(k).split(".")[0].lstrip("$") for k in (known or []) if str(k).strip()}
    defined = set(extract_defined_variables(body))
    ranges = _block_ranges(body)
    guarded = _guarded_variables(body)
    allowed = known_bases | defined | _ALWAYS_KNOWN | guarded

    used: Dict[str, dict] = {}
    unknown: Dict[str, dict] = {}

    def _consider(base: str, friendly: str, raw: str, pos: int):
        if not base:
            return
        if friendly not in used:
            used[friendly] = {"name": friendly, "raw": raw.strip()[:300]}
        if base in allowed:
            return
        # scoped allowances: $loop in loops, $message in @error blocks
        if base == "loop" and _in_ranges(pos, ranges["loop"]):
            return
        if base == "message" and _in_ranges(pos, ranges["error"]):
            return
        key = re.sub(r"\s+", " ", raw).strip()[:300]
        if key not in unknown:
            unknown[key] = {"name": friendly, "expression": f"${base}", "syntax": "blade_unknown", "raw": key}

    for m in _ECHO_SIMPLE_RE.finditer(body):
        expr = m.group(1) or m.group(2) or ""
        found = False
        for vm in _VAR_RE.finditer(expr):
            found = True
            base, prop = vm.group(1), vm.group(2)
            _consider(base, f"{base}.{prop}" if prop else base, m.group(0), m.start())
        if not found:
            bare = _bare_name(expr)
            if bare:
                _consider(bare, bare, m.group(0), m.start())
    for m in _DIRECTIVE_RE.finditer(body):
        for vm in _VAR_RE.finditer(m.group(2) or ""):
            base, prop = vm.group(1), vm.group(2)
            _consider(base, f"{base}.{prop}" if prop else base, m.group(0), m.start())
    # :prop="$var" bindings on Blade components (<x-input :value="$x" />)
    for m in re.finditer(r":[a-zA-Z_][\w\-.]*\s*=\s*\"([^\"]*)\"", body):
        for vm in _VAR_RE.finditer(m.group(1)):
            base, prop = vm.group(1), vm.group(2)
            _consider(base, f"{base}.{prop}" if prop else base, vm.group(0), m.start())

    return {
        "used": sorted(used),
        "defined": sorted(defined),
        "unknown": list(unknown.values()),
    }


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
        body = strip_blade_noise(content)
        # echo statements
        for m in _ECHO_SIMPLE_RE.finditer(body):
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
        for m in _DIRECTIVE_RE.finditer(body):
            inner = m.group(2) or ""
            for vm in _VAR_RE.finditer(inner):
                _add(store, vm.group(0), f"blade_{m.group(1).lower()}", m.group(0))
        # foreach loop variable
        for m in _FOREACH_AS_RE.finditer(body):
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

    out = _ECHO_SIMPLE_RE.sub(_repl, strip_blade_noise(content) or "")
    # @php blocks are logic, never output — drop them from the preview
    out = re.sub(r"@php.*?@endphp", "", out, flags=re.DOTALL | re.IGNORECASE)
    # strip remaining directives for preview readability (no execution)
    out = re.sub(r"@\w+(\s*\(.*?\))?", "", out)
    out = out.replace("@endif", "").replace("@endforeach", "").replace("@endisset", "")
    return out
