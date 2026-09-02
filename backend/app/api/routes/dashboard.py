from fastapi import APIRouter, Depends, Query
from typing import Optional
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from app.api.deps import get_current_owner
from app.core.database import get_collection

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

def parse_iso(s: str):
    try:
        # handle iso with timezone
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except:
        return None

def bucket_dates(dates, granularity: str):
    # dates: list of datetime
    counter = Counter()
    for d in dates:
        if not d: continue
        if granularity == "daily":
            key = d.strftime("%Y-%m-%d")
        elif granularity == "weekly":
            # ISO week
            year, week, _ = d.isocalendar()
            key = f"{year}-W{week:02d}"
        elif granularity == "monthly":
            key = d.strftime("%Y-%m")
        else:
            key = d.strftime("%Y-%m-%d")
        counter[key] += 1
    # sorted
    sorted_keys = sorted(counter.keys())
    return [{"date": k, "count": counter[k]} for k in sorted_keys]

@router.get("",)
async def dashboard(granularity: str = Query("daily", pattern="^(daily|weekly|monthly)$"), owner=Depends(get_current_owner)):
    projects_col = get_collection("projects")
    tasks_col = get_collection("tasks")
    # fetch projects
    cur = await projects_col.find({"owner_id": owner["_id"]})
    try:
        projects = await cur.to_list(length=None)
    except:
        projects = []
        async for d in cur: projects.append(d)
    cur2 = await tasks_col.find({"owner_id": owner["_id"]})
    try:
        tasks = await cur2.to_list(length=None)
    except:
        tasks = []
        async for d in cur2: tasks.append(d)
    projects_total = len(projects)
    projects_active = sum(1 for p in projects if p.get("status")=="active")
    projects_disabled = projects_total - projects_active
    tasks_total = len(tasks)
    by_status = dict(Counter(t.get("status","todo") for t in tasks))
    by_priority = dict(Counter(t.get("priority","medium") for t in tasks))
    # date aggregation using created_at
    p_dates = [parse_iso(p.get("created_at","")) for p in projects]
    p_dates = [d for d in p_dates if d]
    t_dates = [parse_iso(t.get("created_at","")) for t in tasks]
    t_dates = [d for d in t_dates if d]
    # completed: status done
    completed_dates = [parse_iso(t.get("updated_at","")) for t in tasks if t.get("status")=="done"]
    completed_dates = [d for d in completed_dates if d]
    return {
        "projects_total": projects_total,
        "projects_active": projects_active,
        "projects_disabled": projects_disabled,
        "tasks_total": tasks_total,
        "tasks_by_status": by_status,
        "tasks_by_priority": by_priority,
        "projects_created_over_time": bucket_dates(p_dates, granularity),
        "tasks_created_over_time": bucket_dates(t_dates, granularity),
        "tasks_completed_over_time": bucket_dates(completed_dates, granularity),
    }
