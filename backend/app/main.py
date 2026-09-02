import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.core.database import init_db
from app.api.routes import auth, projects, tasks, users, dashboard, agent
from app.api.routes import settings as settings_routes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if not settings.PROJECTS_ROOT:
        logger.warning(
            "PROJECTS_ROOT is not set — projects may point to ANY directory on this machine. "
            "Set PROJECTS_ROOT in .env to sandbox project paths (recommended in production). See SECURITY.md."
        )
    if settings.ALLOW_SIGNUP:
        logger.info("Public signup is enabled (ALLOW_SIGNUP=true). Set ALLOW_SIGNUP=false to disable registration.")
    logger.info("RAI Planner backend started")
    yield

settings = get_settings()
app = FastAPI(title="RAI Planner API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
for r in [auth.router, projects.router, tasks.router, users.router, dashboard.router, settings_routes.router, agent.router]:
    app.include_router(r, prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {"message": "RAI Planner API", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get(f"{settings.API_PREFIX}/health")
async def api_health():
    return {"status": "ok"}
