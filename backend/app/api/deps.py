from fastapi import Header, HTTPException, Depends
from typing import Optional
from app.core.security import decode_token
from app.core.database import get_collection

async def get_current_owner(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    owner_id = decode_token(token)
    if not owner_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    col = get_collection("owners")
    owner = await col.find_one({"_id": owner_id})
    if not owner:
        raise HTTPException(status_code=401, detail="Owner not found")
    return owner
