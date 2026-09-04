# RAI Planner — Smart Engineering Agent Platform

![Version](https://img.shields.io/badge/version-v0.1.22-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Stack](https://img.shields.io/badge/stack-PostgreSQL%20%7C%20FastAPI%20%7C%20React-blue)

A modern project/task management app with a **Plane/Linear-style issue tracker** and an **AI-powered Smart Engineering Agent** that understands your repository + `.brain/` context to generate high-quality engineering tasks.

## ✨ Highlights (v0.1.22)

- **Task Tracker:** Saved view tabs, simple filters (project/assignee/status/date/title), status grouping (Planning collapsed/expanded), inline edits, sticky columns, pagination (50/page, 1000+ tasks), status chart (Planning/Testing/Done/On Hold + Opened/Closed)
- **Company Branding:** First-time-only signup with company name/logo, random icon fallback, editable in Settings → Company, shown in sidebar top-left (no background on logo)
- **Project Brain:** Folder file-manager (expandable folders, file click → formatted markdown modal `95vw/7xl`, `90vh`)
- **Auth:** Single-owner first-time signup, JWT, bcrypt, rate-limit (`429` with `Retry-After`), `VITE_APP_NAME` from `.env`
- **Database:** **PostgreSQL** (`asyncpg`, `JSONB` tables, `pgdata` persistent, `docker-compose` postgres:16) — replaces MongoDB, automatic migration from legacy `in-memory`
- **Security:** `X-Content-Type-Options`, `CSP`, `HSTS`, `CORS` hardened, `ALLOWED` validation, path traversal guard, `Fernet` encryption for `ai_configs` + `company_settings` at rest
- **UI:** `#404040` sidebar, border-only selection, centered login, `Workspace` label, `h-[calc(100dvh-120px)]` no page scroll — only tasks scroll, hot-reload (`vite` watches `backend/app`, `uvicorn --reload`)

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.10+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| PostgreSQL | 16+ or Docker | `psql --version` or `docker --version` |
| Docker (optional) | any | `docker --version` |

## Quick Start (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/install.sh | bash
# or
git clone https://github.com/rmiyoussef/RAI-Planner.git && cd RAI-Planner && ./install.sh
```

`install.sh` will: clone if needed, create/patch `.env` from `.env.example` (all 13 keys), ensure `frontend/.env` has `VITE_*`, start `pgdata` if needed, create `backend/.venv`, `pip install`, `npm install`, `npm run build`.

Then:

```bash
./start.sh    # postgres (if pgdata) + backend :8000 --reload + frontend :5173 HMR — Ctrl+C stops both
# open http://localhost:5173  (API docs http://localhost:8000/docs)
# or production: http://plan.squadifyai.com (nginx → dist + /api proxy)
```

> **Database:** `POSTGRES_URI=postgresql://rami@127.0.0.1:5433/rai_planner` (local `pgdata` at `127.0.0.1:5433`, Docker `postgres:5432`). Tables `owners, company_settings, projects, tasks, task_versions, task_activities, users, ai_configs, agent_skills` are `JSONB` (`id TEXT PK, data JSONB`), created on `init_db()` and migrated from legacy `.memory_db.json` if empty.

### Manual

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000  # reads .env from backend/ or root

# Frontend (second terminal)
cd frontend && npm install && npm run dev  # http://localhost:5173
# build for nginx
npm run build  # → frontend/dist
```

## Environment Variables

All **must** come from `.env` — no hard-coded secrets (`backend/app/core/config.py` has no defaults for secrets).

```ini
# .env (from .env.example — installer patches missing keys)
MONGODB_URI=                     # legacy, not used (kept for compat)
MONGODB_DATABASE=rai_planner
POSTGRES_URI=postgresql://rami@127.0.0.1:5433/rai_planner
POSTGRES_DATABASE=rai_planner
JWT_SECRET=auto-generated-by-installer  # required
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://plan.squadifyai.com,http://192.168.8.100
API_PREFIX=/api
PROJECT_NAME=RAI Planner
MAX_FILE_SIZE_BYTES=1048576
MAX_CONTEXT_BYTES=200000
ENCRYPTION_KEY=optional-separate-encryption-key  # if empty derives from JWT_SECRET
PROJECTS_ROOT=                # sandbox: project_path must be inside (recommended prod)
ALLOW_SIGNUP=true             # first-time only; set false after first account
VITE_API_URL=/api             # baked at build, no fallback
VITE_APP_NAME=RAI Planner     # used in sidebar/footer, no hard-coded fallback
```

`frontend/.env` must contain `VITE_API_URL` and `VITE_APP_NAME` (installer copies from root `.env`).

## Docker

```bash
docker-compose up --build
# postgres:16 (5433:5432, volume postgres_data) + backend :8000 + frontend :5173
# VITE_API_URL=http://localhost:8000/api for browser, POSTGRES_URI=postgresql://rami@postgres:5432/rai_planner inside
```

## Production behind nginx

```bash
cd frontend && npm run build  # → dist
sudo bash deploy/setup-nginx.sh  # vhost plan.squadifyai.com.conf → /etc/nginx/... + reload
# serves dist with SPA fallback, proxies /api/ to 127.0.0.1:8000, gzip, 25M body
```

`deploy/plan.squadifyai.com.conf` + `deploy/setup-nginx.sh` are idempotent.

## Updating

```bash
./update.sh        # version-aware: fetches origin/main, compares VERSION, stashes, pulls, patches .env, reinstalls, rebuilds, ensures pgdata
# or one-liner
curl -fsSL https://raw.githubusercontent.com/rmiyoussef/RAI-Planner/main/update.sh | bash
```

`install.sh` and `update.sh` now patch missing `.env` keys without overwriting, ensure `frontend/.env` has `VITE_*`, and auto-start `pgdata` if present.

## Versioning

`VERSION` at root + `v*` tags. Push to `main`/`staging` auto-bumps patch via `.github/workflows/version-bump.yml`.

```bash
cat VERSION
./scripts/bump-version.sh minor  # 0.1.22 → 0.2.0
git commit -am "chore: bump" && git tag v0.2.0 && git push --follow-tags
```

## Tests

```bash
cd backend && source .venv/bin/activate && pytest -v  # 8 core + 10 security = 18
# security: unauth 401, IDOR 404, rate-limit 429+Retry-After, path traversal 400, SQLi whitelist, encryption at rest, XSS JSON, CORS headers, first-time-only, logo size
cd frontend && npm test  # vitest
```

## Scripts

| Script | Purpose |
|---|---|
| `install.sh` | Full setup: `.env`, `pgdata` check, venv, npm, build |
| `start.sh` | Dev launcher: postgres (if pgdata) + backend `--reload` + frontend HMR (backend file change → full-reload) |
| `update.sh` | Version-aware pull + `.env` patch + reinstall + build |
| `scripts/bump-version.sh` | Manual version bumps |
| `deploy/setup-nginx.sh` | Nginx vhost install |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite 5, React Router 6, Tailwind 3, `lucide-react`, `Vite` HMR, `vitest`
- **Backend:** Python 3.13 + FastAPI + Pydantic, `asyncpg` + `PostgreSQL 16` (`JSONB`), `bcrypt`, `python-jose`, `cryptography` (Fernet), `httpx`
- **Database:** PostgreSQL `pgdata` (persistent, `JSONB` tables, `asyncpg` pool, `ALLOWED_COLLECTIONS` whitelist, quoted identifiers, parameterized `data::jsonb`) — replaces MongoDB (`motor` removed)
- **AI Agent:** `agents/` (smart_engineering_agent, brain_reader, prompt_manager, skill_manager, ai_provider), OpenAI-compatible, `MAX_CONTEXT_BYTES` limits

## API (prefix `/api`)

- `GET /auth/signup-status` (public), `POST /auth/signup` (first-time-only, company create), `POST /auth/login` (rate-limit 10/min, `Retry-After`), `GET /auth/me`, `PUT /auth/profile`, `POST /auth/change-password`
- `GET /settings/company` / `PUT` (encrypted), `GET /settings/company/public` (public), `GET/PUT /settings/ai-config` (encrypted `provider_url/model_name/api_key`), `GET /settings/agent`, `PUT /settings/agent/prompt`, `POST /settings/agent/restart`, `GET/POST/PUT/DELETE /settings/skills`
- `GET/POST /projects`, `GET/PUT /projects/{id}`, `POST /projects/{id}/disable`, `GET /projects/{id}/brain`, `GET /projects/{id}/brain/file?path=`
- `GET/POST /tasks` (paginated `?page&limit` 100 max, filter `project_id/status/priority/assigned_to/search`), `GET/PATCH /tasks/{id}`, `GET /tasks/{id}/versions|activities`, `POST /tasks/{id}/generate`
- `GET/POST /users`, `GET/PUT/DELETE /users/{id}`
- `GET /dashboard?granularity=daily|weekly|monthly`
- `GET /health`, `GET /api/health`

Docs at `/docs` (Swagger) with `CSP` allowing `cdn.jsdelivr.net`.

## Key Product Invariants

- **Single owner:** `POST /auth/signup` only when `owners.count==0` (first-time), `GET /auth/signup-status` drives login/signup UI
- **Company branding:** `company_settings` per `owner_id`, logo ≤1 MB (frontend + backend check), random icon fallback, sidebar top-left `bg-[#404040]` border-only selection, `Workspace` label, no logo background
- **Task tracker:** `SimpleFilterBar` (project/assignee/status/date/title) + `StatusChart` (Planning/Testing/Done/On Hold + Opened/Closed) + `GroupedTable` (collapsible `Planning` expanded, sticky `# + Title` 52+308px, pagination 20/50/100, `h-[calc(100dvh-125px)]` only tasks scroll)
- **Project Brain:** `.brain` folder file-manager (expandable folders, `max-h-[65vh]` → page `h-[calc(100dvh-120px)]` no page scroll, `95vw/7xl` modal formatted markdown)
- **Security:** `X-Content-Type-Options`, `CSP`, `HSTS`, `X-Frame-Options`, `Cache-Control:no-store` for `/api`, `ALLOWED_COLLECTIONS` whitelist, `read_brain_file` traversal guard, `Fernet` at rest for `ai_configs` + `company_settings`, `bcrypt` 72B, `JWT HS256` pinned, `rate_limit` on `login/signup/create_*` with `Retry-After`

## Project Structure

```
RAI-Planner/
├── backend/app/
│   ├── api/routes/ (auth, projects, tasks, users, dashboard, settings, agent)
│   ├── core/ (config [POSTGRES_URI], security [Fernet], database [asyncpg JSONB], ratelimit)
│   ├── agents/ (smart_engineering_agent, prompt_manager, skill_manager)
│   ├── services/filesystem.py (brain_status, read_brain_file, PROJECTS_ROOT sandbox)
│   └── main.py (security headers, CORS hardened, lifespan init_db)
├── frontend/src/
│   ├── pages/ (Home, Projects, ProjectDetail [folder tree, 95vw modal, h-[calc] no scroll], Tasks [simple filters, chart, pagination], Users, Settings [Company/AI smart inputs, no card, full width], Login centered, Signup centered)
│   ├── components/tasks/ (TaskListView, SimpleFilterBar, StatusChart, GroupedTable, Pagination, SavedViewTabs, etc.)
│   ├── components/Layout.tsx (#404040 sidebar, border-only active, Workspace label)
│   └── api/client.ts (ApiError with status/headers, VITE_API_URL required)
├── pgdata/ (PostgreSQL data, gitignored, auto-started by start.sh)
├── deploy/plan.squadifyai.com.conf
├── install.sh / start.sh (hot-reload: vite watches backend/app, uvicorn --reload) / update.sh
└── .env / .env.example (all 13 keys, no hard-coded fallbacks)
```

---

Built as production-quality monorepo — `VITE_*` baked at build, `POSTGRES_URI` required, `pgdata` persistent, `handle all tables` via `JSONB`.
