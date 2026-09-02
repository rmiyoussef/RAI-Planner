from pydantic import BaseModel
from typing import List, Dict, Any

class DashboardResponse(BaseModel):
    projects_total: int
    projects_active: int
    projects_disabled: int
    tasks_total: int
    tasks_by_status: Dict[str, int]
    tasks_by_priority: Dict[str, int]
    projects_created_over_time: List[Dict[str, Any]]
    tasks_created_over_time: List[Dict[str, Any]]
    tasks_completed_over_time: List[Dict[str, Any]]
