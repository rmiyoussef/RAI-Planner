from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from typing import Optional, List
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse, TaskVersionResponse, TaskActivityResponse
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
from app.agents.smart_engineering_agent import agent
from app.core.ratelimit import rate_limit

router = APIRouter(prefix="/tasks", tags=["tasks"])

async def enrich_task(doc, owner_id: str):
    # fetch project name and assigned user name
    project_name = None
    if doc.get("project_id"):
        proj = await get_collection("projects").find_one({"_id": doc["project_id"]})
        if proj:
            project_name = proj.get("name")
    assigned_name = None
    if doc.get("assigned_to"):
        u = await get_collection("users").find_one({"_id": doc["assigned_to"]})
        if u:
            assigned_name = u.get("full_name")
    return TaskResponse(
        id=doc["_id"],
        owner_id=doc["owner_id"],
        project_id=doc["project_id"],
        project_name=project_name,
        title=doc["title"],
        description=doc.get("description",""),
        priority=doc.get("priority","medium"),
        status=doc.get("status","todo"),
        assigned_to=doc.get("assigned_to"),
        assigned_user_name=assigned_name,
        tags=doc.get("tags",[]),
        task_type=doc.get("task_type", "task"),
        ai_generated=doc.get("ai_generated", False),
        version=doc.get("version",1),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"]
    )

@router.get("", response_model=TaskListResponse)
async def list_tasks(
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    owner=Depends(get_current_owner)
):
    col = get_collection("tasks")
    filt = {"owner_id": owner["_id"]}
    if project_id:
        filt["project_id"] = project_id
    if status:
        filt["status"] = status
    if priority:
        filt["priority"] = priority
    if assigned_to:
        filt["assigned_to"] = assigned_to
    cur = await col.find(filt)
    try:
        items_raw = await cur.to_list(length=None)
    except:
        items_raw = []
        async for d in cur: items_raw.append(d)
    if search:
        s = search.lower()
        items_raw = [d for d in items_raw if s in d.get("title","").lower() or s in d.get("description","").lower()]
    items_raw.sort(key=lambda x: x.get("created_at",""), reverse=True)
    total = len(items_raw)
    paged = items_raw[(page-1)*limit: page*limit]
    enriched = [await enrich_task(d, owner["_id"]) for d in paged]
    return TaskListResponse(items=enriched, total=total)

@router.post("", response_model=TaskResponse)
async def create_task(payload: TaskCreate, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "create_task", limit=60, window_seconds=60)
    # validate project exists and belongs to owner
    proj = await get_collection("projects").find_one({"_id": payload.project_id, "owner_id": owner["_id"]})
    if not proj:
        raise HTTPException(status_code=400, detail="Task must belong to a valid project")
    # validate assigned user if provided
    if payload.assigned_to:
        u = await get_collection("users").find_one({"_id": payload.assigned_to, "owner_id": owner["_id"]})
        if not u:
            raise HTTPException(status_code=400, detail="Assigned user not found")
    doc = {
        "_id": new_id(),
        "owner_id": owner["_id"],
        "project_id": payload.project_id,
        "title": payload.title,
        "description": payload.description,
        "priority": payload.priority,
        "status": payload.status,
        "assigned_to": payload.assigned_to,
        "tags": payload.tags,
        "task_type": payload.task_type,
        "ai_generated": False,
        "version": 1,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await get_collection("tasks").insert_one(doc)
    # version + activity
    await get_collection("task_versions").insert_one({
        "_id": new_id(),
        "task_id": doc["_id"],
        "owner_id": owner["_id"],
        "version": 1,
        "title": doc["title"],
        "description": doc["description"],
        "priority": doc["priority"],
        "status": doc["status"],
        "assigned_to": doc["assigned_to"],
        "tags": doc["tags"],
        "task_type": doc["task_type"],
        "created_at": utc_now(),
    })
    await get_collection("task_activities").insert_one({
        "_id": new_id(),
        "task_id": doc["_id"],
        "owner_id": owner["_id"],
        "timestamp": utc_now(),
        "action": "task_created",
        "actor": owner["_id"],
        "changes": [],
        "version": 1
    })
    return await enrich_task(doc, owner["_id"])

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, owner=Depends(get_current_owner)):
    doc = await get_collection("tasks").find_one({"_id": task_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return await enrich_task(doc, owner["_id"])

async def _perform_task_update(task_id: str, payload: TaskUpdate, owner) -> TaskResponse:
    col = get_collection("tasks")
    doc = await col.find_one({"_id": task_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    # Determine which fields were explicitly provided (supports clearing assigned_to with null)
    provided = payload.model_fields_set if hasattr(payload, "model_fields_set") else {k for k in ["title","description","priority","status","assigned_to","tags","task_type"] if getattr(payload, k) is not None}
    # validate assigned_to when explicitly provided and non-null
    if "assigned_to" in provided and payload.assigned_to is not None and payload.assigned_to != "":
        u = await get_collection("users").find_one({"_id": payload.assigned_to, "owner_id": owner["_id"]})
        if not u:
            raise HTTPException(status_code=400, detail="Assigned user not found")
    # capture changes — only for fields that were provided
    changes = []
    updates: dict = {}
    for field in ["title","description","priority","status","assigned_to","tags","task_type"]:
        if field not in provided:
            continue
        new_val = getattr(payload, field)
        # normalize empty string for assigned_to as None (clear)
        if field == "assigned_to" and new_val == "":
            new_val = None
        old_val = doc.get(field)
        # normalize both sides for comparison (None vs missing)
        if old_val != new_val:
            changes.append({"field": field, "old_value": old_val, "new_value": new_val})
            updates[field] = new_val
    if not changes:
        return await enrich_task(doc, owner["_id"])
    # version bump if content fields changed
    content_fields = {"title","description","priority","status","assigned_to","tags","task_type"}
    bump = any(c["field"] in content_fields for c in changes)
    new_version = doc.get("version",1) + (1 if bump else 0)
    if bump:
        updates["version"] = new_version
    updates["updated_at"] = utc_now()
    await col.update_one({"_id": task_id}, {"$set": updates})
    # record version if bumped
    if bump:
        await get_collection("task_versions").insert_one({
            "_id": new_id(),
            "task_id": task_id,
            "owner_id": owner["_id"],
            "version": new_version,
            "title": updates.get("title", doc["title"]),
            "description": updates.get("description", doc["description"]),
            "priority": updates.get("priority", doc["priority"]),
            "status": updates.get("status", doc["status"]),
            "assigned_to": updates.get("assigned_to", doc.get("assigned_to")),
            "tags": updates.get("tags", doc["tags"]),
            "task_type": updates.get("task_type", doc.get("task_type", "task")),
            "created_at": utc_now(),
        })
    # activity
    action_map = {"title":"title_changed","description":"description_changed","priority":"priority_changed","status":"status_changed","assigned_to":"assigned_user_changed","tags":"tags_changed","task_type":"task_type_changed"}
    action = "task_updated"
    if len(changes)==1:
        action = action_map.get(changes[0]["field"], "task_updated")
    await get_collection("task_activities").insert_one({
        "_id": new_id(),
        "task_id": task_id,
        "owner_id": owner["_id"],
        "timestamp": utc_now(),
        "action": action,
        "actor": owner["_id"],
        "changes": changes,
        "version": new_version
    })
    updated = await col.find_one({"_id": task_id})
    return await enrich_task(updated, owner["_id"])


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, payload: TaskUpdate, owner=Depends(get_current_owner)):
    return await _perform_task_update(task_id, payload, owner)


@router.patch("/{task_id}", response_model=TaskResponse)
async def patch_task(task_id: str, payload: TaskUpdate, owner=Depends(get_current_owner)):
    return await _perform_task_update(task_id, payload, owner)

@router.delete("/{task_id}")
async def delete_task(task_id: str, owner=Depends(get_current_owner)):
    # Tasks are not hard-deleted via UI spec? But allow API for tests
    col = get_collection("tasks")
    doc = await col.find_one({"_id": task_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    await col.delete_one({"_id": task_id})
    return {"message": "Task deleted"}

@router.get("/{task_id}/versions", response_model=List[TaskVersionResponse])
async def list_versions(task_id: str, owner=Depends(get_current_owner)):
    # verify task belongs to owner
    task = await get_collection("tasks").find_one({"_id": task_id, "owner_id": owner["_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    col = get_collection("task_versions")
    cur = await col.find({"task_id": task_id})
    try:
        items = await cur.to_list(length=None)
    except:
        items = []
        async for d in cur: items.append(d)
    items.sort(key=lambda x: x.get("version",0))
    return [TaskVersionResponse(
        id=d["_id"], task_id=d["task_id"], version=d["version"], title=d["title"], description=d["description"],
        priority=d["priority"], status=d["status"], assigned_to=d.get("assigned_to"), tags=d.get("tags",[]), task_type=d.get("task_type","task"), created_at=d["created_at"]
    ) for d in items]

@router.get("/{task_id}/activities", response_model=List[TaskActivityResponse])
async def list_activities(task_id: str, owner=Depends(get_current_owner)):
    task = await get_collection("tasks").find_one({"_id": task_id, "owner_id": owner["_id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    col = get_collection("task_activities")
    cur = await col.find({"task_id": task_id})
    try:
        items = await cur.to_list(length=None)
    except:
        items = []
        async for d in cur: items.append(d)
    items.sort(key=lambda x: x.get("timestamp",""), reverse=True)
    return [TaskActivityResponse(
        id=d["_id"], task_id=d["task_id"], timestamp=d["timestamp"], action=d["action"], actor=d["actor"], changes=d.get("changes",[]), version=d.get("version",1)
    ) for d in items]

@router.get("/{task_id}/generate/progress")
async def generate_progress(task_id: str, request: Request, owner=Depends(get_current_owner)):
    """Live per-stage progress of a running AI generation (polled by the UI)."""
    from app.agents.smart_engineering_agent import get_generation_progress
    rate_limit(request, "generate_progress", limit=60, window_seconds=60)
    # verify task belongs to owner (no existence leak beyond 404)
    doc = await get_collection("tasks").find_one({"_id": task_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return get_generation_progress(owner["_id"], task_id)

@router.post("/{task_id}/generate")
async def generate_task(task_id: str, owner=Depends(get_current_owner)):
    # check disabled state handled inside agent
    try:
        result = await agent.generate_task(owner["_id"], task_id)
        return {
            "markdown": result["markdown"],
            "task": await enrich_task(result["task"], owner["_id"]),
            "elapsed_ms": result.get("elapsed_ms"),
            "protocol": result.get("protocol"),
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
