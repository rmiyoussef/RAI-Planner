import os
import pathlib
from typing import Dict, Any, List, Tuple

SENSITIVE_NAMES = {".env", ".env.local", ".env.development", ".env.production"}
SENSITIVE_EXTS = {".pem", ".key", ".p12", ".pfx"}
IGNORED_DIRS = {"node_modules", ".git", ".venv", "venv", "__pycache__", "dist", "build", ".next", ".turbo", "cache", ".cache"}
BINARY_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".bin", ".woff", ".woff2", ".mp4", ".mp3"}
MAX_FILE_SIZE = 1_000_000
MAX_CONTEXT_CHARS = 200_000

def validate_project_path(project_path: str) -> Tuple[bool, str]:
    if not project_path:
        return False, "Project path is empty"
    # Prevent traversal that escapes? Allow absolute paths, but normalize.
    try:
        p = pathlib.Path(project_path).resolve()
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

def collect_project_context(project_path: str, max_bytes: int = 200_000) -> Dict[str, Any]:
    """Build concise project context respecting limits and safety."""
    base = pathlib.Path(project_path).resolve()
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
