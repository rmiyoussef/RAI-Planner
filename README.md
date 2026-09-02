# RAI Planner — Smart Engineering Agent Platform

A modern project/task management app with an **AI-powered Smart Engineering Agent** that understands your repository + `.brain/` context to generate high-quality engineering tasks.

## Tech Stack
- **Frontend:** React + TypeScript + Vite, React Router, light/dark theme
- **Backend:** Python + FastAPI + Pydantic (async), modular agents & services
- **Database:** MongoDB Atlas (Motor async) with in-memory fallback for tests/dev
- **AI Agent:** Python modular agent (`agents/`), OpenAI-compatible provider, background worker lifecycle

## Quick Start

### 1. Clone
```bash
git clone git@github.com:rmiyoussef/RAI-Planner.git
cd RAI-Planner
```

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # edit MONGODB_URI, JWT_SECRET
uvicorn app.main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

### 4. Environment Variables
See `.env.example`:
```
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=rai_planner
JWT_SECRET=long-random-string
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000/api
```

AI provider config is stored **in-app** via Settings → AI Configuration (encrypted).

### 5. Tests
```bash
cd backend
pytest -v
# frontend
cd frontend
npm test
```

### Docker (optional)
```bash
docker-compose up --build
```

## Key Product Invariants
- Every task MUST belong to a project (`project_id` validated server-side)
- Projects are **disabled, not deleted**
- Internal users cannot log in (no credentials)
- Only latest task version is editable; history is immutable
- Descriptions are Markdown with preview/copy/download
- Successful AI generation creates version + activity; button then disabled
- API keys masked (`••••abcd`), encrypted at rest, never logged
- Filesystem access sandboxed to `project_path`; secrets/binary/huge files ignored

## AI Agent Workflow
`Generate task With AI` → validate project → inspect `.brain/` → build context (respecting limits, ignoring `.git`, `node_modules`, `.env`, etc.) → load provider/model/prompt/skills → call provider (or mock) → save Markdown version + activity → mark `ai_generated`.

## API
Prefix `/api`:
- `/auth` signup, login, me, profile, change-password
- `/projects` CRUD, disable, brain
- `/tasks` CRUD, versions, activities, generate
- `/users` internal users
- `/dashboard` metrics + date aggregation (daily/weekly/monthly)
- `/settings` ai-config, agent, skills
- `/agent` status, runs, lifecycle

FastAPI auto docs at `/docs`.

## Project Structure
```
RAI-Planner/
├── backend/app/
│   ├── api/routes/
│   ├── core/ (config, security, database)
│   ├── agents/ (smart_engineering_agent, brain_reader, prompt_manager, skill_manager, ai_provider)
│   ├── services/filesystem.py
│   └── main.py
├── frontend/src/
│   ├── pages/ (Home, Projects, ProjectDetail, Tasks, Users, Settings, Login/Signup)
│   ├── components/ (Layout, Markdown)
│   ├── store/AuthContext.tsx
│   └── api/client.ts
├── .env.example
└── docker-compose.yml
```

## Security Notes
- Passwords hashed with bcrypt (72-byte truncation)
- JWT auth, protected routes
- Mongo-safe queries, Pydantic validation
- Path traversal prevention, symlink handling, secret filtering
- Cortex-safe Markdown rendering (escaped HTML)

## .brain Context
Agent prioritizes `.brain/` if present; otherwise project shows: **the ai tool need to instal on this project**.
Context builder respects `MAX_FILE_SIZE` and `MAX_CONTEXT_BYTES`, ignores sensitive/binary/cache dirs.

---
Built as production-quality monorepo per spec phases 1-11.
