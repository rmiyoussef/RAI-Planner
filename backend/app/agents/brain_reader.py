from app.services.filesystem import brain_status, collect_project_context

class BrainReader:
    def status(self, project_path: str):
        return brain_status(project_path)
    def context(self, project_path: str):
        return collect_project_context(project_path)
