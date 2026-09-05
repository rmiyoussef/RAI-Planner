"""Project engineering policy: rules + task templates.

Rules and task templates live in schemaless JSONB collections (owner-scoped,
like everything else), so no DB migration is needed. Defaults are seeded on
project creation and lazily ensured for older projects.
"""
import re
from typing import List, Optional
from app.core.database import get_collection, new_id, utc_now

DEFAULT_TEST_RULE = """For every Feature or Bug task, generate a complete test plan and test cases as part of the task.

Tests must cover the expected behavior, success cases, failure cases, validation, authorization where applicable, edge cases, and regression scenarios relevant to the change.

Use the project's existing testing framework and testing conventions.

Tests are part of the implementation and must be completed before the task is considered done."""

DEFAULT_TEMPLATES = {
    "task": {
        "name": "Task",
        "content": """# {{title}}

## Objective

Describe what needs to be done.

## Requirements

- Requirement 1
- Requirement 2

## Implementation Notes

Describe important implementation considerations.

## Definition of Done

- [ ] Implementation completed
- [ ] Existing functionality preserved
- [ ] Tests added where applicable
- [ ] Existing tests pass""",
    },
    "feature": {
        "name": "Feature",
        "content": """# {{title}}

## Objective

Describe the feature and the problem it solves.

## Requirements

- Requirement 1
- Requirement 2

## Existing Implementation

Inspect the existing codebase before implementation.

Identify existing APIs, services, models, components, and related functionality.

## API

Determine whether an existing API can be reused or extended.

If no suitable API exists, define the required API following the project's conventions.

## Implementation

Describe the expected implementation.

## Test Cases

Generate complete project-aware test cases.

Include:

- Happy path
- Validation
- Authorization where applicable
- Edge cases
- Failure scenarios
- Regression scenarios

## Definition of Done

- [ ] Feature implemented
- [ ] Tests implemented
- [ ] Tests passing
- [ ] Existing functionality preserved
- [ ] Documentation updated where required""",
    },
    "bug": {
        "name": "Bug",
        "content": """# {{title}}

## Problem

Describe the observed problem.

## Expected Behavior

Describe what should happen.

## Actual Behavior

Describe what currently happens.

## Root Cause

Determine the root cause from the actual codebase.

Do not guess when the source code can be inspected.

## Fix

Describe the required fix.

## Regression Test

Create a test that reproduces the original bug and verifies the fix.

## Additional Test Cases

Include relevant:

- Edge cases
- Failure scenarios
- Validation
- Authorization where applicable
- Regression scenarios

## Definition of Done

- [ ] Root cause identified
- [ ] Bug fixed
- [ ] Regression test added
- [ ] Additional relevant tests added
- [ ] All relevant tests pass
- [ ] No unrelated behavior changed""",
    },
}

_TEMPLATE_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def render_template(content: str, ctx: dict) -> str:
    """Fill {{variables}}; unknown/empty ones vanish (never leak raw {{x}})."""
    def _repl(m: re.Match) -> str:
        val = ctx.get(m.group(1))
        return str(val) if val not in (None, "") else ""
    return _TEMPLATE_VAR_RE.sub(_repl, content or "")


def _rule_doc(owner_id: str, project_id: str, content: str, position: int) -> dict:
    now = utc_now()
    return {
        "_id": new_id(),
        "owner_id": owner_id,
        "project_id": project_id,
        "content": content,
        "enabled": True,
        "position": position,
        "created_at": now,
        "updated_at": now,
    }


def _template_doc(owner_id: str, project_id: str, ttype: str, name: str, content: str) -> dict:
    now = utc_now()
    return {
        "_id": new_id(),
        "owner_id": owner_id,
        "project_id": project_id,
        "name": name,
        "type": ttype,
        "content": content,
        "is_default": True,
        "created_at": now,
        "updated_at": now,
    }


async def ensure_project_defaults(owner_id: str, project_id: str) -> None:
    """Seed the default test rule + 3 templates if the project has none.

    Idempotent: only inserts what is missing. Covers projects created
    before this feature existed (lazy migration, no DB changes needed).
    """
    rules_col = get_collection("project_rules")
    if await rules_col.count_documents({"owner_id": owner_id, "project_id": project_id}) == 0:
        await rules_col.insert_one(_rule_doc(owner_id, project_id, DEFAULT_TEST_RULE, 0))
    tpl_col = get_collection("task_templates")
    for ttype, tpl in DEFAULT_TEMPLATES.items():
        if await tpl_col.count_documents({"owner_id": owner_id, "project_id": project_id, "type": ttype}) == 0:
            await tpl_col.insert_one(_template_doc(owner_id, project_id, ttype, tpl["name"], tpl["content"]))


async def load_enabled_rules(owner_id: str, project_id: str) -> List[str]:
    """Enabled rule contents in position order (the AI's mandatory constraints)."""
    col = get_collection("project_rules")
    cur = await col.find({"owner_id": owner_id, "project_id": project_id, "enabled": True})
    try:
        docs = await cur.to_list(length=None)
    except Exception:
        docs = []
        async for d in cur:
            docs.append(d)
    docs.sort(key=lambda d: (d.get("position", 0), d.get("created_at", "")))
    return [d.get("content", "") for d in docs if d.get("content")]


async def load_template(owner_id: str, project_id: str, template_id: Optional[str]) -> Optional[dict]:
    """Load one template by id (must belong to the project)."""
    if not template_id:
        return None
    doc = await get_collection("task_templates").find_one(
        {"_id": template_id, "owner_id": owner_id, "project_id": project_id}
    )
    return doc
