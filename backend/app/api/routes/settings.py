from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.agent import AIConfigRequest, AIConfigResponse, SkillCreate, SkillUpdate, SkillResponse, AgentSettingsRequest, AgentStatusResponse
from app.schemas.company import CompanyResponse, CompanyUpdateRequest
from app.core.ratelimit import rate_limit
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
from app.core.security import encrypt_secret, decrypt_secret, mask_secret
from app.agents.smart_engineering_agent import agent
from app.agents.prompt_manager import DEFAULT_SYSTEM_PROMPT

router = APIRouter(prefix="/settings", tags=["settings"])

def _decrypt_field(enc_val: str, plain_fallback: str = "") -> str:
    """Try to decrypt, fallback to plain if not encrypted (migration)."""
    if not enc_val:
        return plain_fallback
    try:
        # if it looks like Fernet (base64 with 44+ chars and decrypts), decrypt
        dec = decrypt_secret(enc_val)
        # if decrypt returns same as input and input was not encrypted, it will return input via fallback
        # check if decrypt succeeded and is not same as plain fallback
        if dec and dec != enc_val:
            return dec
        # if dec is empty, it was not encrypted, return plain
        # try to check if enc_val is actually plain by seeing if it decrypts to something different
        # If decrypt returns empty or same, treat as plain
        if not dec:
            return plain_fallback or enc_val
        return dec
    except:
        return plain_fallback or enc_val

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
    # decrypt provider_url/model_name if stored encrypted (migration support)
    provider_url = _decrypt_field(cfg.get("provider_url_encrypted", ""), cfg.get("provider_url", ""))
    model_name = _decrypt_field(cfg.get("model_name_encrypted", ""), cfg.get("model_name", ""))
    return AIConfigResponse(
        provider_url=provider_url,
        model_name=model_name,
        api_key_masked=masked,
        has_key=bool(cfg.get("api_key_encrypted")),
        updated_at=cfg.get("updated_at")
    )

@router.put("/ai-config", response_model=AIConfigResponse)
async def put_ai_config(payload: AIConfigRequest, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "put_ai_config", limit=20, window_seconds=60)
    col = get_collection("ai_configs")
    existing = await col.find_one({"owner_id": owner["_id"]})
    enc_key = encrypt_secret(payload.api_key) if payload.api_key else (existing.get("api_key_encrypted") if existing else "")
    # encrypt all settings at rest
    enc_provider = encrypt_secret(payload.provider_url)
    enc_model = encrypt_secret(payload.model_name)
    doc = {
        "owner_id": owner["_id"],
        "provider_url": payload.provider_url,  # keep plain for backwards compat, but also store encrypted
        "provider_url_encrypted": enc_provider,
        "model_name": payload.model_name,
        "model_name_encrypted": enc_model,
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
    # decrypt for response
    prov = _decrypt_field(cfg.get("provider_url_encrypted", ""), cfg.get("provider_url", ""))
    model = _decrypt_field(cfg.get("model_name_encrypted", ""), cfg.get("model_name", ""))
    # restart agent as per spec
    await agent.restart()
    return AIConfigResponse(provider_url=prov, model_name=model, api_key_masked=masked, has_key=bool(cfg.get("api_key_encrypted")), updated_at=cfg.get("updated_at"))

@router.post("/ai-config/test")
async def test_ai_config(request: Request, owner=Depends(get_current_owner)):
    """Send a tiny probe completion through the configured provider.

    Tries the last working protocol first, then the rest automatically, and
    reports which one worked, so owners can verify AI Configuration.
    """
    import time
    from app.agents.ai_provider import AIProvider
    rate_limit(request, "test_ai_config", limit=10, window_seconds=60)
    provider = AIProvider()
    cfg = await provider.get_config(owner["_id"])
    if not cfg or not cfg.get("api_key_encrypted"):
        raise HTTPException(status_code=400, detail="AI configuration missing: API key not set")
    start = time.monotonic()
    try:
        out = await provider.generate(
            owner["_id"],
            "You are a connectivity probe. Reply with exactly: OK",
            "ping",
            max_tokens=60,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "ok": True,
        "latency_ms": latency_ms,
        "sample": (out or "")[:200],
        "protocol": getattr(provider, "last_protocol", None) or "chat",
    }

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

# Company / Workspace branding — encrypted at rest
@router.get("/company", response_model=CompanyResponse)
async def get_company(owner=Depends(get_current_owner)):
    col = get_collection("company_settings")
    doc = await col.find_one({"owner_id": owner["_id"]})
    # fallback: if no company yet, return default based on owner (from .env PROJECT_NAME)
    if not doc:
        from app.core.config import get_settings as _get_settings
        _proj = _get_settings().PROJECT_NAME
        now = utc_now()
        return CompanyResponse(
            id="default",
            owner_id=owner["_id"],
            company_name=_proj,
            company_logo=None,
            created_at=owner.get("created_at", now),
            updated_at=owner.get("updated_at", now),
        )
    # decrypt if stored encrypted (migration)
    cname = _decrypt_field(doc.get("company_name_encrypted", ""), doc.get("company_name", ""))
    clogo = _decrypt_field(doc.get("company_logo_encrypted", ""), doc.get("company_logo") or "")
    return CompanyResponse(
        id=doc["_id"],
        owner_id=doc["owner_id"],
        company_name=cname,
        company_logo=clogo if clogo else None,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )

@router.put("/company", response_model=CompanyResponse)
async def put_company(payload: CompanyUpdateRequest, request: Request, owner=Depends(get_current_owner)):
    rate_limit(request, "put_company", limit=20, window_seconds=60)
    # validate logo size
    if payload.company_logo and len(payload.company_logo) > 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo must be under 1MB")
    col = get_collection("company_settings")
    doc = await col.find_one({"owner_id": owner["_id"]})
    now = utc_now()
    if not doc:
        # create — encrypt at rest
        if not payload.company_name:
            raise HTTPException(status_code=400, detail="Company name is required")
        cname = payload.company_name.strip()
        clogo = payload.company_logo.strip() if payload.company_logo and payload.company_logo.strip() else None
        new_doc = {
            "_id": new_id(),
            "owner_id": owner["_id"],
            "company_name": cname,
            "company_name_encrypted": encrypt_secret(cname),
            "company_logo": clogo,
            "company_logo_encrypted": encrypt_secret(clogo) if clogo else None,
            "created_at": now,
            "updated_at": now,
        }
        await col.insert_one(new_doc)
        doc = new_doc
    else:
        updates: dict = {}
        if payload.company_name is not None:
            if not payload.company_name.strip():
                raise HTTPException(status_code=400, detail="Company name cannot be empty")
            cname = payload.company_name.strip()
            updates["company_name"] = cname
            updates["company_name_encrypted"] = encrypt_secret(cname)
        if payload.company_logo is not None:
            # allow empty string to clear logo
            val = payload.company_logo.strip()
            clogo = val if val else None
            updates["company_logo"] = clogo
            updates["company_logo_encrypted"] = encrypt_secret(clogo) if clogo else None
        if updates:
            updates["updated_at"] = now
            await col.update_one({"owner_id": owner["_id"]}, {"$set": updates})
            doc = await col.find_one({"owner_id": owner["_id"]})
    # decrypt for response
    cname_resp = _decrypt_field(doc.get("company_name_encrypted", ""), doc.get("company_name", ""))
    clogo_resp = _decrypt_field(doc.get("company_logo_encrypted", ""), doc.get("company_logo") or "")
    # validate logo size on read (defense)
    if clogo_resp and len(clogo_resp) > 1024 * 1024:
        clogo_resp = None
    return CompanyResponse(
        id=doc["_id"],
        owner_id=doc["owner_id"],
        company_name=cname_resp,
        company_logo=clogo_resp if clogo_resp else None,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )

@router.get("/company/public")
async def get_company_public():
    """Public company info for login/signup branding — no auth needed. Returns first workspace company if exists."""
    col = get_collection("company_settings")
    cur = await col.find({})
    try:
        items = await cur.to_list(length=None)
    except:
        items = []
        async for d in cur:
            items.append(d)
    if not items:
        return {"company_name": None, "company_logo": None, "initialized": False}
    doc = items[0]
    cname = _decrypt_field(doc.get("company_name_encrypted", ""), doc.get("company_name", ""))
    clogo = _decrypt_field(doc.get("company_logo_encrypted", ""), doc.get("company_logo") or "")
    return {"company_name": cname, "company_logo": clogo if clogo else None, "initialized": True}
