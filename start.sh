#!/usr/bin/env bash
set -e

# RAI Planner — One-command dev launcher
# Starts the backend (uvicorn :$BACKEND_PORT) in the background and the frontend
# (vite :$FRONTEND_PORT) in the foreground. Ports come from .env (see .env.example).
# Ctrl+C stops both (backend is only stopped if this script started it).
#
# Usage:  ./start.sh        (or ./scripts/start.sh)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$(basename "$ROOT")" = "scripts" ]; then
  ROOT="$(dirname "$ROOT")"
fi
cd "$ROOT"

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Run ./install.sh first."
  exit 1
fi

BACKEND_PORT=$(grep -E "^BACKEND_PORT=" .env 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')
[ -z "$BACKEND_PORT" ] && BACKEND_PORT="8000"
FRONTEND_PORT=$(grep -E "^FRONTEND_PORT=" .env 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')
[ -z "$FRONTEND_PORT" ] && FRONTEND_PORT="5173"
export BACKEND_PORT FRONTEND_PORT

BACKEND_PID=""
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}/api/health"

# Ensure PostgreSQL is running (local dev, port 5433, data in ./pgdata)
if ! /usr/lib/postgresql/18/bin/pg_isready -h 127.0.0.1 -p 5433 -U rami -d rai_planner >/dev/null 2>&1; then
  if [ -d "$ROOT/pgdata" ]; then
    echo "→ Starting PostgreSQL on :5433 (data: pgdata) ..."
    /usr/lib/postgresql/18/bin/pg_ctl -D "$ROOT/pgdata" -l "$ROOT/logs/pg.log" start >/dev/null 2>&1 || true
    for i in $(seq 1 10); do
      if /usr/lib/postgresql/18/bin/pg_isready -h 127.0.0.1 -p 5433 -U rami -d rai_planner >/dev/null 2>&1; then break; fi
      sleep 0.5
    done
  elif [ -d "/tmp/rai_pgdata" ]; then
    echo "→ Starting PostgreSQL on :5433 (data: /tmp/rai_pgdata) ..."
    /usr/lib/postgresql/18/bin/pg_ctl -D /tmp/rai_pgdata -l "$ROOT/logs/pg.log" start >/dev/null 2>&1 || true
  fi
fi

if curl -sf -m 2 "$BACKEND_URL" >/dev/null 2>&1; then
  echo "→ Backend already running on :${BACKEND_PORT} (leaving it alone)"
else
  echo "→ Starting backend on :${BACKEND_PORT} (hot-reload enabled) ..."
  ( cd backend && nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload --reload-dir "$ROOT/backend/app" > "$ROOT/logs/backend.log" 2>&1 & echo $! > "$ROOT/logs/backend.pid" )
  BACKEND_PID=$(cat "$ROOT/logs/backend.pid")
  for i in $(seq 1 20); do
    if curl -sf -m 2 "$BACKEND_URL" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if curl -sf -m 2 "$BACKEND_URL" >/dev/null 2>&1; then
    echo "  Backend ready (logs: logs/backend.log)"
  else
    echo "  WARNING: backend not responding yet — check logs/backend.log"
  fi
fi

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "→ Stopping backend (pid $BACKEND_PID) ..."
    kill "$BACKEND_PID" 2>/dev/null || true
    rm -f "$ROOT/logs/backend.pid"
  fi
}
trap cleanup EXIT

echo "→ Starting frontend on http://localhost:${FRONTEND_PORT} (Ctrl+C to stop)"
cd frontend
exec npm run dev -- --port "$FRONTEND_PORT"
