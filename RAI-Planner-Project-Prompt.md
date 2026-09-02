# RAI Planner — Advanced Project Specification & Implementation Prompt

## 1. Role

You are a senior full-stack architect and AI-agent engineer. Build and implement a production-quality application called **RAI Planner** in the existing repository:

`git@github.com:rmiyoussef/RAI-Planner.git`

Treat this document as the source of truth for the product requirements and engineering direction.

Do not build a throwaway prototype. The application should have a clean architecture, strong separation of concerns, secure authentication, predictable APIs, testability, maintainability, and a polished modern UI.

---

## 2. Product Vision

RAI Planner is a project/task management application designed around an **AI-powered Smart Engineering Agent**.

The application allows an owner to:

- Manage software projects.
- Manage engineering tasks.
- Assign tasks to internal users.
- Track task history and versions.
- Understand project/task activity through dashboards.
- Generate/rewrite task descriptions intelligently using an AI agent.
- Configure the AI provider, model, API key, agent system prompt, and skills.
- Monitor the agent's runtime status.

The AI agent should understand a software project by inspecting its repository structure and the project's `.brain/` directory, then use that context to produce a significantly better engineering task.

---

# 3. Technology Stack

## Frontend

Use:

- React
- TypeScript
- Vite
- Modern component architecture
- Responsive design
- Dark/light theme support
- Light mode is the default theme.

Do not unnecessarily introduce a large UI framework. Prefer small, composable, maintainable components.

## Backend

Use:

- Python
- FastAPI
- Pydantic
- Async-first architecture where appropriate
- Clean service/repository separation
- Background worker architecture for the AI agent

## AI Agent

The AI agent must be implemented in Python.

Design it as a clean, modular service rather than embedding AI logic directly inside API route handlers.

The architecture should make it possible to:

- Start the agent.
- Stop/restart the agent.
- Check health/status.
- Update AI configuration.
- Load system prompts.
- Load skills.
- Build project context.
- Read `.brain/`.
- Generate/rewrite tasks.
- Record execution state and errors.

## Database

Use:

- MongoDB Atlas
- MongoDB driver suitable for async Python usage.
- Proper indexes.
- Repository/data-access abstraction.

Do not tightly couple business logic to raw MongoDB queries.

---

# 4. Repository / Existing Code

Before implementing anything:

1. Clone/open the repository.
2. Inspect the existing repository.
3. Identify whether any code already exists.
4. Preserve useful existing work.
5. Do not blindly overwrite existing files.
6. Determine the current architecture before deciding where new modules belong.
7. If the repository is empty, initialize a clean monorepo structure.

Recommended high-level structure:

```text
RAI-Planner/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── agents/
│   │   ├── workers/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── ...
│
├── docs/
├── .env.example
├── docker-compose.yml
├── README.md
└── ...
```

Adjust this structure if the existing repository has a better established architecture.

---

# 5. Authentication

There is exactly one type of authenticated application owner.

## Sign Up

Create a simple account creation page with:

- Full name
- Email
- Password
- Confirm password if useful for validation

The owner created through this flow can log into the application.

Passwords must never be stored as plaintext.

Use secure password hashing.

## Login

Create a login page with:

- Email
- Password
- Validation
- Error handling
- Loading state
- Secure authentication/session handling

Protect all authenticated application routes.

---

# 6. Important User Model Rule

There are two different concepts:

### Owner

The owner:

- Signs up.
- Logs in.
- Can access the website.
- Can configure the AI.
- Can manage projects.
- Can manage tasks.
- Can manage internal users.

### Internal User

Internal users:

- Are created and managed from the Users page.
- Cannot log into the website.
- Do not have authentication credentials.
- Exist only to be assigned to tasks.
- Have a GitHub profile URL.
- Have a GitHub username derived from that URL.

Do not accidentally allow internal users to authenticate.

---

# 7. Global Application Layout

After authentication, use an application shell containing:

## Left Sidebar

The sidebar must contain:

1. Home
2. Projects
3. Tasks
4. Users
5. Settings

Include:

- Application branding
- Active navigation state
- Theme switch
- Owner/profile area if appropriate
- Logout action

The layout must work well on desktop and reasonably on smaller screens.

---

# 8. Theme

Support:

- Light mode
- Dark mode

Requirements:

- Light mode is the default.
- Theme preference should persist across browser reloads.
- Avoid flashes of the wrong theme during initialization.
- Components must remain readable and accessible in both modes.

---

# 9. Home Dashboard

The Home page should provide a useful engineering/project overview.

Show summaries and charts based on project/task creation and activity dates.

At minimum include:

### Project metrics

- Total projects
- Active projects
- Disabled projects
- Projects created over time

### Task metrics

- Total tasks
- Tasks by status
- Tasks by priority
- Tasks created over time
- Tasks completed over time

Charts should support useful date aggregation such as:

- Daily
- Weekly
- Monthly

Use the task/project `created_at` timestamps as the basis for creation trends.

Do not create fake statistics.

All dashboard metrics must come from the database.

---

# 10. Projects

Create a Projects page.

## Project list

Display projects with useful information such as:

- Name
- Status
- Tags
- Created at
- Task count
- Project path

Provide:

- Search
- Useful filtering
- Sorting where appropriate
- Pagination if needed

## Create project

Allow the owner to create a project.

A project should contain at least:

```text
name
description
project_path
tags
status
created_at
updated_at
```

The status should support at least:

- Active
- Disabled

## Edit project

Allow editing project information.

## Disable project

Projects must **never be hard-deleted from the application UI**.

Instead:

- Disable the project.
- Preserve all associated historical data.
- Clearly display its disabled state.

Do not implement destructive delete as the normal project action.

---

# 11. Project Details

When clicking a project, show a detailed project page.

Display:

- Project name
- Description
- Project path
- Tags
- Status
- Created at
- Updated at
- Related task count
- Link/button to view tasks belonging to this project

## Project filesystem inspection

The application must inspect the configured `project_path`.

Check whether:

```text
<project_path>/.brain/
```

exists.

If `.brain/` exists:

- Clearly show that the AI project brain is available.
- Display useful metadata where safe.
- Provide an option to inspect relevant `.brain/` information if appropriate.

If `.brain/` does not exist:

Highlight the project state with this exact message:

> **the ai tool need to instal on this project**

The message should be visually noticeable but not disruptive.

The backend must validate and safely access project paths. Do not allow arbitrary unsafe filesystem traversal.

---

# 12. Tasks

The Tasks page should feel similar to GitHub's issue/task management experience.

Display a task table/list with these columns:

- Title
- Project
- Priority
- Assigned To
- Created At
- Status

Include a prominent:

**Create New Task**

button.

---

# 13. Critical Task Rule

Every task MUST belong to a project.

This is mandatory.

A task cannot exist without a valid project reference.

The database model and backend validation must enforce this.

Do not rely only on frontend validation.

Recommended relationship:

```text
Task.project_id -> Project._id
```

Every task query should respect this relationship.

---

# 14. Task Creation

When creating a task, require:

- Project
- Title
- Description
- Priority
- Status
- Assigned user (optional unless product logic later requires it)
- Tags

The project selection is mandatory.

---

# 15. Task Details UI

When clicking a task, open its details in a **right-side modal/drawer** instead of navigating away from the task list.

The drawer/modal should be significantly wider than a typical narrow drawer.

Recommended behavior:

- Desktop: large right-side panel, approximately 50–65% viewport width.
- Mobile: full-screen panel.

The task list should remain contextually visible behind it on desktop.

---

# 16. Task Details

The task detail panel must allow the owner to:

- View task title.
- Edit task title.
- Edit description.
- Assign a user.
- Change priority.
- Change status.
- Add/remove tags.
- View project.
- View created/updated timestamps.
- View activity history.
- View version history.
- Generate the task with AI.

---

# 17. Markdown Task Description

Task descriptions must be stored as Markdown.

The UI must provide:

- Markdown editing mode.
- Preview button.
- Formatted Markdown preview.
- Copy button.
- Download button.

The preview should render Markdown safely.

Do not render unsafe arbitrary HTML without sanitization.

## Download

The Download action should download the task description as a Markdown file.

Use:

```text
.md
```

not "ms file".

The downloaded file should contain the current/latest task description.

---

# 18. Task Activity / Audit History

Every meaningful task update must generate an activity/history record.

Examples:

- Task created.
- Title changed.
- Description changed.
- Priority changed.
- Status changed.
- Assigned user changed.
- Tags changed.
- AI generation executed.

The activity should capture useful metadata such as:

```text
task_id
timestamp
action
actor
changes
version
```

Where possible, represent changes as:

```text
field
old_value
new_value
```

This creates a clear audit trail.

Do not silently overwrite history.

---

# 19. Task Versioning

Tasks must have version history.

Every meaningful task content update should create a new version.

The user should be able to:

- See the task timeline.
- See version numbers.
- Open any previous version.
- Compare versions if practical.
- View historical descriptions/data.

Historical versions are read-only.

### Critical rule

Only the latest version can be edited.

Older versions:

- Cannot be edited.
- Cannot be deleted from the normal UI.
- Must remain immutable.

A version should contain enough information to reconstruct the task state at that point in time.

---

# 20. AI Task Generation

Inside the task detail panel, provide:

**Generate task With AI**

button.

The exact button text should be:

> Generate task With AI

When clicked:

1. Verify that the task belongs to a valid project.
2. Load the project.
3. Resolve the project's `project_path`.
4. Inspect the project's filesystem safely.
5. Inspect `.brain/`.
6. Read the relevant project structure/context.
7. Load the configured AI provider/model.
8. Load the Smart Engineering Agent system prompt.
9. Load configured skills.
10. Build a structured project context.
11. Ask the AI agent to understand the project.
12. Rewrite/improve the existing task.
13. Return the generated Markdown task description.
14. Save the generated result as the latest task version.
15. Record an activity event.
16. Mark the task as AI-generated.

The AI should not simply paraphrase the original task.

It should improve the task using actual project context.

---

# 21. AI Generation Quality

The AI-generated task should aim to include, where appropriate:

- Clear objective
- Context
- Problem statement
- Technical understanding
- Relevant architecture/components
- Expected behavior
- Implementation considerations
- Acceptance criteria
- Potential edge cases
- Testing requirements
- Dependencies
- Files/modules likely affected

Do not invent project architecture.

If the repository context does not provide enough information, the AI should explicitly state uncertainty rather than fabricate facts.

---

# 22. .brain Context

The `.brain/` directory is an important source of engineering context.

The agent should prioritize relevant `.brain/` information when understanding a project.

Possible `.brain/` content may include:

```text
.brain/
├── architecture/
├── decisions/
├── skills/
├── context/
├── rules/
├── docs/
└── ...
```

Do not assume these exact directories exist.

The agent should dynamically inspect what actually exists.

Avoid reading unnecessary files.

The context builder should:

- Respect configurable limits.
- Avoid huge/unbounded file reads.
- Ignore binary files.
- Ignore secrets.
- Avoid `.git`.
- Avoid dependency/build directories such as `node_modules`, `.venv`, `dist`, `build`, caches, etc.
- Prevent path traversal.
- Avoid exposing secrets to the AI provider.

---

# 23. AI Generation Button State

If a task has already been successfully generated by AI:

- Disable the **Generate task With AI** button.
- Clearly indicate that AI generation has already been performed.

Do not allow accidental repeated generation from the same task state.

If future product requirements need regeneration, design the backend so that explicit regeneration can be added safely without corrupting version history.

---

# 24. Users

Create a Users page.

Users are internal task-assignment users, not application accounts.

Display:

- Full name
- Email if stored
- GitHub URL
- GitHub username
- Created at
- Updated at

Allow:

- Create user
- Edit user
- Disable user if appropriate

Do not allow these users to log into the application.

---

# 25. GitHub User Handling

When creating/editing an internal user:

Provide a GitHub profile URL.

Example:

```text
https://github.com/octocat
```

Extract the GitHub username:

```text
octocat
```

Store both:

```text
github_url
github_username
```

Validate the URL format.

Do not depend on scraping GitHub just to extract the username.

---

# 26. Settings

Create a Settings page with tabs.

Required tabs:

1. Profile
2. AI Configuration
3. Agent

---

# 27. Profile Settings

Allow the owner to edit profile information such as:

- Full name
- Email
- Password/change password where appropriate

Use proper validation and security.

---

# 28. AI Configuration

Create an AI configuration tab with:

- API Key
- Model Name
- Provider URL

Examples of provider configuration should be generic.

Do not hardcode a single AI provider.

The architecture should support OpenAI-compatible APIs where possible.

### Security

API keys must be treated as secrets.

Requirements:

- Never expose the raw API key back to the frontend after saving.
- Do not log API keys.
- Do not store secrets in source code.
- Use secure persistence/encryption strategy where practical.
- Return masked values in the UI.

Example display:

```text
••••••••••••abcd
```

---

# 29. Agent Settings

The Agent tab should display:

- Agent status
- System prompt
- Skills

The owner can:

- View/edit system prompt.
- Add a skill.
- Edit a skill.
- Enable/disable a skill if supported.
- Remove a skill if appropriate.

Skills should be represented as structured entities rather than hardcoded strings scattered through the codebase.

Possible structure:

```text
name
description
instructions
enabled
created_at
updated_at
```

---

# 30. Smart Engineering Agent

The AI agent is called:

**Smart Engineering Agent**

Its primary responsibility is to help the owner create high-quality engineering tasks based on actual project context.

It should be implemented in Python.

Use a modular architecture such as:

```text
agents/
├── smart_engineering_agent.py
├── context_builder.py
├── brain_reader.py
├── prompt_manager.py
├── skill_manager.py
├── ai_provider.py
└── models.py
```

Adapt this to the actual architecture.

---

# 31. Agent Responsibilities

The Smart Engineering Agent should be able to:

### Context discovery

- Inspect project structure.
- Inspect `.brain/`.
- Identify relevant files.
- Build a concise project context.

### Reasoning input

Combine:

- Existing task.
- Project metadata.
- Repository structure.
- Relevant `.brain/` information.
- System prompt.
- Enabled skills.
- AI configuration.

### Task generation

Produce a structured Markdown task.

### Runtime management

Support:

- Start
- Stop
- Restart
- Health/status
- Error reporting
- Configuration reload

---

# 32. Background Agent

The Smart Engineering Agent must run in the background.

Do not make the web request itself responsible for a long-running AI process.

Use a proper background-worker/service architecture.

The API should submit/request an AI task and track its execution.

Possible states:

```text
idle
starting
running
completed
failed
stopped
```

The exact implementation can use an appropriate Python worker/background mechanism.

The architecture must remain clean and easy to operate.

---

# 33. Real-Time Agent Status

Settings → Agent must display real-time agent status.

Show:

- Running / stopped
- Current state
- Last activity
- Last successful execution
- Last error if any
- Current model/provider where safe
- Restart action

Use WebSocket or Server-Sent Events if appropriate.

Polling is acceptable for the first implementation if it is robust and efficient, but structure the backend so real-time transport can be upgraded easily.

---

# 34. AI Configuration Reload

When the owner changes:

- API Key
- Model Name
- Provider URL

the application should:

1. Validate the configuration.
2. Save it securely.
3. Reload/reconfigure the agent.
4. Restart the Smart Engineering Agent when required.
5. Update the agent status.
6. Report configuration/restart errors clearly.

Do not require a full application restart just to change AI configuration.

---

# 35. API Architecture

Use clear REST APIs.

Suggested domains:

```text
/api/auth
/api/projects
/api/tasks
/api/users
/api/dashboard
/api/settings
/api/agent
```

Use:

- Pydantic request/response schemas.
- Validation.
- Consistent error responses.
- HTTP status codes correctly.
- Authentication middleware/dependencies.
- Service layer for business logic.

Avoid putting business logic directly into route handlers.

---

# 36. Database Collections

Suggested MongoDB collections:

```text
owners
projects
tasks
task_versions
task_activities
users
ai_configs
agent_settings
agent_skills
agent_runs
```

You may combine or restructure collections if a better MongoDB design is appropriate.

Use indexes for:

- Owner lookup
- Project status
- Project creation date
- Task project ID
- Task status
- Task priority
- Task creation date
- Assigned user
- Task version lookup
- Activity lookup
- Unique owner email

Every document should have stable IDs and timestamps.

---

# 37. Multi-Tenancy / Ownership

Even if the first release has one owner account per application, design the data model so ownership is explicit.

Projects, tasks, users, settings, and AI configuration should be associated with the authenticated owner.

Do not accidentally expose one owner's data to another owner.

---

# 38. Security Requirements

Implement at minimum:

- Password hashing.
- Authentication protection.
- Input validation.
- Authorization checks.
- MongoDB injection-safe query construction.
- Filesystem path validation.
- Safe Markdown rendering.
- Secret protection.
- No API-key logging.
- No sensitive data in frontend bundles.
- CORS configured intentionally.
- Rate limiting on authentication-sensitive endpoints where appropriate.
- Secure error handling without leaking stack traces in production.

Never allow the AI agent to read arbitrary files outside the configured project path.

---

# 39. Filesystem Safety

Because the agent reads project repositories, filesystem access is security-sensitive.

Implement safeguards:

- Resolve absolute project path.
- Normalize paths.
- Reject paths outside allowed boundaries where appropriate.
- Prevent `../` traversal.
- Ignore symbolic links that escape the project boundary unless explicitly supported and safely resolved.
- Ignore sensitive files such as:
  - `.env`
  - `.env.*`
  - private keys
  - credentials
  - secrets
- Ignore binary files.
- Ignore huge files.
- Apply configurable maximum file size.
- Apply maximum context size.

Never send secrets to the AI provider.

---

# 40. UX Requirements

The UI should feel like a modern engineering management product.

Priorities:

- Clean
- Fast
- Minimal
- Professional
- Responsive
- Accessible
- Good empty states
- Good loading states
- Good error states
- Clear confirmation dialogs for important actions
- Toast/notification feedback where useful

Avoid excessive animations.

---

# 41. Task Drawer UX

The task drawer is a major part of the product.

Organize it into logical sections:

### Header

- Task title
- Status
- Priority
- Close button

### Main content

- Markdown editor
- Preview
- Copy
- Download
- AI generation

### Metadata

- Project
- Assigned user
- Tags
- Created at
- Updated at

### Activity

Show chronological task changes.

### Timeline

Show task versions.

Make the drawer wide enough for comfortable Markdown editing and preview.

---

# 42. AI Generation UX

When AI generation starts:

- Disable conflicting controls.
- Show clear progress state.
- Show that the agent is analyzing the project.
- Show useful stages if possible:

```text
Reading project
Reading .brain
Building context
Analyzing task
Generating task
Saving version
```

On success:

- Update the task description.
- Add a new version.
- Add activity.
- Disable the AI generation button.
- Show success feedback.

On failure:

- Keep the previous task version unchanged.
- Show a useful error.
- Record the failed agent execution where appropriate.
- Allow the user to retry safely if the failure did not produce a successful AI version.

---

# 43. Error Handling

Errors should be understandable.

Do not show raw Python exceptions to normal users.

Backend should log technical details.

Frontend should receive safe user-facing messages.

AI failures should distinguish between:

- Configuration error
- Authentication/API-key error
- Provider error
- Timeout
- Project path error
- Missing `.brain`
- Context-size problem
- Internal agent error

---

# 44. Observability

Add structured logging.

Agent executions should record:

- Started at
- Completed at
- Duration
- Task ID
- Project ID
- Status
- Provider/model
- Error category if failed

Never log:

- API keys
- Passwords
- Secrets
- Full sensitive file contents

---

# 45. Testing

Create meaningful automated tests.

## Backend tests

At minimum test:

- Authentication.
- Project creation.
- Project editing.
- Project disabling.
- Task creation.
- Task cannot exist without project.
- Task editing.
- Task activity history.
- Task versioning.
- Previous versions are immutable.
- User creation/editing.
- GitHub username extraction.
- AI configuration validation.
- Agent lifecycle.
- `.brain` detection.
- Filesystem safety.
- AI task generation workflow.

## Frontend tests

Test critical user flows:

- Login.
- Navigation.
- Project creation.
- Task creation.
- Task drawer.
- Markdown preview.
- Version timeline.
- User assignment.
- AI generation state.
- Settings.
- Theme switching.

---

# 46. Environment Configuration

Provide:

```text
.env.example
```

Do not commit real credentials.

Document required variables, such as:

```text
MONGODB_URI=
MONGODB_DATABASE=
JWT_SECRET=
CORS_ORIGINS=
```

AI configuration should preferably be stored through the application settings system rather than requiring model/API changes in source code.

---

# 47. Local Development

Provide simple developer setup.

The README should explain:

1. Clone repository.
2. Install frontend dependencies.
3. Install backend dependencies.
4. Configure environment variables.
5. Configure MongoDB Atlas.
6. Run backend.
7. Run frontend.
8. Run tests.

If useful, provide Docker Compose for local supporting services, but MongoDB Atlas remains the production database target.

---

# 48. API Documentation

FastAPI should expose useful API documentation.

Ensure:

- Request schemas are descriptive.
- Response schemas are descriptive.
- Endpoint summaries are meaningful.
- Authentication requirements are clear.

---

# 49. Code Quality

Follow these principles:

- SOLID where useful.
- DRY without overengineering.
- Small focused modules.
- Explicit interfaces.
- Type hints.
- Clear naming.
- No giant route handlers.
- No duplicated AI logic.
- No duplicated database logic.
- No magic strings where enums/configuration are more appropriate.
- Avoid premature abstractions.
- Prefer readable code over clever code.

---

# 50. Performance

The application should feel fast.

Backend:

- Async database access where beneficial.
- Avoid unnecessary database calls.
- Add indexes.
- Paginate large task lists.
- Do not load entire repositories into memory.
- Limit AI context.
- Process large files safely.

Frontend:

- Avoid unnecessary re-renders.
- Lazy-load large screens/components where appropriate.
- Avoid fetching data repeatedly.
- Use optimistic updates only where correctness is not compromised.

AI operations must never block ordinary application requests unnecessarily.

---

# 51. Important Product Invariants

The following rules are non-negotiable:

1. **Every task must belong to a project.**
2. **Tasks cannot be orphaned.**
3. **Projects are disabled, not deleted.**
4. **Internal users cannot log in.**
5. **Only the owner can authenticate.**
6. **Previous task versions are immutable.**
7. **Only the latest task version can be edited.**
8. **Task descriptions are Markdown.**
9. **AI-generated task content must be based on real project context.**
10. **The agent must not invent project facts when the repository does not support them.**
11. **API keys must never be exposed or logged.**
12. **The AI agent must run independently from normal API request processing.**
13. **Filesystem access must be sandboxed to the configured project path.**
14. **Successful AI generation creates a task version and activity record.**
15. **After successful AI generation, the AI generation button is disabled for that task.**

---

# 52. Recommended Implementation Order

Implement in this order to reduce complexity:

## Phase 1 — Foundation

- Inspect existing repository.
- Establish monorepo structure.
- Backend FastAPI foundation.
- React/Vite foundation.
- Environment configuration.
- MongoDB Atlas connection.
- Logging.
- Basic testing infrastructure.

## Phase 2 — Authentication

- Owner model.
- Signup.
- Login.
- Secure password hashing.
- Authentication middleware.
- Protected frontend routes.

## Phase 3 — Application Shell

- Sidebar.
- Routing.
- Theme system.
- Light default.
- Shared UI components.

## Phase 4 — Projects

- Project model.
- CRUD except destructive delete.
- Disable project.
- Project detail page.
- `.brain` detection.

## Phase 5 — Users

- Internal user model.
- Create/edit.
- GitHub URL parsing.
- Assignment support.

## Phase 6 — Tasks

- Task model.
- Mandatory project relationship.
- Task CRUD.
- Task list.
- Task drawer.
- Markdown editor.
- Preview.
- Copy.
- Download.

## Phase 7 — History

- Task activities.
- Task versions.
- Immutable historical versions.
- Timeline UI.

## Phase 8 — Dashboard

- Project metrics.
- Task metrics.
- Creation/activity charts.
- Date aggregation.

## Phase 9 — AI Agent

- Agent architecture.
- Provider abstraction.
- AI configuration.
- System prompt.
- Skills.
- `.brain` reader.
- Project context builder.
- Task generation.
- Version/activity integration.

## Phase 10 — Agent Runtime

- Background execution.
- Agent lifecycle.
- Status.
- Restart.
- Real-time/polling status.
- Error handling.

## Phase 11 — Hardening

- Security review.
- Filesystem security.
- API validation.
- Performance.
- Automated tests.
- Documentation.
- Production configuration.

---

# 53. Definition of Done

The project is not considered complete merely because the pages exist.

It is complete when:

- The frontend runs.
- The backend runs.
- MongoDB Atlas connects.
- Owner signup/login works.
- Authentication protects the application.
- Projects work.
- Projects can be disabled without deletion.
- `.brain` status is detected.
- Internal users can be managed.
- Internal users can be assigned to tasks but cannot log in.
- Tasks require a project.
- Task editing works.
- Markdown description works.
- Preview/copy/download work.
- Activity history works.
- Version history works.
- Previous versions cannot be edited.
- Dashboard charts use real database data.
- AI configuration works securely.
- Smart Engineering Agent runs in the background.
- Agent status is visible.
- AI can inspect project context and `.brain`.
- AI can rewrite a task based on real project information.
- Successful AI generation creates a new version and activity record.
- AI generation becomes disabled after successful generation.
- Tests cover critical functionality.
- README provides complete setup instructions.
- No real secrets are committed.

---

# 54. Engineering Instructions to the Implementing AI

Before writing code:

1. Inspect the repository.
2. Create an implementation plan.
3. Identify existing code that should be preserved.
4. Identify dependencies.
5. Identify architectural risks.
6. Implement incrementally.
7. Run tests after each major subsystem.
8. Fix errors instead of bypassing them.
9. Do not create fake/mock functionality where real functionality is required.
10. Do not silently skip requirements.
11. If a requirement conflicts with an existing implementation, explain the conflict and choose the safest maintainable solution.
12. Keep documentation updated while implementing.

After implementation:

1. Run backend tests.
2. Run frontend tests.
3. Run lint/type checks.
4. Verify production builds.
5. Review security-sensitive code.
6. Verify authentication.
7. Verify filesystem restrictions.
8. Verify task/project invariants.
9. Verify version immutability.
10. Verify AI configuration secret handling.
11. Verify agent restart behavior.
12. Update README.

---

# 55. Final Architecture Goal

The final application should feel like a real engineering management platform rather than a basic CRUD dashboard.

The most important differentiator is the **Smart Engineering Agent**:

> The owner creates a rough task → RAI Planner understands the actual project and its `.brain/` context → the Smart Engineering Agent transforms the rough task into a clear, technically grounded, actionable engineering task → the result becomes a versioned Markdown task with a complete audit trail.

Build the system so this AI workflow is a first-class architectural capability, not an afterthought.
