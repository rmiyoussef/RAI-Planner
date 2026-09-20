"""Email template discovery for backend projects. Filesystem is source of truth."""
import hashlib
import os
import pathlib
from datetime import datetime, timezone
from typing import List, Optional

from app.core.config import get_settings
from app.services.blade_parser import BladeEmailVariableExtractor

EMAIL_DIR = pathlib.PurePosixPath("resources/views/emails")


def _project_root(project_path: str) -> pathlib.Path:
    return pathlib.Path(project_path).expanduser().resolve()


def _within_root(root: pathlib.Path, target: pathlib.Path) -> bool:
    try:
        target.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False
    except Exception:
        return False


def stable_id(relative_path: str) -> str:
    return hashlib.sha1(relative_path.encode()).hexdigest()[:16]


def detect_laravel(project_path: str) -> bool:
    try:
        base = _project_root(project_path)
        if not base.is_dir():
            return False
        if (base / "artisan").exists():
            return True
        composer = base / "composer.json"
        if composer.is_file():
            try:
                text = composer.read_text(encoding="utf-8", errors="ignore")
                if "laravel/framework" in text:
                    return True
            except Exception:
                pass
        # fallback signals
        if (base / "app").is_dir() and (base / "resources").is_dir() and (base / "routes").is_dir():
            return True
        return False
    except Exception:
        return False


def _module_of(relative_path: str) -> Optional[str]:
    parts = pathlib.PurePosixPath(relative_path).parts
    # Modules/{module}/resources/views/emails/...
    if len(parts) >= 5 and parts[0] == "Modules" and parts[2] == "resources" and parts[3] == "views" and parts[4] == "emails":
        return parts[1]
    return None


def _pretty_name(file_name: str) -> str:
    base = file_name
    if base.endswith(".blade.php"):
        base = base[: -len(".blade.php")]
    elif base.endswith(".php"):
        base = base[: -len(".php")]
    return base.replace("-", " ").replace("_", " ").strip().title() or file_name


class EmailTemplateScanner:
    framework = "unknown"

    def scan(self, project_path: str) -> List[dict]:
        raise NotImplementedError


class LaravelEmailTemplateScanner(EmailTemplateScanner):
    framework = "laravel"

    def scan(self, project_path: str) -> List[dict]:
        base = _project_root(project_path)
        results: List[dict] = []
        candidates = [base / "resources" / "views" / "emails"]
        modules_dir = base / "Modules"
        if modules_dir.is_dir():
            try:
                for child in os.scandir(modules_dir):
                    if child.is_dir():
                        p = pathlib.Path(child.path) / "resources" / "views" / "emails"
                        candidates.append(p)
            except Exception:
                pass
        for root_dir in candidates:
            try:
                root_res = root_dir.resolve()
            except Exception:
                continue
            # ensure candidate stays inside project root
            if not _within_root(base, root_res) and root_res != base.resolve():
                # root_dir may not exist yet — check logical containment
                try:
                    root_dir.relative_to(base)
                except ValueError:
                    continue
            if not root_dir.is_dir():
                continue
            for dirpath, dirnames, filenames in os.walk(root_dir):
                dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "vendor", "__pycache__"} and not d.startswith(".")]
                for fn in filenames:
                    if not fn.endswith(".blade.php"):
                        continue
                    fp = pathlib.Path(dirpath) / fn
                    try:
                        rel = fp.resolve().relative_to(base.resolve())
                    except ValueError:
                        continue
                    rel_posix = rel.as_posix()
                    # only allow supported email directories
                    if not (rel_posix == "resources/views/emails" or rel_posix.startswith("resources/views/emails/") or "/resources/views/emails/" in rel_posix):
                        # ensure it came from one of the candidates
                        continue
                    try:
                        stat = fp.stat()
                        updated = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                    except Exception:
                        updated = ""
                    try:
                        content = fp.read_text(encoding="utf-8", errors="ignore")[:200000]
                    except Exception:
                        content = ""
                    variables = BladeEmailVariableExtractor.extract(content)
                    results.append({
                        "id": stable_id(rel_posix),
                        "type": "project_backend",
                        "name": _pretty_name(fn),
                        "file_name": fn,
                        "relative_path": rel_posix,
                        "framework": "laravel",
                        "module": _module_of(rel_posix),
                        "variables": variables,
                        "variables_count": len(variables),
                        "updated_at": updated,
                        "exists": True,
                    })
        # stable order
        results.sort(key=lambda d: d["relative_path"])
        return results


def get_scanner(framework: str) -> Optional[EmailTemplateScanner]:
    if framework == "laravel":
        return LaravelEmailTemplateScanner()
    return None


def read_project_template(project_path: str, relative_path: str) -> dict:
    """Validate + read current file. Returns {ok, ...}."""
    rel = (relative_path or "").strip().lstrip("/")
    if not rel or ".." in pathlib.PurePosixPath(rel).parts or pathlib.Path(rel).is_absolute():
        return {"ok": False, "error": "The requested template path is invalid."}
    # only supported email dirs
    if not (rel == "resources/views/emails" or rel.startswith("resources/views/emails/") or rel.startswith("Modules/") and "/resources/views/emails/" in rel):
        return {"ok": False, "error": "The requested template path is invalid."}
    base = _project_root(project_path)
    # PROJECTS_ROOT sandbox
    root_setting = get_settings().PROJECTS_ROOT
    if root_setting:
        try:
            pathlib.Path(base).relative_to(pathlib.Path(root_setting).expanduser().resolve())
        except ValueError:
            return {"ok": False, "error": "Project path is outside the allowed projects root"}
    target = (base / rel)
    try:
        target_res = target.resolve()
        base_res = base.resolve()
        target_res.relative_to(base_res)
    except ValueError:
        return {"ok": False, "error": "The requested template path is invalid."}
    except Exception as e:
        return {"ok": False, "error": str(e)}
    if target_res.is_symlink():
        # resolve already; ensure still inside
        try:
            target_res.relative_to(base_res)
        except ValueError:
            return {"ok": False, "error": "The requested template path is invalid."}
    if not target_res.exists() or not target_res.is_file():
        return {"ok": False, "error": "This email template no longer exists in the project."}
    if target_res.suffixes[-2:] == [".blade", ".php"] or target_res.name.endswith(".blade.php"):
        pass
    else:
        return {"ok": False, "error": "The requested template path is invalid."}
    try:
        size = target_res.stat().st_size
        if size > 1_000_000:
            return {"ok": False, "error": "File too large"}
        content = target_res.read_text(encoding="utf-8", errors="ignore")
        if len(content) > 500000:
            content = content[:500000]
        variables = BladeEmailVariableExtractor.extract(content)
        try:
            updated = datetime.fromtimestamp(target_res.stat().st_mtime, tz=timezone.utc).isoformat()
        except Exception:
            updated = ""
        return {
            "ok": True,
            "content": content,
            "variables": variables,
            "relative_path": rel,
            "file_name": target_res.name,
            "module": _module_of(rel),
            "updated_at": updated,
        }
    except Exception:
        return {"ok": False, "error": "Unable to save the project email template.\nThe source file could not be updated."}


def write_project_template(project_path: str, relative_path: str, content: str) -> dict:
    """Validate + write file, then re-read. Returns {ok, ...}."""
    read = read_project_template(project_path, relative_path)
    if not read.get("ok"):
        # map read errors to write failure where appropriate
        err = read.get("error", "")
        if "no longer exists" in err or "invalid" in err.lower():
            return read
        return {"ok": False, "error": "Unable to save the project email template.\nThe source file could not be updated."}
    base = _project_root(project_path)
    target = (base / read["relative_path"]).resolve()
    try:
        target.write_text(content, encoding="utf-8")
    except Exception:
        return {"ok": False, "error": "Unable to save the project email template.\nThe source file could not be updated."}
    return read_project_template(project_path, relative_path)
