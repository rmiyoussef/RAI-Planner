from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
from app.services.filesystem import brain_status, validate_project_path
import re

router = APIRouter(prefix="/projects", tags=["projects"])

def doc_to_resp(doc, task_count=0):
    brain = brain_status(doc["project_path"]) if doc.get("project_path") else {"exists": False}
    return ProjectResponse(
        id=doc["_id"],
        owner_id=doc["owner_id"],
        name=doc["name"],
        description=doc.get("description",""),
        project_path=doc.get("project_path",""),
        tags=doc.get("tags",[]),
        status=doc.get("status","active"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
        task_count=task_count,
        brain_available=brain.get("exists", False),
        brain_message=brain.get("message") if not brain.get("exists") else None
    )

@router.get("", response_model=ProjectListResponse)
async def list_projects(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    owner=Depends(get_current_owner)
):
    col = get_collection("projects")
    filt = {"owner_id": owner["_id"]}
    if status:
        filt["status"] = status
    if search:
        # will filter in memory after fetch - because we support both mongo and memory
        pass
    # fetch all matching owner+status then filter search
    cur = await col.find(filt)
    try:
        items_raw = await cur.to_list(length=None)
    except:
        items_raw = []
        async for d in cur:
            items_raw.append(d)
    if search:
        s = search.lower()
        items_raw = [d for d in items_raw if s in d.get("name","").lower() or s in d.get("description","").lower() or any(s in t.lower() for t in d.get("tags",[]))]
    # sorting
    if sort == "name":
        items_raw.sort(key=lambda x: x.get("name",""))
    elif sort == "created_at":
        items_raw.sort(key=lambda x: x.get("created_at",""), reverse=True)
    else:
        items_raw.sort(key=lambda x: x.get("created_at",""), reverse=True)
    total = len(items_raw)
    start = (page-1)*limit
    paged = items_raw[start:start+limit]
    # task counts
    tasks_col = get_collection("tasks")
    result = []
    for doc in paged:
        cnt = await tasks_col.count_documents({"project_id": doc["_id"], "owner_id": owner["_id"]})
        result.append(doc_to_resp(doc, cnt))
    return ProjectListResponse(items=result, total=total)

@router.post("", response_model=ProjectResponse)
async def create_project(payload: ProjectCreate, owner=Depends(get_current_owner)):
    col = get_collection("projects")
    project_path = payload.project_path
    if project_path:
        ok, err_or_resolved = validate_project_path(project_path)
        if not ok:
            raise HTTPException(status_code=400, detail=f"Invalid project path: {err_or_resolved}")
        project_path = err_or_resolved
    doc = {
        "_id": new_id(),
        "owner_id": owner["_id"],
        "name": payload.name,
        "description": payload.description,
        "project_path": project_path,
        "tags": payload.tags,
        "status": payload.status,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await col.insert_one(doc)
    return doc_to_resp(doc, 0)

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, owner=Depends(get_current_owner)):
    col = get_collection("projects")
    doc = await col.find_one({"_id": project_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks_col = get_collection("tasks")
    cnt = await tasks_col.count_documents({"project_id": project_id, "owner_id": owner["_id"]})
    resp = doc_to_resp(doc, cnt)
    # add brain files for detail
    brain = brain_status(doc.get("project_path",""))
    # extend response with brain info via extra field? Use brain_message already
    return resp

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, payload: ProjectUpdate, owner=Depends(get_current_owner)):
    col = get_collection("projects")
    doc = await col.find_one({"_id": project_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    updates = {}
    for field in ["name","description","project_path","tags","status"]:
        val = getattr(payload, field)
        if val is not None:
            updates[field] = val
    if "project_path" in updates and updates["project_path"]:
        ok, err_or_resolved = validate_project_path(updates["project_path"])
        if not ok:
            raise HTTPException(status_code=400, detail=f"Invalid project path: {err_or_resolved}")
        updates["project_path"] = err_or_resolved
    if updates:
        updates["updated_at"] = utc_now()
        await col.update_one({"_id": project_id}, {"$set": updates})
        doc = await col.find_one({"_id": project_id})
    tasks_col = get_collection("tasks")
    cnt = await tasks_col.count_documents({"project_id": project_id, "owner_id": owner["_id"]})
    return doc_to_resp(doc, cnt)

@router.post("/{project_id}/disable", response_model=ProjectResponse)
async def disable_project(project_id: str, owner=Depends(get_current_owner)):
    col = get_collection("projects")
    doc = await col.find_one({"_id": project_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    await col.update_one({"_id": project_id}, {"$set": {"status": "disabled", "updated_at": utc_now()}})
    doc = await col.find_one({"_id": project_id})
    tasks_col = get_collection("tasks")
    cnt = await tasks_col.count_documents({"project_id": project_id, "owner_id": owner["_id"]})
    return doc_to_resp(doc, cnt)

@router.get("/{project_id}/brain")
async def brain_info(project_id: str, owner=Depends(get_current_owner)):
    col = get_collection("projects")
    doc = await col.find_one({"_id": project_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return brain_status(doc.get("project_path",""))

@router.get("/{project_id}/brain/file")
async def brain_file(project_id: str, path: str = Query(..., min_length=1, description="Relative path inside .brain"), owner=Depends(get_current_owner)):
    col = get_collection("projects")
    doc = await col.find_one({"_id": project_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    project_path = doc.get("project_path", "")
    if not project_path:
        raise HTTPException(status_code=400, detail="Project path not configured")
    from app.services.filesystem import read_brain_file
    result = read_brain_file(project_path, path)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Cannot read file"))
    return result
