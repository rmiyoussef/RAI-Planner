from fastapi import APIRouter, Depends
from app.api.deps import get_current_owner
from app.core.database import get_collection
from app.agents.smart_engineering_agent import agent

router = APIRouter(prefix="/agent", tags=["agent"])

@router.get("/status")
async def status(owner=Depends(get_current_owner)):
    return await agent.get_status(owner["_id"])

@router.get("/runs")
async def runs(owner=Depends(get_current_owner)):
    col = get_collection("agent_runs")
    cur = await col.find({"owner_id": owner["_id"]})
    try:
        items = await cur.to_list(length=None)
    except:
        items = []
        async for d in cur: items.append(d)
    items.sort(key=lambda x: x.get("started_at",""), reverse=True)
    return items[:50]

@router.post("/start")
async def start(owner=Depends(get_current_owner)):
    await agent.start()
    return await agent.get_status(owner["_id"])

@router.post("/stop")
async def stop(owner=Depends(get_current_owner)):
    await agent.stop()
    return await agent.get_status(owner["_id"])

@router.post("/restart")
async def restart(owner=Depends(get_current_owner)):
    await agent.restart()
    return await agent.get_status(owner["_id"])
