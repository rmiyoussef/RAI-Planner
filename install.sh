#!/usr/bin/env bash
set -e

# RAI Planner — Easy Install Script
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/install.sh | bash
#   OR
#   git clone https://github.com/rmiyoussef/RAI-Planner.git && cd RAI-Planner && ./install.sh
#   OR
#   ./scripts/install.sh
#
# What it does:
#   1. Clones repo if not already in a RAI-Planner directory
#   2. Creates .env from .env.example if missing
#   3. Installs backend deps (venv) and frontend deps (npm)
#   4. Builds frontend
#   5. Prints next steps and version

REPO_URL="https://github.com/rmiyoussef/RAI-Planner.git"
REPO_SSH="git@github.com:rmiyoussef/RAI-Planner.git"
DEFAULT_BRANCH="main"

# If we are not inside the repo (no VERSION file next to this script), clone it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "$SCRIPT_DIR/VERSION" ] && [ ! -f "./VERSION" ]; then
  echo "→ Cloning RAI Planner..."
  # Prefer SSH if ssh auth works, else HTTPS
  if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    git clone "$REPO_SSH" RAI-Planner || { echo "Clone via SSH failed, trying HTTPS..."; git clone "$REPO_URL" RAI-Planner; }
  else
    git clone "$REPO_URL" RAI-Planner || { echo "Clone via HTTPS failed, trying SSH..."; git clone "$REPO_SSH" RAI-Planner; }
  fi
  cd RAI-Planner
else
  # Already in repo - ensure we are at root
  if [ -f "$SCRIPT_DIR/VERSION" ]; then
    cd "$SCRIPT_DIR"
    # if script is in scripts/, go up one level
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

# 1. .env
if [ ! -f ".env" ]; then
  echo "→ Creating .env from .env.example..."
  cp .env.example .env
  echo "  → Edit .env and set MONGODB_URI and JWT_SECRET before running!"
  # Generate a random JWT_SECRET if not set
  if grep -q "change-me" .env 2>/dev/null; then
    SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    if command -v sed >/dev/null 2>&1; then
      sed -i "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
      echo "  → Generated random JWT_SECRET"
    fi
  fi
else
  echo "→ .env already exists, skipping"
fi

# 2. Backend
echo ""
echo "→ Setting up backend..."
if [ ! -d "backend" ]; then
  echo "  ERROR: backend/ not found in $ROOT"
  exit 1
fi
cd "$ROOT/backend"
if command -v python3 >/dev/null 2>&1; then
  if [ ! -d ".venv" ]; then
    echo "  Creating venv..."
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  echo "  Installing Python deps..."
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  echo "  Backend deps installed"
  # Quick test
  python3 -c "from app.main import app; print('  Backend import OK')" || echo "  WARNING: backend import failed"
  deactivate || true
else
  echo "  WARNING: python3 not found, skipping backend install"
fi

# 3. Frontend
echo ""
echo "→ Setting up frontend..."
cd "$ROOT/frontend"
if command -v npm >/dev/null 2>&1; then
  echo "  Installing npm deps..."
  npm install --silent
  echo "  Building frontend..."
  npm run build --silent
  echo "  Frontend built"
else
  echo "  WARNING: npm not found, skipping frontend install (install Node 20+)"
fi

# 4. Summary
echo ""
echo "=========================================="
echo "  Install complete — RAI Planner v$VERSION"
echo "=========================================="
echo "Next steps:"
echo "  1. Edit .env:  nano $ROOT/.env  (set MONGODB_URI)"
echo "  2. Run backend:  cd $ROOT/backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  3. Run frontend: cd $ROOT/frontend && npm run dev"
echo "  4. Open: http://localhost:5173  (API docs at http://localhost:8000/docs)"
echo ""
echo "Docker alternative:"
echo "  docker-compose up --build"
echo ""
echo "To update later:"
echo "  ./update.sh        (or ./scripts/update.sh)"
echo "  Current version: v$VERSION  (stored in VERSION)"
echo "=========================================="
