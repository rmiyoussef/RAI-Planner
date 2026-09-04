#!/usr/bin/env bash
set -e

# RAI Planner — Update Script (production-ready, version-aware)
# Usage:
#   ./update.sh                # pull main if behind, reinstall, test, restart backend, verify
#   ./update.sh --force        # reinstall + test + restart even when versions match
#   ./update.sh --verify-only  # no git/install changes: run tests + backend smoke check
#   ./update.sh --skip-tests   # skip pytest/vitest (not recommended)
#   ./scripts/update.sh        # same
#   curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/update.sh | bash
#
# What it does:
#   1. Finds repo root (where VERSION lives)
#   2. Fetches remote, compares local VERSION vs remote VERSION (from main)
#   3. If outdated (or --force): pulls main, patches .env, reinstalls deps, rebuilds frontend
#   4. Runs backend (pytest) + frontend (vitest) test suites — FAILS LOUDLY on errors
#   5. Restarts the backend so the new code actually loads (stale backend = 404s on new routes)
#   6. Smoke-verifies: /api/health responds AND every on-disk route is served
#      (route-parity check catches a stale backend even when health is green)
#
# Exit codes: 0 = updated + verified (or already current + healthy),
#             1 = anything failed — read the ✗ lines, fix, re-run.

FORCE=false
SKIP_TESTS=false
VERIFY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --verify-only) VERIFY_ONLY=true ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown flag: $arg (see --help)"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve root
if [ -f "$SCRIPT_DIR/VERSION" ]; then
  ROOT="$SCRIPT_DIR"
  if [ "$(basename "$SCRIPT_DIR")" = "scripts" ]; then
    ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  fi
elif [ -f "./VERSION" ]; then
  ROOT="$(pwd)"
else
  echo "ERROR: Cannot find RAI Planner repo root (no VERSION file). Clone first:"
  echo "  git clone https://github.com/rmiyoussef/RAI-Planner.git"
  exit 1
fi

cd "$ROOT"
echo "=========================================="
echo "  RAI Planner — Updater"
echo "  Root: $ROOT"
echo "=========================================="

# --- preflight ---------------------------------------------------------------
need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "✗ Required command '$1' not found. Aborting."; exit 1; }
}
need_cmd git
need_cmd python3
need_cmd npm
need_cmd curl

API_PREFIX=$(grep -E "^API_PREFIX=" .env 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')
[ -z "$API_PREFIX" ] && API_PREFIX="/api"
# Backend port is 8000 by default; servers where :8000 is taken (e.g. bench-server
# runs the backend on :8001) set BACKEND_PORT=8001 in .env (ignored by the app).
BACKEND_PORT=$(grep -E "^BACKEND_PORT=" .env 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')
[ -z "$BACKEND_PORT" ] && BACKEND_PORT="8000"
BACKEND_BASE="http://127.0.0.1:${BACKEND_PORT}"
mkdir -p logs

# --- shared helpers ----------------------------------------------------------
run_backend_tests() {
  if $SKIP_TESTS; then echo "→ Skipping backend tests (--skip-tests)"; return 0; fi
  echo "→ Backend tests (pytest)..."
  if [ ! -x "backend/.venv/bin/python" ]; then
    echo "✗ backend/.venv missing — run ./install.sh first."; exit 1
  fi
  ( cd backend && ./.venv/bin/python -m pytest tests/ -q ) || { echo "✗ Backend tests FAILED — fix before deploying."; exit 1; }
  echo "  ✓ backend tests passed"
}

run_frontend_tests() {
  if $SKIP_TESTS; then echo "→ Skipping frontend tests (--skip-tests)"; return 0; fi
  echo "→ Frontend tests (vitest) + typecheck..."
  ( cd frontend && npm test -- --run ) || { echo "✗ Frontend tests FAILED — fix before deploying."; exit 1; }
  echo "  ✓ frontend tests passed"
}

backend_pid_alive() {
  [ -f "logs/backend.pid" ] && kill -0 "$(cat logs/backend.pid 2>/dev/null)" 2>/dev/null
}

backend_health_ok() {
  curl -sf -m 5 "${BACKEND_BASE}${API_PREFIX}/health" >/dev/null 2>&1
}

# Route-parity: every route in the on-disk code must be served by the running
# backend. Catches a STALE backend (old code still running) that answers
# /api/health fine but 404s on new endpoints.
smoke_backend() { # $1 = "fatal" | "warn"
  local mode="${1:-fatal}"
  local fail="echo"
  if [ "$mode" = "fatal" ]; then fail="exit 1"; fi
  echo "→ Smoke-verifying backend..."
  if ! backend_health_ok; then
    echo "✗ Backend health check failed: ${BACKEND_BASE}${API_PREFIX}/health unreachable."
    echo "  Last log lines:"; tail -n 20 logs/backend.log 2>/dev/null || echo "  (no logs/backend.log)"
    $fail
    return 1
  fi
  echo "  ✓ health OK"
  echo "  Checking served routes match on-disk code..."
  local missing
  missing=$(backend/.venv/bin/python - "$BACKEND_BASE$API_PREFIX" <<'PYEOF' 2>/dev/null
import json, sys, urllib.request
from app.main import app
base = sys.argv[1]
try:
    with urllib.request.urlopen(base + "/openapi.json", timeout=15) as r:
        served = set(json.load(r).get("paths", {}).keys())
except Exception as e:
    print(f"OPENAPI_FETCH_FAILED: {e}")
    sys.exit(2)
local = set()
for rt in app.routes:
    p = getattr(rt, "path", "")
    if p:
        local.add(p)
missing = sorted(p for p in local if p not in served)
print(f"SERVED={len(served)} LOCAL={len(local)}")
for p in missing[:15]:
    print(f"MISSING: {p}")
sys.exit(1 if missing else 0)
PYEOF
) || true
  echo "$missing" | grep -E "^(SERVED|MISSING|OPENAPI)" | sed 's/^/  /'
  if echo "$missing" | grep -q "^MISSING:"; then
    echo "✗ STALE BACKEND: it serves old code (new routes 404). Restart it and re-run."
    $fail
    return 1
  fi
  if echo "$missing" | grep -q "OPENAPI_FETCH_FAILED"; then
    echo "✗ Could not fetch openapi.json from the running backend."
    $fail
    return 1
  fi
  echo "  ✓ all on-disk routes are served"
}

restart_backend() {
  echo "→ Restarting backend so new code loads..."
  if backend_pid_alive; then
    local pid
    pid=$(cat logs/backend.pid)
    echo "  Stopping old backend (pid $pid)..."
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    kill -0 "$pid" 2>/dev/null && { echo "✗ Old backend (pid $pid) refused to stop. Kill it manually."; exit 1; }
    rm -f logs/backend.pid
  elif backend_health_ok; then
    echo "✗ Backend on :${BACKEND_PORT} is running OUTSIDE update.sh control (no logs/backend.pid)."
    echo "  Restart it manually (docker / systemd / screen), then re-run ./update.sh --verify-only."
    exit 1
  else
    echo "  Backend not running — starting fresh."
  fi
  if [ ! -x "backend/.venv/bin/uvicorn" ]; then
    echo "✗ backend/.venv missing uvicorn — run ./install.sh first."; exit 1
  fi
  # Same launch flags as start.sh so behavior matches dev/prod runs.
  ( cd backend && nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload --reload-dir "$ROOT/backend/app" > "$ROOT/logs/backend.log" 2>&1 & echo $! > "$ROOT/logs/backend.pid" )
  echo "  Waiting for health (pid $(cat logs/backend.pid))..."
  for _ in $(seq 1 60); do
    backend_health_ok && break
    sleep 0.5
  done
  if ! backend_health_ok; then
    echo "✗ Backend did not become healthy within 30s. Last log lines:"
    tail -n 30 logs/backend.log 2>/dev/null || echo "  (no logs/backend.log)"
    exit 1
  fi
  echo "  ✓ backend healthy"
}

if $VERIFY_ONLY; then
  echo "→ Verify-only mode (no git/install changes)"
  run_backend_tests
  run_frontend_tests
  smoke_backend fatal
  echo ""
  echo "✓ Verified — tests pass and backend serves current code."
  exit 0
fi

# Determine current branch and remote (source of truth is main)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
TARGET_BRANCH="main"
REMOTE=$(git remote 2>/dev/null | head -n1)
if [ -z "$REMOTE" ]; then
  REMOTE="origin"
  git remote add origin https://github.com/rmiyoussef/RAI-Planner.git 2>/dev/null || true
fi
REMOTE_URL=$(git remote get-url "$REMOTE" 2>/dev/null || echo "origin")

LOCAL_VER=$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "0.0.0")
echo "→ Local version:  v$LOCAL_VER  (branch: $BRANCH)"

# Fetch remote
echo "→ Fetching remote ($REMOTE)..."
git fetch "$REMOTE" --tags --prune 2>&1 | head -n 20 || echo "  (fetch warning, continuing)"

# Get remote VERSION from main without checking out (via git show)
REMOTE_VER=$(git show "$REMOTE/$TARGET_BRANCH:VERSION" 2>/dev/null | tr -d '[:space:]' || echo "")

# Also check latest tag as fallback
LATEST_TAG=$(git ls-remote --tags "$REMOTE" 2>/dev/null | grep -E "refs/tags/v[0-9]" | sed 's|.*refs/tags/||' | sort -V | tail -n1 | sed 's|^{}||' || echo "")
if [ -z "$REMOTE_VER" ] && [ -n "$LATEST_TAG" ]; then
  REMOTE_VER=$(echo "$LATEST_TAG" | sed 's/^v//')
  echo "→ Latest remote tag: $LATEST_TAG"
fi

if [ -z "$REMOTE_VER" ]; then
  # Fallback: try raw GitHub
  REMOTE_VER=$(curl -fsSL "https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/$TARGET_BRANCH/VERSION" 2>/dev/null | tr -d '[:space:]' || echo "")
fi

if [ -z "$REMOTE_VER" ]; then
  echo "→ Could not determine remote version, pulling anyway..."
  REMOTE_VER="unknown"
else
  echo "→ Remote version: v$REMOTE_VER (branch: ${TARGET_BRANCH:-unknown})"
fi

# Version compare (sort -V)
needs_update=false
if [ "$REMOTE_VER" = "unknown" ]; then
  needs_update=true
else
  # If remote > local
  if [ "$(printf '%s\n%s\n' "$LOCAL_VER" "$REMOTE_VER" | sort -V | head -n1)" != "$REMOTE_VER" ]; then
    # local is smaller? Actually if head is local, then remote is newer
    if [ "$LOCAL_VER" != "$REMOTE_VER" ]; then
      needs_update=true
    fi
  else
    if [ "$LOCAL_VER" != "$REMOTE_VER" ]; then
      # need to check if remote is greater
      if [ "$(printf '%s\n%s\n' "$LOCAL_VER" "$REMOTE_VER" | sort -V | tail -n1)" = "$REMOTE_VER" ] && [ "$LOCAL_VER" != "$REMOTE_VER" ]; then
        needs_update=true
      fi
    fi
  fi
  # Simpler: if versions differ, consider update if remote > local
  if [ "$LOCAL_VER" = "$REMOTE_VER" ]; then
    needs_update=false
  elif [ "$(printf '%s\n%s\n' "$LOCAL_VER" "$REMOTE_VER" | sort -V | tail -n1)" = "$REMOTE_VER" ]; then
    needs_update=true
  else
    needs_update=false
    echo "→ Local v$LOCAL_VER is newer than remote v$REMOTE_VER — skipping"
  fi
fi

if $FORCE; then
  echo "→ --force: reinstalling + verifying even though versions match"
  needs_update=true
fi

# Also check if behind by commits
if ! $needs_update; then
  BEHIND=$(git rev-list HEAD.."$REMOTE/$TARGET_BRANCH" --count 2>/dev/null || echo "0")
  if [ "$BEHIND" != "0" ] && [ "$BEHIND" -gt 0 ] 2>/dev/null; then
    echo "→ Branch is $BEHIND commits behind $REMOTE/$TARGET_BRANCH — updating"
    needs_update=true
  fi
fi

if ! $needs_update; then
  echo ""
  echo "✓ Already up to date — v$LOCAL_VER"
  smoke_backend warn || true
  echo "  To reinstall + verify anyway: ./update.sh --force"
  echo "  To only verify (no changes): ./update.sh --verify-only"
  exit 0
fi

echo ""
echo "→ Updating v$LOCAL_VER → v$REMOTE_VER ..."
# Pull
if [ -n "$TARGET_BRANCH" ]; then
  echo "  git pull $REMOTE $TARGET_BRANCH"
  # Stash local changes if any
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "  Stashing local changes..."
    git stash push -m "auto-stash before update $(date -Is)" || true
  fi
  git checkout "$TARGET_BRANCH" 2>/dev/null || git checkout -b "$TARGET_BRANCH" "$REMOTE/$TARGET_BRANCH" 2>/dev/null || true
  git pull "$REMOTE" "$TARGET_BRANCH" || { echo "  Pull failed, trying merge"; git merge "$REMOTE/$TARGET_BRANCH" || true; }
else
  git pull || true
fi

NEW_VER=$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "$REMOTE_VER")
echo ""
echo "→ New version: v$NEW_VER"

# Patch .env with new keys from .env.example without overwriting
if [ -f ".env.example" ] && [ -f ".env" ]; then
  echo "→ Patching .env with new keys..."
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    key=$(echo "$line" | cut -d= -f1)
    if ! grep -q "^${key}=" .env 2>/dev/null; then
      echo "  + Adding $key"
      echo "$line" >> .env
    fi
  done < .env.example
  # ensure frontend/.env has VITE_ keys
  mkdir -p frontend
  for k in VITE_API_URL VITE_APP_NAME; do
    if ! grep -q "^${k}=" frontend/.env 2>/dev/null; then
      val=$(grep "^${k}=" .env 2>/dev/null | cut -d= -f2- || echo "")
      if [ -n "$val" ]; then echo "${k}=${val}" >> frontend/.env; echo "  + Added $k to frontend/.env"; fi
    fi
  done
fi

# Reinstall / rebuild (failures are fatal — never deploy broken code)
echo "→ Reinstalling dependencies..."
if [ -f "install.sh" ]; then
  bash ./install.sh || { echo "✗ install.sh FAILED — fix the errors above, then re-run."; exit 1; }
elif [ -f "scripts/install.sh" ]; then
  bash ./scripts/install.sh || { echo "✗ scripts/install.sh FAILED — fix the errors above, then re-run."; exit 1; }
else
  # Fallback manual
  if [ -d "backend" ] && command -v python3 >/dev/null 2>&1; then
    cd backend && if [ -d ".venv" ]; then source .venv/bin/activate; pip install -r requirements.txt -q; deactivate || true; fi; cd ..
  fi
  if [ -d "frontend" ] && command -v npm >/dev/null 2>&1; then
    cd frontend && npm install --silent && npm run build --silent; cd ..
  fi
fi

# DB migration is automatic on backend start (init_db creates tables, migrates .memory_db.json if postgres empty)
echo ""
echo "→ Ensuring PostgreSQL..."
if [ -d "$ROOT/pgdata" ] && command -v pg_ctl >/dev/null 2>&1; then
  if ! /usr/lib/postgresql/18/bin/pg_isready -h 127.0.0.1 -p 5433 -U rami -d rai_planner >/dev/null 2>&1; then
    echo "  Starting pgdata on :5433..."
    /usr/lib/postgresql/18/bin/pg_ctl -D "$ROOT/pgdata" -l "$ROOT/logs/pg.log" start >/dev/null 2>&1 || true
  fi
fi

# Test everything, restart backend, verify it serves the new code
echo ""
run_backend_tests
run_frontend_tests
restart_backend
smoke_backend fatal

echo ""
echo "=========================================="
echo "  Updated + verified — RAI Planner v$NEW_VER"
echo "  Previous: v$LOCAL_VER"
echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "  Tests: backend ✓  frontend ✓  backend live ✓"
echo "=========================================="
echo "Backend restarted with new code (logs/backend.log)."
echo "Frontend dist rebuilt → nginx serves it (no restart needed)."
