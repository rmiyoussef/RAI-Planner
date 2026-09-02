from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class AIConfigRequest(BaseModel):
    provider_url: str = Field(default="", max_length=500)
    model_name: str = Field(default="", max_length=200)
    api_key: str = Field(default="", max_length=500)

class AIConfigResponse(BaseModel):
    provider_url: str
    model_name: str
    api_key_masked: str
    has_key: bool
    updated_at: Optional[str] = None

class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    instructions: str = Field(min_length=1, max_length=5000)
    enabled: bool = True

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    enabled: Optional[bool] = None

class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    instructions: str
    enabled: bool
    created_at: str
    updated_at: str

class AgentSettingsRequest(BaseModel):
    system_prompt: str = Field(default="", max_length=10000)

class AgentStatusResponse(BaseModel):
    state: str
    is_running: bool
    last_activity: Optional[str] = None
    last_success: Optional[str] = None
    last_error: Optional[str] = None
    provider_url: Optional[str] = None
    model_name: Optional[str] = None
    system_prompt: Optional[str] = None

class AgentRunResponse(BaseModel):
    id: str
    task_id: str
    project_id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    error_category: Optional[str] = None
    error_message: Optional[str] = None
