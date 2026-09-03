#!/usr/bin/env bash
set -e

# RAI Planner — Easy Install Script (Production Ready)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/install.sh | bash
#   OR
#   git clone https://github.com/rmiyoussef/RAI-Planner.git && cd RAI-Planner && ./install.sh
#   OR
#   ./scripts/install.sh
#
# What it does:
#   1. Clones repo if not already in a RAI-Planner directory
#   2. Creates / patches .env from .env.example (all DB + app configs)
#   3. Ensures PostgreSQL is available (local pgdata or docker)
#   4. Installs backend deps (venv) and frontend deps (npm)
#   5. Builds frontend
#   6. Prints next steps and version

REPO_URL="https://github.com/rmiyoussef/RAI-Planner.git"
REPO_SSH="git@github.com:rmiyoussef/RAI-Planner.git"
DEFAULT_BRANCH="main"

# If we are not inside the repo (no VERSION file next to this script), clone it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/VERSION" ] && [ ! -f "./VERSION" ]; then
  echo "→ Cloning RAI Planner..."
  if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    git clone "$REPO_SSH" RAI-Planner || { echo "Clone via SSH failed, trying HTTPS..."; git clone "$REPO_URL" RAI-Planner; }
  else
    git clone "$REPO_URL" RAI-Planner || { echo "Clone via HTTPS failed, trying SSH..."; git clone "$REPO_SSH" RAI-Planner; }
  fi
  cd RAI-Planner
else
  if [ -f "$SCRIPT_DIR/VERSION" ]; then
    cd "$SCRIPT_DIR"
    if [ "$(basename "$SCRIPT_DIR")" = "scripts" ]; then
      cd "$SCRIPT_DIR/.."
    fi
  fi
fi

ROOT="$(pwd)"
VERSION=$(cat VERSION 2>/dev/null || echo "0.1.0")
echo "=========================================="
echo "  RAI Planner — Installer  v$VERSION"
echo "  Root: $ROOT"
echo "=========================================="

# Portable sed (GNU vs BSD/macOS)
if sed --version >/dev/null 2>&1; then
  sed_inplace() { sed -i "$@"; }
else
  sed_inplace() { sed -i.bak "$@" && rm -f "${1}.bak"; }
fi

# 1. .env — create from example or patch missing keys
if [ ! -f ".env" ]; then
  echo "→ Creating .env from .env.example..."
  cp .env.example .env
  SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "change-me-to-long-random-string-min-32-chars")
  sed_inplace "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
  echo "  → Generated random JWT_SECRET"
else
  echo "→ .env already exists — patching missing keys from .env.example..."
  # Add any missing keys from .env.example without overwriting existing
  while IFS= read -r line; do
    # skip comments and empty
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    key=$(echo "$line" | cut -d= -f1)
    if ! grep -q "^${key}=" .env 2>/dev/null; then
      echo "  + Adding $key"
      echo "$line" >> .env
    fi
  done < .env.example
  # Ensure JWT_SECRET is not placeholder
  if grep -q "JWT_SECRET=change-me" .env 2>/dev/null; then
    SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || echo "change-me")
    sed_inplace "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
    echo "  → Regenerated JWT_SECRET"
  fi
fi
echo "  → .env ready at $ROOT/.env"

# Ensure frontend/.env exists and has VITE_ keys (Vite loads frontend/.env, not root)
if [ ! -f "frontend/.env" ]; then
  echo "→ Creating frontend/.env..."
  mkdir -p frontend
  grep "^VITE_" .env > frontend/.env 2>/dev/null || echo "VITE_API_URL=/api" > frontend/.env
  # Ensure VITE_APP_NAME
  if ! grep -q "VITE_APP_NAME" frontend/.env 2>/dev/null; then
    grep "VITE_APP_NAME" .env >> frontend/.env 2>/dev/null || echo "VITE_APP_NAME=RAI Planner" >> frontend/.env
  fi
else
  # patch missing VITE_ keys
  for k in VITE_API_URL VITE_APP_NAME; do
    if ! grep -q "^${k}=" frontend/.env 2>/dev/null; then
      val=$(grep "^${k}=" .env 2>/dev/null | cut -d= -f2- || echo "")
      if [ -n "$val" ]; then echo "${k}=${val}" >> frontend/.env; echo "  + Added $k to frontend/.env"; fi
    fi
  done
fi

# 2. PostgreSQL — ensure data dir and server
echo ""
echo "→ Checking PostgreSQL..."
if command -v psql >/dev/null 2>&1 || [ -x "/usr/lib/postgresql/18/bin/psql" ]; then
  PSQL="/usr/lib/postgresql/18/bin/psql"
  [ -x "$PSQL" ] || PSQL="psql"
  INITDB="/usr/lib/postgresql/18/bin/initdb"
  PGCTL="/usr/lib/postgresql/18/bin/pg_ctl"
  [ -x "$INITDB" ] || INITDB="initdb"
  [ -x "$PGCTL" ] || PGCTL="pg_ctl"
  # Check if our pgdata exists and is running
  if [ -d "$ROOT/pgdata" ]; then
    if $PGCTL -D "$ROOT/pgdata" status >/dev/null 2>&1; then
      echo "  PostgreSQL already running (pgdata)"
    else
      echo "  Starting PostgreSQL (pgdata)..."
      $PGCTL -D "$ROOT/pgdata" -l "$ROOT/logs/pg.log" start >/dev/null 2>&1 || echo "  WARNING: pg_ctl start failed — check logs/pg.log"
    fi
  elif [ -d "/tmp/rai_pgdata" ]; then
    echo "  Migrating /tmp/rai_pgdata → $ROOT/pgdata..."
    mkdir -p "$ROOT/pgdata"
    cp -a /tmp/rai_pgdata/* "$ROOT/pgdata/" 2>/dev/null || true
    chmod 700 "$ROOT/pgdata" 2>/dev/null || true
    # fix socket path if needed
    sed -i "s|/tmp/rai_pgdata|$ROOT/pgdata|g" "$ROOT/pgdata/postgresql.conf" 2>/dev/null || true
    $PGCTL -D "$ROOT/pgdata" -l "$ROOT/logs/pg.log" start >/dev/null 2>&1 || true
  else
    # No pgdata — will be created on first backend start via start.sh
    echo "  No pgdata yet — will be created on first ./start.sh (or docker-compose up)"
  fi
  # Quick check
  if $PSQL -h 127.0.0.1 -p 5433 -U rami -d rai_planner -c "SELECT 1" >/dev/null 2>&1; then
    echo "  PostgreSQL reachable at 127.0.0.1:5433"
  else
    echo "  PostgreSQL not yet reachable — will be started by ./start.sh"
  fi
else
  echo "  PostgreSQL binaries not found — using docker-compose postgres or install postgresql-18"
fi

# 3. Backend
echo ""
echo "→ Setting up backend..."
if [ ! -d "backend" ]; then
  echo "  ERROR: backend/ not found in $ROOT"
  exit 1
fi
cd "$ROOT/backend"
if command -v python3 >/dev/null 2>&1; then
  if ! python3 -m venv --help >/dev/null 2>&1; then
    echo "  ERROR: python3 venv module missing."
    echo "  Ubuntu/Debian:  sudo apt install python3-venv python3-pip"
    echo "  Fedora:         sudo dnf install python3-pip"
    echo "  macOS:          brew install python"
    exit 1
  fi
  if [ ! -d ".venv" ]; then
    echo "  Creating venv..."
    python3 -m venv .venv || { echo "  ERROR: failed to create venv"; exit 1; }
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  echo "  Installing Python deps..."
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  echo "  Backend deps installed"
  # Quick test
  python3 -c "from app.main import app; print('  Backend import OK')" || echo "  WARNING: backend import failed — check .env POSTGRES_URI"
  deactivate || true
else
  echo "  WARNING: python3 not found, skipping backend install"
fi

# 4. Frontend
echo ""
echo "→ Setting up frontend..."
cd "$ROOT/frontend"
if command -v npm >/dev/null 2>&1; then
  NODE_MAJOR=$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1)
  if [ -n "$NODE_MAJOR" ] && [ "$NODE_MAJOR" -lt 18 ]; then
    echo "  WARNING: Node $(node --version) detected — Node 18+ recommended"
  fi
  echo "  Installing npm deps..."
  npm install --silent
  echo "  Building frontend..."
  npm run build --silent
  echo "  Frontend built → frontend/dist"
else
  echo "  WARNING: npm not found, skipping frontend install (install Node 18+ from https://nodejs.org)"
fi

# 5. Summary
echo ""
echo "=========================================="
echo "  Install complete — RAI Planner v$VERSION"
echo "=========================================="
echo "Quick start (one command):"
echo "  cd $ROOT && ./start.sh"
echo "  → starts PostgreSQL (if needed) + backend :8000 (hot-reload) + frontend :5173"
echo "  → open http://localhost:5173 (or http://plan.squadifyai.com via nginx)"
echo ""
echo "Production (nginx + dist):"
echo "  cd $ROOT/frontend && npm run build"
echo "  sudo bash $ROOT/deploy/setup-nginx.sh  # serves dist + proxies /api/"
echo ""
echo "Manual:"
echo "  1. Edit .env:  nano $ROOT/.env  (all DB + JWT + CORS + VITE_ keys)"
echo "  2. Run backend:  cd $ROOT/backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  3. Run frontend: cd $ROOT/frontend && npm run dev"
echo ""
echo "Docker:"
echo "  docker-compose up --build"
echo "  → postgres:16 + backend :8000 + frontend :5173"
echo ""
echo "To update later:"
echo "  ./update.sh        (or ./scripts/update.sh)"
echo "  Current version: v$VERSION  (stored in VERSION)"
echo "=========================================="
