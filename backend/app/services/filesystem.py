import os
import pathlib
from typing import Dict, Any, List, Tuple

from app.core.config import get_settings

SENSITIVE_NAMES = {".env", ".env.local", ".env.development", ".env.production"}
SENSITIVE_EXTS = {".pem", ".key", ".p12", ".pfx"}
IGNORED_DIRS = {"node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build", ".next", ".turbo", "cache", ".cache", "vendor", "target", "coverage", "tmp", "logs", ".pytest_cache", ".mypy_cache"}
BINARY_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".bin", ".woff", ".woff2", ".mp4", ".mp3"}
MAX_FILE_SIZE = 1_000_000
MAX_CONTEXT_CHARS = 200_000


def _within_projects_root(p: pathlib.Path) -> Tuple[bool, str]:
    """Enforce the optional PROJECTS_ROOT sandbox (defense-in-depth on every read)."""
    root = get_settings().PROJECTS_ROOT
    if not root:
        return True, ""
    try:
        root_res = pathlib.Path(root).expanduser().resolve()
        p.relative_to(root_res)
        return True, ""
    except ValueError:
        return False, f"Project path is outside the allowed projects root ({root})"
    except Exception as e:
        return False, str(e)


def validate_project_path(project_path: str) -> Tuple[bool, str]:
    if not project_path:
        return False, "Project path is empty"
    try:
        p = pathlib.Path(project_path).expanduser().resolve()
        ok, err = _within_projects_root(p)
        if not ok:
            return False, err
        if not p.exists():
            return False, "Project path does not exist"
        if not p.is_dir():
            return False, "Project path is not a directory"
        return True, str(p)
    except Exception as e:
        return False, str(e)

def is_safe_path(base: pathlib.Path, target: pathlib.Path) -> bool:
    try:
        base_res = base.resolve()
        target_res = target.resolve()
        return str(target_res).startswith(str(base_res))
    except Exception:
        return False

def brain_status(project_path: str) -> Dict[str, Any]:
    p = pathlib.Path(project_path)
    ok, err = _within_projects_root(p)
    if not ok:
        return {"exists": False, "path": str(p), "error": err, "message": err}
    brain = p / ".brain"
    exists = brain.exists() and brain.is_dir()
    info = {"exists": exists, "path": str(brain)}
    if exists:
        try:
            files = []
            for root, dirs, filenames in os.walk(brain):
                # avoid excessive depth
                dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
                for f in filenames[:50]:
                    fp = pathlib.Path(root) / f
                    rel = fp.relative_to(brain)
                    files.append(str(rel))
                    if len(files) > 100:
                        break
                if len(files) > 100:
                    break
            info["files"] = files[:100]
            info["file_count"] = len(files)
        except Exception as e:
            info["error"] = str(e)
    else:
        info["message"] = "the ai tool need to instal on this project"
    return info

def read_brain_file(project_path: str, rel_path: str) -> Dict[str, Any]:
    """Safely read a single file from .brain and return its content. Validates path traversal and file type."""
    if not rel_path or rel_path.strip() == "":
        return {"ok": False, "error": "File path is required"}
    # normalize rel_path - prevent absolute and traversal
    rel_path = rel_path.strip().lstrip("/")
    if ".." in pathlib.Path(rel_path).parts:
        return {"ok": False, "error": "Invalid file path"}
    p = pathlib.Path(project_path)
    ok, err = _within_projects_root(p)
    if not ok:
        return {"ok": False, "error": err}
    brain = (p / ".brain").resolve()
    if not brain.exists() or not brain.is_dir():
        return {"ok": False, "error": "No .brain directory found"}
    # resolve target and ensure it stays inside brain
    target = (brain / rel_path).resolve()
    try:
        target.relative_to(brain)
    except ValueError:
        return {"ok": False, "error": "Access denied — path outside .brain"}
    if not target.exists() or not target.is_file():
        return {"ok": False, "error": "File not found"}
    # skip sensitive, binary, large
    if target.name in SENSITIVE_NAMES:
        return {"ok": False, "error": "Access to this file is restricted"}
    if target.suffix.lower() in BINARY_EXTS or target.suffix.lower() in SENSITIVE_EXTS:
        return {"ok": False, "error": "Binary file cannot be previewed"}
    try:
        size = target.stat().st_size
        if size > MAX_FILE_SIZE:
            return {"ok": False, "error": f"File too large ({size} bytes, limit {MAX_FILE_SIZE})"}
        content = target.read_text(encoding="utf-8", errors="ignore")
        # limit content length
        if len(content) > MAX_CONTEXT_CHARS:
            content = content[:MAX_CONTEXT_CHARS] + "\n\n— truncated —"
        return {"ok": True, "path": str(rel_path), "content": content, "size": size}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def collect_project_context(project_path: str, max_bytes: int = 200_000) -> Dict[str, Any]:
    """Build concise project context respecting limits and safety."""
    base = pathlib.Path(project_path).resolve()
    ok, err = _within_projects_root(base)
    if not ok:
        return {
            "project_path": str(base),
            "top_level": [],
            "structure_sample": [],
            "brain_content": "",
            "brain_exists": False,
            "truncated": False,
            "error": err,
        }
    context_parts = []
    total_chars = 0
    tree = []
    brain_content = ""

    # top-level listing
    try:
        entries = os.listdir(base)
        for e in entries:
            if e in IGNORED_DIRS:
                continue
            if e in SENSITIVE_NAMES or e.startswith(".env"):
                continue
            fp = base / e
            if fp.is_dir():
                tree.append(f"{e}/")
            else:
                tree.append(e)
        tree = sorted(tree)[:100]
    except Exception:
        tree = []

    # brain reading
    brain = base / ".brain"
    if brain.exists() and brain.is_dir():
        try:
            for root, dirs, files in os.walk(brain):
                dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
                # limit depth
                rel_root = pathlib.Path(root).relative_to(brain)
                if len(rel_root.parts) > 4:
                    dirs[:] = []
                    continue
                for fname in files:
                    if fname in SENSITIVE_NAMES:
                        continue
                    fpath = pathlib.Path(root) / fname
                    # skip large, binary
                    try:
                        if fpath.suffix.lower() in BINARY_EXTS:
                            continue
                        size = fpath.stat().st_size
                        if size > MAX_FILE_SIZE:
                            continue
                        if total_chars > max_bytes:
                            break
                        text = fpath.read_text(encoding="utf-8", errors="ignore")[:5000]
                        rel = fpath.relative_to(brain)
                        chunk = f"\n# .brain/{rel}\n{text}\n"
                        if total_chars + len(chunk) > max_bytes:
                            chunk = chunk[: max_bytes - total_chars]
                        brain_content += chunk
                        total_chars += len(chunk)
                    except Exception:
                        continue
                if total_chars > max_bytes:
                    break
        except Exception:
            pass

    # lightweight repo structure scan (top 2 levels)
    structure = []
    try:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".brain")]
            rel = pathlib.Path(root).relative_to(base)
            depth = len(rel.parts)
            if depth > 2:
                dirs[:] = []
                continue
            # limit files per dir
            for f in files[:20]:
                if f in SENSITIVE_NAMES or f.startswith(".env") or pathlib.Path(f).suffix.lower() in BINARY_EXTS or pathlib.Path(f).suffix.lower() in SENSITIVE_EXTS:
                    continue
                fp = pathlib.Path(root) / f
                try:
                    if fp.stat().st_size > MAX_FILE_SIZE:
                        continue
                except Exception:
                    continue
                structure.append(str((rel / f)) if str(rel) != "." else f)
            if len(structure) > 200:
                break
    except Exception:
        pass

    return {
        "project_path": str(base),
        "top_level": tree,
        "structure_sample": structure[:200],
        "brain_content": brain_content[:max_bytes],
        "brain_exists": (base / ".brain").exists(),
        "truncated": total_chars >= max_bytes
    }


def _read_small(path: pathlib.Path, limit: int = 20000) -> str:
    """Read a small manifest/config file safely (never secrets)."""
    try:
        if not path.is_file() or path.stat().st_size > MAX_FILE_SIZE:
            return ""
        if path.name in SENSITIVE_NAMES or path.suffix.lower() in SENSITIVE_EXTS | BINARY_EXTS:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")[:limit]
    except Exception:
        return ""


def _has(base: pathlib.Path, *rel: str) -> bool:
    try:
        p = base.joinpath(*rel)
        return p.exists()
    except Exception:
        return False


def _any_dir(base: pathlib.Path, names: List[str]) -> List[str]:
    found = []
    try:
        top = {e.name for e in os.scandir(base) if e.is_dir()}
    except Exception:
        return found
    for n in names:
        if n in top:
            found.append(n)
    return found


def analyze_project(project_path: str) -> Dict[str, Any]:
    """Targeted static analysis: framework, architecture, APIs, tests, docs.

    Bounded (manifests + directory names only, small reads, no secrets) and
    read-only — never modifies the project. Code is the authority; output
    marks anything unverifiable as such for the agent to verify.
    """
    base = pathlib.Path(project_path).resolve()
    analysis: Dict[str, Any] = {
        "framework": "Unknown",
        "language": "Unknown",
        "frontend": None,
        "database": None,
        "architecture": None,
        "api_style": None,
        "authentication": None,
        "testing": None,
        "has_brain": (base / ".brain").is_dir(),
        "has_api_documentation": False,
        "conventions": [],
        "important_paths": [],
        "existing_patterns": [],
    }
    important: List[str] = []

    def note(path: str):
        if len(important) < 40 and path not in important:
            important.append(path)

    # ---- manifests (small, capped reads) ----
    composer = _read_small(base / "composer.json")
    package = _read_small(base / "package.json")
    requirements = "\n".join(
        _read_small(base / f) for f in ("requirements.txt", "pyproject.toml", "setup.py", "Pipfile")
    )
    gomod = _read_small(base / "go.mod")
    gemfile = _read_small(base / "Gemfile")
    cargo = _read_small(base / "Cargo.toml")
    has_pom = _has(base, "pom.xml")
    has_gradle = _has(base, "build.gradle") or _has(base, "build.gradle.kts")
    has_csproj = any(str(p).endswith(".csproj") or str(p).endswith(".sln") for p in _top_files(base))

    pkg_deps = ""
    if package:
        try:
            import json as _json
            pkg = _json.loads(package)
            deps = list((pkg.get("dependencies") or {}).keys()) + list((pkg.get("devDependencies") or {}).keys())
            pkg_deps = " ".join(deps)
        except Exception:
            pkg_deps = package[:2000]

    # ---- framework / language ----
    if composer and "laravel/framework" in composer:
        analysis["framework"], analysis["language"] = "Laravel", "PHP"
        note("composer.json")
        for p in ("routes/api.php", "routes/web.php", "app/Http/Controllers", "app/Models"):
            if _has(base, *p.split("/")):
                note(p)
    elif "next" in pkg_deps.split() or _has(base, "next.config.js") or _has(base, "next.config.mjs"):
        analysis["framework"], analysis["language"] = "Next.js", "TypeScript/JavaScript"
        note("package.json")
    elif "@nestjs/core" in pkg_deps:
        analysis["framework"], analysis["language"] = "NestJS", "TypeScript"
        note("package.json")
    elif "react" in pkg_deps.split():
        analysis["framework"], analysis["language"] = "React", "TypeScript/JavaScript"
        note("package.json")
    elif "vue" in pkg_deps.split():
        analysis["framework"], analysis["language"] = "Vue", "TypeScript/JavaScript"
        note("package.json")
    elif any(k in pkg_deps for k in ("express", "fastify", "koa", "hapi", "@hono/node-server")):
        analysis["framework"], analysis["language"] = "Node.js", "TypeScript/JavaScript"
        note("package.json")
    elif package.strip():
        analysis["framework"], analysis["language"] = "Node.js", "TypeScript/JavaScript"
        note("package.json")
    elif "fastapi" in requirements.lower():
        analysis["framework"], analysis["language"] = "FastAPI", "Python"
        for p in ("requirements.txt", "pyproject.toml"):
            if _has(base, p):
                note(p)
    elif "django" in requirements.lower():
        analysis["framework"], analysis["language"] = "Django", "Python"
        note("requirements.txt")
    elif "flask" in requirements.lower():
        analysis["framework"], analysis["language"] = "Flask", "Python"
        note("requirements.txt")
    elif requirements.strip():
        analysis["framework"], analysis["language"] = "Python", "Python"
    elif gomod:
        analysis["framework"], analysis["language"] = "Go", "Go"
        note("go.mod")
    elif "rails" in gemfile.lower():
        analysis["framework"], analysis["language"] = "Ruby on Rails", "Ruby"
        note("Gemfile")
    elif cargo:
        analysis["framework"], analysis["language"] = "Rust", "Rust"
        note("Cargo.toml")
    elif has_pom or has_gradle:
        analysis["framework"], analysis["language"] = "Java (Maven/Gradle)", "Java"
        note("pom.xml" if has_pom else "build.gradle")
    elif has_csproj:
        analysis["framework"], analysis["language"] = ".NET", "C#"

    # ---- frontend companion ----
    if analysis["framework"] in ("Laravel", "Django", "Flask", "FastAPI", "Ruby on Rails"):
        for fe, marker in (("React", "src/App.jsx"), ("Vue", "src/App.vue")):
            if _has(base, *marker.split("/")) or _has(base, "frontend", "package.json"):
                analysis["frontend"] = fe
                break

    # ---- API style ----
    api_hits = []
    if _has(base, "routes", "api.php") or _any_dir(base, ["routers", "routes", "controllers", "api", "app"]):
        api_hits.append("REST")
    protos = _find_by_suffix(base, (".proto",), limit=3)
    gql = _find_by_suffix(base, (".graphql", ".gql"), limit=3) or _has(base, "schema.graphql")
    openapi = _find_by_name(base, ("openapi.yaml", "openapi.yml", "openapi.json", "swagger.yaml", "swagger.json"), limit=3)
    if protos:
        api_hits.append("gRPC")
        note(protos[0])
    if gql:
        api_hits.append("GraphQL")
    if openapi:
        api_hits.append("OpenAPI-documented")
        analysis["has_api_documentation"] = True
        note(openapi[0])
    if api_hits:
        analysis["api_style"] = "+".join(dict.fromkeys(api_hits))

    # ---- architecture patterns ----
    patterns = []
    svc = _any_dir(base, ["Services", "services", "src"])
    if _has(base, "app", "Services") or _has(base, "src", "services") or _has(base, "services"):
        patterns.append("Service layer")
    if _has(base, "app", "Repositories") or _has(base, "src", "repositories") or _has(base, "repositories"):
        patterns.append("Repository pattern")
    if _has(base, "app", "Http", "Requests") or _has(base, "src", "schemas") or _has(base, "schemas"):
        patterns.append("Request/schema validation layer")
    if _has(base, "app", "Http", "Middleware") or _has(base, "src", "middleware") or _has(base, "middleware"):
        patterns.append("Middleware pipeline")
    if _has(base, "database", "migrations") or _has(base, "migrations") or _has(base, "alembic") or _has(base, "prisma"):
        patterns.append("Versioned migrations")
    if svc:
        for p in ("src/routers", "src/controllers", "app/Http/Controllers", "src/models", "app/Models"):
            if _has(base, *p.split("/")):
                note(p)
    if patterns:
        analysis["architecture"] = "; ".join(patterns)
    analysis["existing_patterns"] = patterns

    # ---- database ----
    db = None
    if _has(base, "prisma", "schema.prisma"):
        db, note_p = "Prisma-managed", "prisma/schema.prisma"
    elif _has(base, "config", "database.php"):
        db, note_p = "Laravel database config", "config/database.php"
    elif _has(base, "alembic.ini") or _has(base, "alembic"):
        db, note_p = "SQLAlchemy/Alembic", "alembic.ini"
    elif "sqlalchemy" in requirements.lower() or "psycopg" in requirements.lower() or "asyncpg" in requirements.lower():
        db, note_p = "Python SQL", "requirements.txt"
    elif "mongoose" in pkg_deps or "typeorm" in pkg_deps or "sequelize" in pkg_deps or "knex" in pkg_deps:
        db, note_p = "Node ORM/query builder", "package.json"
    elif "pg" in pkg_deps.split() or "postgres" in (composer + requirements).lower():
        db, note_p = "PostgreSQL", None
    if db:
        analysis["database"] = db
        if note_p:
            note(note_p)

    # ---- authentication ----
    auth = None
    hay = (composer + "\n" + pkg_deps + "\n" + requirements).lower()
    if "sanctum" in hay:
        auth = "Laravel Sanctum"
    elif "passport" in hay:
        auth = "OAuth (Passport)"
    elif "tymon/jwt-auth" in hay or "simplejwt" in hay or "flask-jwt" in hay or "python-jose" in hay:
        auth = "JWT"
    elif "next-auth" in hay or "@auth/" in hay:
        auth = "Auth.js/NextAuth"
    elif "@nestjs/jwt" in hay or "@nestjs/passport" in hay:
        auth = "NestJS JWT/Passport"
    elif "devise" in hay:
        auth = "Devise"
    if auth:
        analysis["authentication"] = auth

    # ---- testing ----
    tests = []
    if _any_dir(base, ["tests", "test", "spec", "__tests__", "e2e"]):
        tests.append("dedicated test directory")
    if _has(base, "phpunit.xml") or _has(base, "phpunit.xml.dist") or _has(base, "tests", "Pest.php"):
        tests.append("PHPUnit/Pest")
    if _has(base, "pytest.ini") or _has(base, "setup.cfg") or "pytest" in requirements.lower():
        tests.append("pytest")
    if any(_has(base, f) for f in ("jest.config.js", "jest.config.ts", "vitest.config.ts", "vitest.config.js")) or "vitest" in pkg_deps or "jest" in pkg_deps.split():
        tests.append("Jest/Vitest")
    if _find_by_suffix(base, (".test.go",), limit=1, depth=2):
        tests.append("Go testing")
    if _has(base, "src", "test") or _has(base, "src/test"):
        tests.append("JVM tests")
    if _has(base, "spec", "rails_helper.rb") or "rspec" in gemfile.lower():
        tests.append("RSpec")
    if tests:
        analysis["testing"] = "+".join(dict.fromkeys(tests))

    # ---- docs ----
    for d in ("README.md", "CONTRIBUTING.md", "docs", "openapi.yaml"):
        if _has(base, d):
            note(d)

    # ---- conventions ----
    conv = []
    try:
        top_dirs = [e.name for e in os.scandir(base) if e.is_dir() and e.name not in IGNORED_DIRS and not e.name.startswith(".")]
    except Exception:
        top_dirs = []
    if top_dirs:
        conv.append(f"top-level modules: {', '.join(sorted(top_dirs)[:12])}")
    if _has(base, ".brain"):
        conv.append(".brain engineering knowledge present")
    analysis["conventions"] = conv
    analysis["important_paths"] = important
    return analysis


def _top_files(base: pathlib.Path) -> List[str]:
    try:
        return [e.name for e in os.scandir(base) if e.is_file()][:60]
    except Exception:
        return []


def _find_by_suffix(base: pathlib.Path, suffixes: tuple, limit: int = 5, depth: int = 2) -> List[str]:
    found: List[str] = []
    try:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            rel = pathlib.Path(root).relative_to(base)
            if len(rel.parts) > depth:
                dirs[:] = []
                continue
            for f in files:
                if f.lower().endswith(suffixes):
                    found.append(str((rel / f)) if str(rel) != "." else f)
                    if len(found) >= limit:
                        return found
    except Exception:
        pass
    return found


def _find_by_name(base: pathlib.Path, names: tuple, limit: int = 5) -> List[str]:
    found: List[str] = []
    try:
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            rel = pathlib.Path(root).relative_to(base)
            if len(rel.parts) > depth_limit():
                dirs[:] = []
                continue
            for f in files:
                if f in names:
                    found.append(str((rel / f)) if str(rel) != "." else f)
                    if len(found) >= limit:
                        return found
    except Exception:
        pass
    return found


def depth_limit() -> int:
    return 2

