# Security Policy

RAI Planner is a self-hosted, open-source tool. Security depends heavily on how **you** deploy it.

## Reporting a Vulnerability

Please do **not** open a public issue for security vulnerabilities.

- Email: **security@squadifyai.com**
- Include: description, reproduction steps, affected version (`cat VERSION`), impact assessment
- You'll get an acknowledgment within 72 hours

## Supported Versions

| Version | Supported |
|---|---|
| latest `main` | ✅ |
| older tags | ❌ — update via `./update.sh` |

## What's implemented

- **Auth:** JWT (HS256, algorithm pinned on decode), bcrypt password hashing, protected routes on every mutating endpoint
- **Brute-force protection:** in-memory sliding-window rate limiting on `POST /api/auth/login` and `POST /api/auth/signup` (10 req/min/IP)
- **Registration kill-switch:** `ALLOW_SIGNUP=false` disables public sign-up (recommended once your account exists)
- **Filesystem sandbox:** with `PROJECTS_ROOT` set, all project paths (on create, update, *and* every read) must resolve inside that directory; traversal outside returns an error
- **Path hygiene:** sensitive files (`.env*`, `.pem`, `.key`, …), binary formats, and large files are excluded from agent context; symlink resolution + path normalization applied
- **API keys at rest:** encrypted with Fernet (AES-CBC + HMAC, authenticated) derived from `ENCRYPTION_KEY` (preferred) or `JWT_SECRET`; keys are masked (`••••abcd`) in all responses and never logged
- **Markdown rendering:** HTML-escaped (Cortex-safe)
- **No secrets in the repo:** `.env` is gitignored; `JWT_SECRET` is generated at install time

## Hardening checklist for public/production deployments

```ini
# .env
ALLOW_SIGNUP=false          # after creating your account
PROJECTS_ROOT=/srv/projects # only these dirs are readable by the agent
ENCRYPTION_KEY=<long-random-string>   # dedicated key instead of deriving from JWT_SECRET
JWT_SECRET=<long-random-string>       # installer generates one
CORS_ORIGINS=https://your-domain.com  # exact origins, no wildcards
```

Additional recommendations:

- Run behind a reverse proxy with HTTPS (see `deploy/`) — tokens are bearer credentials
- Don't expose the backend port (`:8000`) directly; let the proxy handle `/api`
- Keep `docker-compose`/uvicorn bound to `127.0.0.1` unless you know you need otherwise
- Update regularly: `./update.sh`
- Use MongoDB Atlas or a locally bound MongoDB with credentials; never expose `:27017`

## Known limitations (by design)

- The rate limiter is in-memory (per process). Behind multi-worker/multi-node setups, use a shared store (e.g. Redis) or a proxy-level limiter (nginx `limit_req`).
- `VITE_API_URL` is baked into the frontend bundle at build time — never put secrets in `VITE_*` variables.
- Anyone with a valid account can create projects pointing at directories under `PROJECTS_ROOT` — treat `PROJECTS_ROOT` as trusted to all its users. For single-user deployments this is fine; create one account and set `ALLOW_SIGNUP=false`.
