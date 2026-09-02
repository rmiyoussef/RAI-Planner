from pydantic import BaseModel, Field
from typing import Optional, List, Literal

ProjectStatus = Literal["active", "disabled"]

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    project_path: str = Field(min_length=1, max_length=500)
    tags: List[str] = Field(default_factory=list)
    status: ProjectStatus = "active"

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    project_path: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[ProjectStatus] = None

class ProjectResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: str
    project_path: str
    tags: List[str]
    status: str
    created_at: str
    updated_at: str
    task_count: int = 0
    brain_available: bool = False
    brain_message: Optional[str] = None

class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
