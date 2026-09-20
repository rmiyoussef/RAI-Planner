from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class EmailTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    content: str = Field(default="", max_length=200000)


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    content: Optional[str] = Field(default=None, max_length=200000)


class EmailTemplateResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    content: str = ""
    type: str = "general"
    variables: List[str] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


class EmailTemplateVariable(BaseModel):
    name: str
    expression: str = ""
    syntax: str = ""
    raw: str = ""


class ProjectEmailTemplateMeta(BaseModel):
    id: str
    type: str = "project_backend"
    project_id: str
    project_name: str = ""
    name: str
    file_name: str
    relative_path: str
    framework: str = "laravel"
    module: Optional[str] = None
    variables: List[EmailTemplateVariable] = Field(default_factory=list)
    variables_count: int = 0
    updated_at: str = ""
    exists: bool = True


class ProjectEmailTemplateDetail(ProjectEmailTemplateMeta):
    content: str = ""


class ProjectEmailTemplateUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=500000)


class EmailPreviewRequest(BaseModel):
    content: str = Field(min_length=1, max_length=500000)
    kind: Literal["general", "blade"] = "general"


class EmailPreviewResponse(BaseModel):
    html: str
    mock: bool = True
