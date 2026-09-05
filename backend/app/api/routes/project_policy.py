"""Project engineering policy endpoints: rules + task templates.

Owner-scoped, project-scoped. Reads lazily seed defaults so projects created
before this feature show the default test rule and the 3 templates.
Templates cannot be deleted (the 3 default types must always exist).
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.project import (
    ProjectRuleCreate, ProjectRuleUpdate, ProjectRuleResponse,
    TaskTemplateCreate, TaskTemplateUpdate, TaskTemplateResponse,
)
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
from app.core.ratelimit import rate_limit
from app.agents.project_policy import ensure_project_defaults

router = APIRouter(prefix="/projects", tags=["project-policy"])


async def _project_or_404(project_id: str, owner_id: str):
    doc = await get_collection("projects").find_one({"_id": project_id, "owner_id": owner_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


def _rule_resp(d) -> ProjectRuleResponse:
    return ProjectRuleResponse(
        id=d["_id"], project_id=d["project_id"], content=d.get("content", ""),
        enabled=d.get("enabled", True), position=d.get("position", 0),
        created_at=d.get("created_at", ""), updated_at=d.get("updated_at", ""),
    )


def _tpl_resp(d) -> TaskTemplateResponse:
    return TaskTemplateResponse(
        id=d["_id"], project_id=d["project_id"], name=d.get("name", ""),
        type=d.get("type", "task"), content=d.get("content", ""),
        is_default=d.get("is_default", False),
        created_at=d.get("created_at", ""), updated_at=d.get("updated_at", ""),
    )


async def _all_rules(owner_id: str, project_id: str):
    col = get_collection("project_rules")
    cur = await col.find({"owner_id": owner_id, "project_id": project_id})
    try:
        docs = await cur.to_list(length=None)
    except Exception:
        docs = []
        async for d in cur:
            docs.append(d)
    docs.sort(key=lambda d: (d.get("position", 0), d.get("created_at", "")))
    return docs


# ---- Rules ----

@router.get("/{project_id}/rules", response_model=list[ProjectRuleResponse])
async def list_rules(project_id: str, owner=Depends(get_current_owner)):
    await _project_or_404(project_id, owner["_id"])
    await ensure_project_defaults(owner["_id"], project_id)
    return [_rule_resp(d) for d in await _all_rules(owner["_id"], project_id)]


@router.post("/{project_id}/rules", response_model=ProjectRuleResponse)
async def create_rule(project_id: str, payload: ProjectRuleCreate, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "create_rule", limit=60, window_seconds=60)
    await _project_or_404(project_id, owner["_id"])
    await ensure_project_defaults(owner["_id"], project_id)
    existing = await _all_rules(owner["_id"], project_id)
    nxt = max([d.get("position", 0) for d in existing], default=-1) + 1
    now = utc_now()
    doc = {
        "_id": new_id(), "owner_id": owner["_id"], "project_id": project_id,
        "content": payload.content.strip(), "enabled": payload.enabled,
        "position": nxt, "created_at": now, "updated_at": now,
    }
    await get_collection("project_rules").insert_one(doc)
    return _rule_resp(doc)


@router.patch("/{project_id}/rules/{rule_id}", response_model=ProjectRuleResponse)
async def update_rule(project_id: str, rule_id: str, payload: ProjectRuleUpdate, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "update_rule", limit=60, window_seconds=60)
    await _project_or_404(project_id, owner["_id"])
    col = get_collection("project_rules")
    doc = await col.find_one({"_id": rule_id, "owner_id": owner["_id"], "project_id": project_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rule not found")
    updates: dict = {}
    if payload.content is not None:
        updates["content"] = payload.content.strip()
    if payload.enabled is not None:
        updates["enabled"] = payload.enabled
    if payload.position is not None:
        updates["position"] = payload.position
    if updates:
        updates["updated_at"] = utc_now()
        await col.update_one({"_id": rule_id}, {"$set": updates})
        doc = await col.find_one({"_id": rule_id})
    return _rule_resp(doc)


@router.delete("/{project_id}/rules/{rule_id}")
async def delete_rule(project_id: str, rule_id: str, owner=Depends(get_current_owner)):
    await _project_or_404(project_id, owner["_id"])
    col = get_collection("project_rules")
    doc = await col.find_one({"_id": rule_id, "owner_id": owner["_id"], "project_id": project_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rule not found")
    await col.delete_one({"_id": rule_id})
    return {"message": "Rule deleted"}


# ---- Task templates (edit-only: the 3 default types always exist) ----

@router.get("/{project_id}/task-templates", response_model=list[TaskTemplateResponse])
async def list_templates(project_id: str, owner=Depends(get_current_owner)):
    await _project_or_404(project_id, owner["_id"])
    await ensure_project_defaults(owner["_id"], project_id)
    col = get_collection("task_templates")
    cur = await col.find({"owner_id": owner["_id"], "project_id": project_id})
    try:
        docs = await cur.to_list(length=None)
    except Exception:
        docs = []
        async for d in cur:
            docs.append(d)
    order = {"task": 0, "feature": 1, "bug": 2}
    docs.sort(key=lambda d: (order.get(d.get("type"), 9), d.get("created_at", "")))
    return [_tpl_resp(d) for d in docs]


@router.post("/{project_id}/task-templates", response_model=TaskTemplateResponse)
async def create_template(project_id: str, payload: TaskTemplateCreate, request: Request, owner=Depends(get_current_owner)):
    """Create an extra template (type may repeat — selection lists all of them)."""
    rate_limit(request, "create_template", limit=30, window_seconds=60)
    await _project_or_404(project_id, owner["_id"])
    await ensure_project_defaults(owner["_id"], project_id)
    now = utc_now()
    doc = {
        "_id": new_id(), "owner_id": owner["_id"], "project_id": project_id,
        "name": payload.name.strip(), "type": payload.type,
        "content": payload.content, "is_default": False,
        "created_at": now, "updated_at": now,
    }
    await get_collection("task_templates").insert_one(doc)
    return _tpl_resp(doc)


@router.patch("/{project_id}/task-templates/{template_id}", response_model=TaskTemplateResponse)
async def update_template(project_id: str, template_id: str, payload: TaskTemplateUpdate, owner=Depends(get_current_owner)):
    await _project_or_404(project_id, owner["_id"])
    col = get_collection("task_templates")
    doc = await col.find_one({"_id": template_id, "owner_id": owner["_id"], "project_id": project_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.type is not None:
        updates["type"] = payload.type
    if payload.content is not None:
        updates["content"] = payload.content
    if updates:
        updates["updated_at"] = utc_now()
        await col.update_one({"_id": template_id}, {"$set": updates})
        doc = await col.find_one({"_id": template_id})
    return _tpl_resp(doc)


def template_type_label(ttype: str) -> str:
    return {"task": "Task", "feature": "Feature", "bug": "Bug"}.get(ttype, ttype)


# Re-export for tests/consumers that want the seed catalogue.
__all__ = ["router", "template_type_label"]
