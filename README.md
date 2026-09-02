# RAI Planner — Smart Engineering Agent Platform

![Version](https://img.shields.io/badge/version-v0.1.6-blue) ![License](https://img.shields.io/badge/license-MIT-green)

A modern project/task management app with an **AI-powered Smart Engineering Agent** that understands your repository + `.brain/` context to generate high-quality engineering tasks.

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.10+ | `python3 --version` |
| Node.js | 18+ (with npm) | `node --version` |
| Docker (optional) | any recent | `docker --version` |

## Quick Start

**One-line install (Linux/macOS):**

```bash
curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/install.sh | bash
```

The installer clones the repo (if needed), creates `.env` with a generated `JWT_SECRET`, installs backend + frontend dependencies, and builds the frontend.

**Then run everything with one command:**

```bash
cd RAI-Planner
./start.sh    # backend on :8000, frontend on :5173 — Ctrl+C stops both
```

Open **http://localhost:5173** (API docs: http://localhost:8000/docs).

> **Database:** works out of the box — with `MONGODB_URI` empty the backend uses a built-in in-memory database (data resets on restart). Set `MONGODB_URI` in `.env` for persistent data.

### Manual setup (if you prefer)

```bash
git clone https://github.com/rmiyoussef/RAI-Planner.git
cd RAI-Planner
./install.sh
```

Or by hand:

```bash
# Backend (from repo root)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000     # reads .env from backend/ or repo root

# Frontend (second terminal, from repo root)
cd frontend
npm install
npm run dev                                   # http://localhost:5173
```

## Environment Variables

Create `.env` from `.env.example` (the installer does this for you):

```ini
MONGODB_URI=mongodb+srv://...    # optional — empty = in-memory dev database
MONGODB_DATABASE=rai_planner
JWT_SECRET=auto-generated-by-installer
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
VITE_API_URL=/api                # relative — works with dev proxy & reverse proxies
```

The backend reads `.env` from `backend/` or the repo root (both are checked).
`VITE_API_URL` is baked at build time; leave it as `/api` unless the browser must reach the backend on another origin.

AI provider config is stored **in-app** via Settings → AI Configuration (encrypted at rest).

## Docker (optional)

```bash
docker-compose up --build
```

Starts the FastAPI backend (`:8000`) and the Vite dev server (`:5173`) with the API URL wired for the browser.

## Production behind nginx (optional)

Vhost template + idempotent setup script live in `deploy/`:

```bash
# 1. Build the frontend
cd frontend && npm run build

# 2. Point your domain (or /etc/hosts) at this machine
# 3. Review deploy/plan.squadifyai.com.conf (server_name + paths), then:
sudo bash deploy/setup-nginx.sh
```

The vhost serves `frontend/dist` with SPA fallback and proxies `/api/` to the backend on `:8000`.

## Updating

```bash
./update.sh        # version-aware: pulls, reinstalls deps, rebuilds frontend
```

One-liner from any RAI-Planner clone:
```bash
curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/update.sh | bash
```

## Versioning

- The version lives in `VERSION` at the repo root and matching `v*` git tags.
- Every push to `main`/`staging` auto-bumps the **patch** version via GitHub Actions (`.github/workflows/version-bump.yml`).
- Manual minor/major bumps:
  ```bash
  ./scripts/bump-version.sh minor   # 0.1.6 → 0.2.0
  ./scripts/bump-version.sh major   # 0.2.0 → 1.0.0
  git commit -am "chore: bump version" && git tag v0.2.0 && git push --follow-tags
  ```

Check where you are anytime:
```bash
cat VERSION
git tag --sort=-v:refname | head -n 5
./update.sh    # tells you if you're behind
```

## Tests

```bash
# Backend
cd backend && source .venv/bin/activate && pytest -v

# Frontend
cd frontend && npm test
```

## Scripts

| Script | Purpose |
|---|---|
| `install.sh` | Full setup: deps, `.env`, venv, frontend build |
| `start.sh` | Run backend + frontend with one command |
| `update.sh` | Version-aware self-update |
| `scripts/bump-version.sh` | Manual version bumps |
| `deploy/setup-nginx.sh` | Install the nginx vhost (sudo) |

## Tech Stack

- **Frontend:** React + TypeScript + Vite, React Router, light/dark theme
- **Backend:** Python + FastAPI + Pydantic (async), modular agents & services
- **Database:** MongoDB Atlas (Motor async) with in-memory fallback for dev/tests
- **AI Agent:** Python modular agent (`agents/`), OpenAI-compatible provider, background worker lifecycle

## API

Prefix `/api`:

- `/auth` — signup, login, me, profile, change-password
- `/projects` — CRUD, disable, brain
- `/tasks` — CRUD, versions, activities, generate
- `/users` — internal users
- `/dashboard` — metrics + date aggregation (daily/weekly/monthly)
- `/settings` — ai-config, agent, skills
- `/agent` — status, runs, lifecycle

Interactive docs at **`/docs`** (Swagger) and **`/redoc`**.

## AI Agent Workflow

`Generate task With AI` → validate project → inspect `.brain/` → build context (respecting limits, ignoring `.git`, `node_modules`, `.env`, etc.) → load provider/model/prompt/skills → call provider (or mock) → save Markdown version + activity → mark `ai_generated`.

## Key Product Invariants

- Every task MUST belong to a project (`project_id` validated server-side)
- Projects are **disabled, not deleted**
- Internal users cannot log in (no credentials)
- Only the latest task version is editable; history is immutable
- Descriptions are Markdown with preview/copy/download
- Successful AI generation creates version + activity; the button is then disabled
- API keys masked (`••••abcd`), encrypted at rest, never logged
- Filesystem access sandboxed to `project_path`; secrets/binary/huge files ignored

## Security Notes

- Passwords hashed with bcrypt (72-byte truncation)
- JWT auth, protected routes
- Mongo-safe queries, Pydantic validation
- Path traversal prevention, symlink handling, secret filtering
- Cortex-safe Markdown rendering (escaped HTML)

## .brain Context

The agent prioritizes a project's `.brain/` directory if present; otherwise the project page prompts you to install the AI tool on that project. The context builder respects `MAX_FILE_SIZE` and `MAX_CONTEXT_BYTES`, and ignores sensitive/binary/cache directories.

## Project Structure

```
RAI-Planner/
├── backend/app/
│   ├── api/routes/
│   ├── core/            # config, security, database
│   ├── agents/          # smart_engineering_agent, brain_reader, prompt_manager, skill_manager, ai_provider
│   ├── services/        # filesystem sandbox
│   └── main.py
├── frontend/src/
│   ├── pages/           # Home, Projects, ProjectDetail, Tasks, Users, Settings, Login/Signup
│   ├── components/      # Layout, Markdown
│   ├── store/           # AuthContext
│   └── api/client.ts
├── deploy/              # nginx vhost template + setup script
├── scripts/             # install/update/bump wrappers
├── install.sh           # one-line setup
├── start.sh             # one-command dev launcher
├── update.sh            # version-aware updater
├── docker-compose.yml
└── .env.example
```

---

Built as a production-quality monorepo per spec phases 1-11.
