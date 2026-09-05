from pydantic import BaseModel, Field
from typing import Optional, List, Literal

ProjectStatus = Literal["active", "disabled"]

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    project_path: str = Field(min_length=1, max_length=500)
    tags: List[str] = Field(default_factory=list)
    status: ProjectStatus = "active"
    system_prompt: str = Field(default="", max_length=20000)

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    project_path: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[ProjectStatus] = None
    system_prompt: Optional[str] = Field(default=None, max_length=20000)

class ProjectResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: str
    project_path: str
    tags: List[str]
    status: str
    system_prompt: str = ""
    created_at: str
    updated_at: str
    task_count: int = 0
    brain_available: bool = False
    brain_message: Optional[str] = None

class SystemPromptUpdate(BaseModel):
    system_prompt: str = Field(max_length=20000)

class SystemPromptGenerateResponse(BaseModel):
    system_prompt: str
    analysis: dict = Field(default_factory=dict)

TemplateType = Literal["task", "feature", "bug"]

class ProjectRuleCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    enabled: bool = True

class ProjectRuleUpdate(BaseModel):
    content: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    enabled: Optional[bool] = None
    position: Optional[int] = None

class ProjectRuleResponse(BaseModel):
    id: str
    project_id: str
    content: str
    enabled: bool = True
    position: int = 0
    created_at: str
    updated_at: str

class TaskTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: TemplateType = "task"
    content: str = Field(default="", max_length=20000)

class TaskTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    type: Optional[TemplateType] = None
    content: Optional[str] = Field(default=None, max_length=20000)

class TaskTemplateResponse(BaseModel):
    id: str
    project_id: str
    name: str
    type: str
    content: str
    is_default: bool = False
    created_at: str
    updated_at: str

class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
