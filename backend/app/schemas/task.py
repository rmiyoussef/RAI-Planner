from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any

TaskPriority = Literal["low", "medium", "high", "critical"]
TaskStatus = Literal["todo", "in_progress", "in_review", "done", "archived"]

class TaskCreate(BaseModel):
    project_id: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=50000)
    priority: TaskPriority = "medium"
    status: TaskStatus = "todo"
    assigned_to: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    assigned_to: Optional[str] = None
    tags: Optional[List[str]] = None

class TaskResponse(BaseModel):
    id: str
    owner_id: str
    project_id: str
    project_name: Optional[str] = None
    title: str
    description: str
    priority: str
    status: str
    assigned_to: Optional[str] = None
    assigned_user_name: Optional[str] = None
    tags: List[str]
    ai_generated: bool = False
    version: int = 1
    created_at: str
    updated_at: str

class TaskListResponse(BaseModel):
    items: List[TaskResponse]
    total: int

class TaskVersionResponse(BaseModel):
    id: str
    task_id: str
    version: int
    title: str
    description: str
    priority: str
    status: str
    assigned_to: Optional[str] = None
    tags: List[str]
    created_at: str

class TaskActivityResponse(BaseModel):
    id: str
    task_id: str
    timestamp: str
    action: str
    actor: str
    changes: List[Any] = Field(default_factory=list)
    version: int

class GenerateRequest(BaseModel):
    pass
