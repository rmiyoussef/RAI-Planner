from fastapi import APIRouter, HTTPException, Request, Depends
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, OwnerResponse, ProfileUpdateRequest, PasswordChangeRequest
from app.core.database import get_collection, new_id, utc_now
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import get_settings
from app.core.ratelimit import rate_limit
from app.api.deps import get_current_owner
from fastapi import Depends

router = APIRouter(prefix="/auth", tags=["auth"])

def owner_to_response(doc):
    return OwnerResponse(
        id=doc["_id"],
        full_name=doc["full_name"],
        email=doc["email"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"]
    )

@router.get("/signup-status")
async def signup_status():
    """Check if signup is allowed — first time only (single workspace)."""
    col = get_collection("owners")
    count = await col.count_documents({})
    if count > 0:
        return {"allowed": False, "reason": "Workspace already initialized — signup is available only at first setup"}
    settings = get_settings()
    if not settings.ALLOW_SIGNUP:
        return {"allowed": False, "reason": "Registration is disabled on this server"}
    return {"allowed": True, "reason": None}

@router.post("/signup", response_model=TokenResponse)
async def signup(payload: SignupRequest, request: Request):
    col = get_collection("owners")
    rate_limit(request, "signup", limit=10, window_seconds=60)
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    # duplicate email check first (keeps 400 for existing tests)
    email_norm = payload.email.strip().lower()
    existing = await col.find_one({"email": email_norm})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    # First-time-only: only one workspace/owner allowed (after duplicate check)
    count = await col.count_documents({})
    if count > 0:
        raise HTTPException(status_code=403, detail="Signup is available only at first setup — workspace already initialized")
    settings = get_settings()
    if not settings.ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="Registration is disabled on this server")
    doc = {
        "_id": new_id(),
        "full_name": payload.full_name.strip(),
        "email": email_norm,
        "password_hash": hash_password(payload.password),
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await col.insert_one(doc)
    # create company settings tied to owner — fallback to My Company if not provided (keeps old tests working)
    try:
        company_col = get_collection("company_settings")
        company_name = (payload.company_name.strip() if payload.company_name and payload.company_name.strip() else "My Company")
        company_doc = {
            "_id": new_id(),
            "owner_id": doc["_id"],
            "company_name": company_name,
            "company_logo": payload.company_logo.strip() if payload.company_logo and payload.company_logo.strip() else None,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        await company_col.insert_one(company_doc)
    except Exception:
        pass
    token = create_access_token(doc["_id"])
    return TokenResponse(access_token=token, owner=owner_to_response(doc))

@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request):
    # Brute-force protection: 10 attempts / minute / IP
    rate_limit(request, "login", limit=10, window_seconds=60)
    col = get_collection("owners")
    email_norm = payload.email.strip().lower()
    owner = await col.find_one({"email": email_norm})
    if not owner or not verify_password(payload.password, owner["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password. Please check your credentials and try again.")
    token = create_access_token(owner["_id"])
    return TokenResponse(access_token=token, owner=owner_to_response(owner))

@router.get("/me", response_model=OwnerResponse)
async def me(owner=Depends(get_current_owner)):
    return owner_to_response(owner)

@router.put("/profile", response_model=OwnerResponse)
async def update_profile(payload: ProfileUpdateRequest, owner=Depends(get_current_owner)):
    col = get_collection("owners")
    updates = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.email is not None:
        # check unique
        existing = await col.find_one({"email": payload.email.lower()})
        if existing and existing["_id"] != owner["_id"]:
            raise HTTPException(status_code=400, detail="Email already in use")
        updates["email"] = payload.email.lower()
    if updates:
        updates["updated_at"] = utc_now()
        await col.update_one({"_id": owner["_id"]}, {"$set": updates})
        owner = await col.find_one({"_id": owner["_id"]})
    return owner_to_response(owner)

@router.post("/change-password")
async def change_password(payload: PasswordChangeRequest, owner=Depends(get_current_owner)):
    if not verify_password(payload.current_password, owner["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    col = get_collection("owners")
    await col.update_one({"_id": owner["_id"]}, {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": utc_now()}})
    return {"message": "Password updated"}
