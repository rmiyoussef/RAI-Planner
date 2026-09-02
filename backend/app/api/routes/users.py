from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.schemas.user import InternalUserCreate, InternalUserUpdate, InternalUserResponse, UserListResponse
from app.core.database import get_collection, new_id, utc_now
from app.api.deps import get_current_owner
import re

router = APIRouter(prefix="/users", tags=["users"])

def extract_username(url: str) -> str:
    url = url.strip().rstrip("/")
    m = re.search(r"github\.com/([^/]+)", url, re.IGNORECASE)
    if m:
        return m.group(1)
    return url.split("/")[-1]

def validate_github_url(url: str) -> bool:
    return bool(re.match(r"^(https?://)?(www\.)?github\.com/[^/]+/?$", url.strip(), re.IGNORECASE))

def doc_to_resp(doc):
    return InternalUserResponse(
        id=doc["_id"],
        owner_id=doc["owner_id"],
        full_name=doc["full_name"],
        email=doc.get("email"),
        github_url=doc["github_url"],
        github_username=doc["github_username"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"]
    )

@router.get("", response_model=UserListResponse)
async def list_users(search: Optional[str] = Query(None), owner=Depends(get_current_owner)):
    col = get_collection("users")
    cur = await col.find({"owner_id": owner["_id"]})
    try:
        items_raw = await cur.to_list(length=None)
    except:
        items_raw = []
        async for d in cur: items_raw.append(d)
    if search:
        s = search.lower()
        items_raw = [d for d in items_raw if s in d.get("full_name","").lower() or s in (d.get("email") or "").lower() or s in d.get("github_username","").lower()]
    items_raw.sort(key=lambda x: x.get("created_at",""), reverse=True)
    return UserListResponse(items=[doc_to_resp(d) for d in items_raw], total=len(items_raw))

@router.post("", response_model=InternalUserResponse)
async def create_user(payload: InternalUserCreate, owner=Depends(get_current_owner)):
    if not validate_github_url(payload.github_url):
        raise HTTPException(status_code=400, detail="Invalid GitHub URL format. Expected https://github.com/username")
    username = extract_username(payload.github_url)
    col = get_collection("users")
    doc = {
        "_id": new_id(),
        "owner_id": owner["_id"],
        "full_name": payload.full_name,
        "email": payload.email.lower() if payload.email else None,
        "github_url": payload.github_url,
        "github_username": username,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await col.insert_one(doc)
    return doc_to_resp(doc)

@router.get("/{user_id}", response_model=InternalUserResponse)
async def get_user(user_id: str, owner=Depends(get_current_owner)):
    col = get_collection("users")
    doc = await col.find_one({"_id": user_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return doc_to_resp(doc)

@router.put("/{user_id}", response_model=InternalUserResponse)
async def update_user(user_id: str, payload: InternalUserUpdate, owner=Depends(get_current_owner)):
    col = get_collection("users")
    doc = await col.find_one({"_id": user_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name
    if payload.email is not None:
        updates["email"] = payload.email.lower()
    if payload.github_url is not None:
        if not validate_github_url(payload.github_url):
            raise HTTPException(status_code=400, detail="Invalid GitHub URL")
        updates["github_url"] = payload.github_url
        updates["github_username"] = extract_username(payload.github_url)
    if updates:
        updates["updated_at"] = utc_now()
        await col.update_one({"_id": user_id}, {"$set": updates})
        doc = await col.find_one({"_id": user_id})
    return doc_to_resp(doc)

@router.delete("/{user_id}")
async def delete_user(user_id: str, owner=Depends(get_current_owner)):
    col = get_collection("users")
    doc = await col.find_one({"_id": user_id, "owner_id": owner["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    await col.delete_one({"_id": user_id})
    return {"message": "User removed"}
