#!/usr/bin/env bash
set -e

# RAI Planner — Update Script (production-ready, version-aware)
# Usage:
#   ./update.sh                # update current clone
#   ./scripts/update.sh        # same
#   curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/update.sh | bash
#
# What it does:
#   1. Finds repo root (where VERSION lives)
#   2. Fetches remote, compares local VERSION vs remote VERSION
#   3. If outdated, pulls latest (staging or main), patches .env with new keys, reinstalls deps, rebuilds, migrates DB

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

# Determine current branch and remote
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "staging")
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

# Get remote VERSION without checking out (via git show)
REMOTE_VER=""
for try_branch in staging main master; do
  # try to get VERSION from remote branch
  REMOTE_VER=$(git show "$REMOTE/$try_branch:VERSION" 2>/dev/null | tr -d '[:space:]' || echo "")
  if [ -n "$REMOTE_VER" ]; then
    TARGET_BRANCH="$try_branch"
    break
  fi
done

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
  echo "  To force update: git pull $REMOTE $TARGET_BRANCH && ./install.sh"
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

# Reinstall / rebuild
echo "→ Reinstalling dependencies..."
if [ -f "install.sh" ]; then
  bash ./install.sh || echo "  install.sh failed — check logs"
elif [ -f "scripts/install.sh" ]; then
  bash ./scripts/install.sh || echo "  scripts/install.sh failed"
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

echo ""
echo "=========================================="
echo "  Updated — RAI Planner v$NEW_VER"
echo "  Previous: v$LOCAL_VER"
echo "  Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "=========================================="
echo "Restart services:"
echo "  ./start.sh  (or docker-compose up --build -d)"
echo "  frontend dist already built → nginx serves it"
