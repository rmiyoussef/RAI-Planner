from pydantic import BaseModel, Field
from typing import Optional

class CompanyResponse(BaseModel):
    id: str
    owner_id: str
    company_name: str
    company_logo: Optional[str] = None
    created_at: str
    updated_at: str

class CompanyUpdateRequest(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    company_logo: Optional[str] = Field(default=None, description="Base64 data URL, image URL, or empty to clear")

class SignupStatusResponse(BaseModel):
    allowed: bool
    reason: Optional[str] = None
