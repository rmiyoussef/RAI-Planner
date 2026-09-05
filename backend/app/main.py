import logging
import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.core.database import init_db
from app.api.routes import auth, projects, tasks, users, dashboard, agent
from app.api.routes import settings as settings_routes
from app.api.routes import project_policy

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
    logger.info(f"{settings.PROJECT_NAME} backend started")
    yield

settings = get_settings()
# Harden CORS: if wildcard in origins, disallow credentials
_cors_origins = settings.cors_origins_list
_cors_allow_credentials = True
if any(o == "*" or o == "/*" for o in _cors_origins):
    _cors_allow_credentials = False
    _cors_origins = ["*"]

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.API_PREFIX.startswith("/api") else "/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json" if settings.API_PREFIX else "/openapi.json",
)

# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    start = time.time()
    response: Response = await call_next(request)
    # No sniff, no frame, XSS, HSTS, CSP, referrer, permissions
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # CSP: lock down to self, allow inline for Swagger, allow images data:
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "font-src 'self' https://cdn.jsdelivr.net; "
        "frame-ancestors 'none'"
    )
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    # Request ID for tracing without leaking internals
    response.headers["X-Request-ID"] = request.headers.get("X-Request-ID", "") or str(int(start * 1000))
    # No cache for API
    if request.url.path.startswith(settings.API_PREFIX):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response

# Generic error handler to avoid leaking stack traces
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    max_age=600,
)

# include routers
for r in [auth.router, projects.router, project_policy.router, tasks.router, users.router, dashboard.router, settings_routes.router, agent.router]:
    app.include_router(r, prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {"message": f"{settings.PROJECT_NAME} API", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get(f"{settings.API_PREFIX}/health")
async def api_health():
    return {"status": "ok"}
