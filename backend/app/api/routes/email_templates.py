"""Email Templates: general (DB-owned) + project backend (filesystem-owned)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.email_template import (
    EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateResponse, EmailTemplateVariable,
    ProjectEmailTemplateMeta, ProjectEmailTemplateDetail, ProjectEmailTemplateUpdate,
    EmailPreviewRequest, EmailPreviewResponse,
)
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
from app.core.ratelimit import rate_limit
from app.services.email_variables import extract_general_variables, render_general_preview
from app.services.blade_parser import render_blade_preview
from app.services import email_scanner as scanner

router = APIRouter(tags=["email-templates"])


def _general_resp(d) -> EmailTemplateResponse:
    content = d.get("content", "")
    return EmailTemplateResponse(
        id=d["_id"], name=d.get("name", ""), description=d.get("description", ""),
        content=content, type="general",
        variables=d.get("variables") or extract_general_variables(content),
        created_at=d.get("created_at", ""), updated_at=d.get("updated_at", ""),
    )


async def _project_or_404(project_id: str, owner_id: str):
    doc = await get_collection("projects").find_one({"_id": project_id, "owner_id": owner_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


# ---- General CRUD ----

@router.get("/email-templates", response_model=list[EmailTemplateResponse])
async def list_general(owner=Depends(get_current_owner)):
    col = get_collection("email_templates")
    cur = await col.find({"owner_id": owner["_id"], "type": "general"})
    try:
        docs = await cur.to_list(length=None)
    except Exception:
        docs = []
        async for d in cur:
            docs.append(d)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return [_general_resp(d) for d in docs]


@router.post("/email-templates", response_model=EmailTemplateResponse)
async def create_general(payload: EmailTemplateCreate, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "create_email_template", limit=60, window_seconds=60)
    now = utc_now()
    doc = {
        "_id": new_id(), "owner_id": owner["_id"], "type": "general",
        "name": payload.name.strip(), "description": (payload.description or "").strip(),
        "content": payload.content or "",
        "variables": extract_general_variables(payload.content or ""),
        "created_at": now, "updated_at": now,
    }
    await get_collection("email_templates").insert_one(doc)
    return _general_resp(doc)


@router.get("/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def get_general(template_id: str, owner=Depends(get_current_owner)):
    doc = await get_collection("email_templates").find_one({"_id": template_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return _general_resp(doc)


@router.patch("/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def update_general(template_id: str, payload: EmailTemplateUpdate, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "update_email_template", limit=60, window_seconds=60)
    col = get_collection("email_templates")
    doc = await col.find_one({"_id": template_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.content is not None:
        updates["content"] = payload.content
        updates["variables"] = extract_general_variables(payload.content)
    if updates:
        updates["updated_at"] = utc_now()
        await col.update_one({"_id": template_id}, {"$set": updates})
        doc = await col.find_one({"_id": template_id})
    return _general_resp(doc)


@router.delete("/email-templates/{template_id}")
async def delete_general(template_id: str, owner=Depends(get_current_owner)):
    col = get_collection("email_templates")
    doc = await col.find_one({"_id": template_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    await col.delete_one({"_id": template_id})
    return {"message": "Template deleted"}


@router.post("/email-templates/preview", response_model=EmailPreviewResponse)
async def preview_general(payload: EmailPreviewRequest, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "preview_email_template", limit=60, window_seconds=60)
    if payload.kind == "blade":
        from app.services.blade_parser import analyze_blade
        analysis = analyze_blade(payload.content, known=[])
        return EmailPreviewResponse(
            html=render_blade_preview(payload.content), mock=True,
            unknown_variables=[EmailTemplateVariable(**u) for u in analysis["unknown"]],
        )
    return EmailPreviewResponse(html=render_general_preview(payload.content), mock=True)


# ---- Project backend templates (filesystem source of truth) ----

def _scan_project(project_doc) -> tuple[str, list[dict]]:
    project_path = project_doc.get("project_path", "")
    if not project_path:
        raise HTTPException(status_code=400, detail="Project path not configured")
    if not scanner.detect_laravel(project_path):
        raise HTTPException(status_code=400, detail="This project's backend framework is not currently supported. Laravel email templates are currently supported.")
    sc = scanner.LaravelEmailTemplateScanner()
    items = sc.scan(project_path)
    return project_path, items


@router.get("/projects/{project_id}/email-templates", response_model=list[ProjectEmailTemplateMeta])
async def list_project_templates(project_id: str, owner=Depends(get_current_owner)):
    doc = await _project_or_404(project_id, owner["_id"])
    _, items = _scan_project(doc)
    out = []
    for it in items:
        out.append(ProjectEmailTemplateMeta(
            id=it["id"], project_id=project_id, project_name=doc.get("name", ""),
            name=it["name"], file_name=it["file_name"], relative_path=it["relative_path"],
            framework=it["framework"], module=it.get("module"),
            variables=it.get("variables", []), variables_count=it.get("variables_count", 0),
            updated_at=it.get("updated_at", ""), exists=True,
        ))
    return out


@router.post("/projects/{project_id}/email-templates/scan", response_model=list[ProjectEmailTemplateMeta])
async def scan_project_templates(project_id: str, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "scan_email_templates", limit=30, window_seconds=60)
    return await list_project_templates(project_id, owner)


@router.get("/projects/{project_id}/email-templates/{template_id}", response_model=ProjectEmailTemplateDetail)
async def get_project_template(project_id: str, template_id: str, owner=Depends(get_current_owner)):
    doc = await _project_or_404(project_id, owner["_id"])
    _, items = _scan_project(doc)
    match = next((i for i in items if i["id"] == template_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="This email template no longer exists in the project.")
    project_path = doc.get("project_path", "")
    res = scanner.read_project_template(project_path, match["relative_path"])
    if not res.get("ok"):
        raise HTTPException(status_code=400 if "invalid" in res.get("error", "").lower() else 404, detail=res.get("error", "Cannot read file"))
    return ProjectEmailTemplateDetail(
        id=match["id"], project_id=project_id, project_name=doc.get("name", ""),
        name=match["name"], file_name=res["file_name"], relative_path=res["relative_path"],
        framework="laravel", module=res.get("module"),
        variables=res.get("variables", []), variables_count=len(res.get("variables", [])),
        updated_at=res.get("updated_at", ""), exists=True, content=res.get("content", ""),
    )


@router.patch("/projects/{project_id}/email-templates/{template_id}", response_model=ProjectEmailTemplateDetail)
async def save_project_template(project_id: str, template_id: str, payload: ProjectEmailTemplateUpdate, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "save_project_email_template", limit=30, window_seconds=60)
    doc = await _project_or_404(project_id, owner["_id"])
    _, items = _scan_project(doc)
    match = next((i for i in items if i["id"] == template_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="This email template no longer exists in the project.")
    project_path = doc.get("project_path", "")
    res = scanner.write_project_template(project_path, match["relative_path"], payload.content)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error", "Unable to save the project email template. The source file could not be updated."))
    return ProjectEmailTemplateDetail(
        id=match["id"], project_id=project_id, project_name=doc.get("name", ""),
        name=match["name"], file_name=res["file_name"], relative_path=res["relative_path"],
        framework="laravel", module=res.get("module"),
        variables=res.get("variables", []), variables_count=len(res.get("variables", [])),
        updated_at=res.get("updated_at", ""), exists=True, content=res.get("content", ""),
    )
