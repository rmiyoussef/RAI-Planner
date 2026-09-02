from fastapi import APIRouter, Depends, HTTPException
from app.schemas.agent import AIConfigRequest, AIConfigResponse, SkillCreate, SkillUpdate, SkillResponse, AgentSettingsRequest, AgentStatusResponse
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
from app.core.security import encrypt_secret, decrypt_secret, mask_secret
from app.agents.smart_engineering_agent import agent
from app.agents.prompt_manager import DEFAULT_SYSTEM_PROMPT

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/ai-config", response_model=AIConfigResponse)
async def get_ai_config(owner=Depends(get_current_owner)):
    col = get_collection("ai_configs")
    cfg = await col.find_one({"owner_id": owner["_id"]})
    if not cfg:
        return AIConfigResponse(provider_url="", model_name="", api_key_masked="", has_key=False)
    masked = ""
    if cfg.get("api_key_encrypted"):
        from app.core.security import mask_api_key_encrypted
        masked = mask_api_key_encrypted(cfg["api_key_encrypted"])
    return AIConfigResponse(
        provider_url=cfg.get("provider_url",""),
        model_name=cfg.get("model_name",""),
        api_key_masked=masked,
        has_key=bool(cfg.get("api_key_encrypted")),
        updated_at=cfg.get("updated_at")
    )

@router.put("/ai-config", response_model=AIConfigResponse)
async def put_ai_config(payload: AIConfigRequest, owner=Depends(get_current_owner)):
    col = get_collection("ai_configs")
    existing = await col.find_one({"owner_id": owner["_id"]})
    enc_key = encrypt_secret(payload.api_key) if payload.api_key else (existing.get("api_key_encrypted") if existing else "")
    doc = {
        "owner_id": owner["_id"],
        "provider_url": payload.provider_url,
        "model_name": payload.model_name,
        "api_key_encrypted": enc_key,
        "updated_at": utc_now(),
    }
    if existing:
        await col.update_one({"owner_id": owner["_id"]}, {"$set": doc})
    else:
        doc["_id"] = new_id()
        doc["created_at"] = utc_now()
        await col.insert_one(doc)
    cfg = await col.find_one({"owner_id": owner["_id"]})
    from app.core.security import mask_api_key_encrypted
    masked = mask_api_key_encrypted(cfg["api_key_encrypted"]) if cfg.get("api_key_encrypted") else ""
    # restart agent as per spec
    await agent.restart()
    return AIConfigResponse(provider_url=cfg.get("provider_url",""), model_name=cfg.get("model_name",""), api_key_masked=masked, has_key=bool(cfg.get("api_key_encrypted")), updated_at=cfg.get("updated_at"))

# Agent settings
@router.get("/agent", response_model=AgentStatusResponse)
async def get_agent_status(owner=Depends(get_current_owner)):
    status = await agent.get_status(owner["_id"])
    return AgentStatusResponse(**status)

@router.put("/agent/prompt")
async def update_prompt(payload: AgentSettingsRequest, owner=Depends(get_current_owner)):
    doc = await agent.update_system_prompt(owner["_id"], payload.system_prompt)
    return {"system_prompt": doc["system_prompt"]}

@router.post("/agent/start")
async def start_agent(owner=Depends(get_current_owner)):
    await agent.start()
    return await agent.get_status(owner["_id"])

@router.post("/agent/stop")
async def stop_agent(owner=Depends(get_current_owner)):
    await agent.stop()
    return await agent.get_status(owner["_id"])

@router.post("/agent/restart")
async def restart_agent(owner=Depends(get_current_owner)):
    await agent.restart()
    return await agent.get_status(owner["_id"])

# Skills
@router.get("/skills", response_model=list[SkillResponse])
async def list_skills(owner=Depends(get_current_owner)):
    col = get_collection("agent_skills")
    cur = await col.find({"owner_id": owner["_id"]})
    try:
        items = await cur.to_list(length=None)
    except:
        items = []
        async for d in cur: items.append(d)
    return [SkillResponse(id=d["_id"], name=d["name"], description=d.get("description",""), instructions=d["instructions"], enabled=d.get("enabled",True), created_at=d["created_at"], updated_at=d["updated_at"]) for d in items]

@router.post("/skills", response_model=SkillResponse)
async def create_skill(payload: SkillCreate, owner=Depends(get_current_owner)):
    from app.agents.skill_manager import SkillManager
    sm = SkillManager()
    doc = await sm.create(owner["_id"], payload.model_dump())
    return SkillResponse(id=doc["_id"], name=doc["name"], description=doc.get("description",""), instructions=doc["instructions"], enabled=doc["enabled"], created_at=doc["created_at"], updated_at=doc["updated_at"])

@router.put("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(skill_id: str, payload: SkillUpdate, owner=Depends(get_current_owner)):
    from app.agents.skill_manager import SkillManager
    sm = SkillManager()
    doc = await sm.update(skill_id, owner["_id"], payload.model_dump(exclude_unset=True))
    if not doc:
        raise HTTPException(status_code=404, detail="Skill not found")
    return SkillResponse(id=doc["_id"], name=doc["name"], description=doc.get("description",""), instructions=doc["instructions"], enabled=doc.get("enabled",True), created_at=doc["created_at"], updated_at=doc["updated_at"])

@router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str, owner=Depends(get_current_owner)):
    from app.agents.skill_manager import SkillManager
    sm = SkillManager()
    ok = await sm.delete(skill_id, owner["_id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"message": "deleted"}
