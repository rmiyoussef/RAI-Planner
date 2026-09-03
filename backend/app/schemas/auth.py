from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=150, description="Company / workspace name")
    company_logo: Optional[str] = Field(default=None, description="Base64 data URL or image URL for company logo")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OwnerResponse(BaseModel):
    id: str
    full_name: str
    email: str
    created_at: str
    updated_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    owner: OwnerResponse

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
