from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    MONGODB_URI: str = ""
    MONGODB_DATABASE: str = "rai_planner"
    JWT_SECRET: str = "change-me-in-production-please-use-long-random"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    API_PREFIX: str = "/api"
    PROJECT_NAME: str = "RAI Planner"
    MAX_FILE_SIZE_BYTES: int = 1024 * 1024  # 1MB per file
    MAX_CONTEXT_BYTES: int = 200_000
    ENCRYPTION_KEY: str = ""  # if empty, will derive from JWT_SECRET
    # Security hardening (recommended in production — see SECURITY.md)
    # If set, project_path must resolve inside this directory (filesystem sandbox)
    PROJECTS_ROOT: str = ""
    # Set to false to disable public registration after the first account(s) exist
    ALLOW_SIGNUP: bool = True

    class Config:
        # backend/.env when running from backend/, root .env when set at repo root
        env_file = (".env", "../.env")
        extra = "allow"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
