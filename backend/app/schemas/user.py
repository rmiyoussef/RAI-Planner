from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
import re

class InternalUserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    github_url: str = Field(min_length=1, max_length=500)

    def github_username(self) -> str:
        # extract username
        url = self.github_url.strip().rstrip("/")
        # handle https://github.com/octocat or github.com/octocat
        match = re.search(r"github\.com/([^/]+)", url, re.IGNORECASE)
        if match:
            return match.group(1)
        return url.split("/")[-1]

class InternalUserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    github_url: Optional[str] = None

class InternalUserResponse(BaseModel):
    id: str
    owner_id: str
    full_name: str
    email: Optional[str] = None
    github_url: str
    github_username: str
    created_at: str
    updated_at: str

class UserListResponse(BaseModel):
    items: List[InternalUserResponse]
    total: int
