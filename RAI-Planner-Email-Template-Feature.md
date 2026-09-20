# RAI Planner — Email Template Feature

## 1. Overview

Build a new **Email Templates** feature in RAI Planner.

There are two fundamentally different template types:

1. **General Template**
   - Owned by RAI Planner.
   - Stored in the database.
   - Can be created, edited, previewed, and deleted.

2. **Project Backend Template**
   - Discovered from the actual backend project filesystem.
   - For Laravel, scan:
     - `resources/views/emails`
     - `Modules/{module_name}/resources/views/emails`
   - The filesystem is the source of truth.
   - Editing must modify the actual project file.
   - Do not copy project source content into the database as the authoritative version.

The key rule is:

> General templates belong to RAI Planner. Project backend templates belong to the backend project's filesystem.

---

## 2. Navigation

Add a new left-sidebar item:

```text
Email Templates
```

Use the existing sidebar, routing, icon, permission, and layout conventions.

Suggested route:

```text
/email-templates
```

---

## 3. Template List

Create an **Email Templates** page with:

```text
Email Templates

Manage reusable email templates and templates discovered from backend projects.

[+ Add Template]
```

Filters:

```text
All
General Templates
Project Backend Templates
```

Recommended metadata:

- Template name
- Type
- Project
- Module
- Framework
- Relative file path
- Variables count
- Updated time
- Actions

General actions:

```text
Edit
Preview
Delete
```

Project actions:

```text
Edit
Preview
Refresh
```

Do not provide project-template deletion in this feature.

---

## 4. Add Template

`+ Add Template` should offer:

```text
General Template
Project Backend Template
```

### General

Creates a new database-owned template.

### Project Backend

Prefer selecting/scanning an existing discovered backend template.

Do not silently create a new backend source file. If source-file creation is later supported, require explicit project/path confirmation and strict filesystem validation.

---

# 5. General Templates

General templates are fully owned by RAI Planner.

Suggested database model:

```text
email_templates
```

Possible fields:

```text
id
name
description
content
type
created_by
created_at
updated_at
```

For this feature:

```text
type = general
```

Keep the schema consistent with the existing application architecture.

CRUD:

```text
Create
Read
Update
Delete
```

---

## 6. General Template Editor

Editor fields:

```text
Template Name
Description
HTML Editor
Variables
Preview
```

Example:

```html
<html>
  <body>
    <h1>Welcome {company_name}</h1>
    <p>Hello {employee_name}</p>
    <a href="{login_url}">Login</a>
  </body>
</html>
```

Support:

- HTML editing
- Syntax highlighting if the existing editor supports it
- Search/replace
- Copy
- Preview
- Variable insertion

Do not convert HTML to Markdown.

---

# 7. General Template Variables

Detect variables such as:

```text
{company_name}
{employee_name}
{email}
{job_title}
{login_url}
```

Show a variable panel:

```text
Variables

{company_name}
{employee_name}
{email}
{login_url}

[Insert]
```

Clicking a variable inserts it into the editor.

Deduplicate detected variables.

---

# 8. Project Backend Templates

Project backend templates must be discovered from the configured backend project path.

For Laravel, scan only:

```text
resources/views/emails
```

and:

```text
Modules/*/resources/views/emails
```

Recursively.

Examples:

```text
resources/views/emails/welcome.blade.php
resources/views/emails/password-reset.blade.php
resources/views/emails/hr/onboarding.blade.php

Modules/HR/resources/views/emails/employee-welcome.blade.php
Modules/Leave/resources/views/emails/leave-approved.blade.php
```

The scanner must discover nested templates.

---

# 9. Laravel Detection

Do not assume every backend is Laravel.

Use the existing project-analysis/detection system.

Typical Laravel signals include:

```text
artisan
composer.json
laravel/framework
app/
resources/
routes/
```

If Laravel is detected:

```text
framework = laravel
scanner = LaravelEmailTemplateScanner
```

Design the scanner behind an abstraction so future frameworks can be added:

```text
EmailTemplateScanner
  └── LaravelEmailTemplateScanner
```

Do not implement other frameworks unless required.

---

# 10. Project Template Metadata

A discovered template should have metadata similar to:

```json
{
  "id": "stable-generated-id",
  "type": "project_backend",
  "project_id": 123,
  "name": "Welcome Email",
  "file_name": "welcome.blade.php",
  "relative_path": "resources/views/emails/welcome.blade.php",
  "framework": "laravel",
  "module": null,
  "variables": [],
  "updated_at": "...",
  "exists": true
}
```

Do not expose absolute filesystem paths to the frontend unless absolutely necessary.

Prefer:

```text
relative_path
```

The backend should resolve the actual filesystem path internally.

---

# 11. Module Detection

For:

```text
Modules/HR/resources/views/emails/welcome.blade.php
```

return:

```text
module = HR
```

For:

```text
resources/views/emails/welcome.blade.php
```

return:

```text
module = null
```

Display project/module clearly in the UI.

---

# 12. Reading Project Templates

When opening a project template:

1. Verify project exists.
2. Verify user authorization.
3. Resolve the trusted project root.
4. Resolve the supplied relative template path.
5. Canonicalize the resulting path.
6. Confirm it remains inside the project root.
7. Read the current file.
8. Extract variables.
9. Return current content and metadata.

Never trust an arbitrary frontend absolute path.

Always read the current file when opening the editor.

---

# 13. Editing Project Templates

Saving a project template must modify the real backend source file.

Flow:

```text
Frontend
  ↓
API
  ↓
Authorization
  ↓
Path validation
  ↓
Filesystem write
  ↓
Re-read file
  ↓
Re-extract variables
  ↓
Return actual saved state
```

Example:

```text
resources/views/emails/welcome.blade.php
```

must actually change on disk.

Do not use a database copy as the source of truth.

---

# 14. Filesystem Security

This feature accesses source code, so filesystem security is critical.

Prevent:

```text
../
../../
absolute arbitrary paths
symlink escapes
```

Canonicalize paths and verify:

```text
resolved_file_path is inside resolved_project_root
```

Only allow access to the supported email directories.

Never scan or expose:

```text
.env
.git
.ssh
private keys
credentials
unrelated filesystem paths
```

Do not allow deletion of backend files from this feature.

---

# 15. Laravel Blade Variable Extraction

Create a dedicated service such as:

```text
BladeEmailVariableExtractor
```

It must statically inspect Blade source.

Do NOT execute PHP or the Laravel application.

Examples:

```blade
{{ $name }}
{{ $company_name }}
{{ $user->name }}
{{ $employee->email }}
{!! $html !!}
```

Also inspect variables in common directives:

```blade
@if($user)
@foreach($employees as $employee)
@isset($company)
```

The parser should:

- Detect variables
- Deduplicate them
- Preserve the original expression
- Provide a friendly display name
- Return raw syntax for insertion

Suggested metadata:

```json
{
  "name": "company_name",
  "expression": "$company_name",
  "syntax": "blade_echo",
  "raw": "{{ $company_name }}"
}
```

For:

```blade
{{ $employee->name }}
```

friendly name can be:

```text
employee.name
```

while preserving:

```blade
{{ $employee->name }}
```

internally.

---

# 16. Variable UX

For Laravel templates, show friendly names but preserve Blade syntax.

Example:

```text
Template Variables

employee.name
{{ $employee->name }}

company_name
{{ $company_name }}

loginUrl
{{ $loginUrl }}

[Insert]
```

When the user clicks Insert, insert the original Blade expression:

```blade
{{ $company_name }}
```

Do not replace Laravel expressions with:

```text
{company_name}
```

The `{name}` format is for General Templates only.

Add variable search:

```text
Search variables...
```

---

# 17. Editor Layout

Use a professional developer-oriented layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ Email Template                     [Preview] [Save]            │
├──────────────────────────────────────┬────────────────────────┤
│                                      │ Variables              │
│ HTML / Blade Editor                  │                        │
│                                      │ company_name           │
│                                      │ employee.name          │
│                                      │ loginUrl               │
│                                      │                        │
│                                      │ [Insert]               │
└──────────────────────────────────────┴────────────────────────┘
```

On smaller screens, make the variables panel collapsible/drawer-based.

Reuse the existing RAI Planner design system and editor components.

---

# 18. Preview

Both template types require preview.

## General

Render stored HTML safely.

## Laravel

Do not execute arbitrary PHP or production Laravel code.

Instead provide a safe preview mechanism:

- Parse known template expressions.
- Replace variables with mock values.
- Render static HTML where possible.
- Clearly indicate that preview data is mock data.
- Never execute arbitrary PHP.

Example:

```blade
{{ $company_name }}
```

becomes:

```text
Acme Corporation
```

Example:

```blade
{{ $employee->name }}
```

becomes:

```text
John Doe
```

Unknown values can become:

```text
Sample Value
```

---

# 19. Preview Sample Data

Use safe deterministic sample values:

```text
company_name → Acme Corporation
employee_name → John Doe
name → John Doe
first_name → John
last_name → Doe
email → john@example.com
phone → +1 555 0100
login_url → https://example.com/login
url → https://example.com
date → 2026-01-15
```

Never use real production data.

Never send production database data to preview.

---

# 20. Preview Safety

Never execute arbitrary:

```text
PHP
Blade application code
database queries
service calls
HTTP requests
```

during preview.

If full Blade rendering is implemented later, it must run in an isolated, restricted environment.

For this implementation, static/safe substitution is preferred.

---

# 21. File Ownership Model

Make this distinction explicit throughout the codebase.

### General

```text
Source of truth:
Database
```

### Project Backend

```text
Source of truth:
Actual backend filesystem
```

The UI should display badges:

```text
GENERAL
```

or:

```text
PROJECT
```

For project templates show:

```text
Project: BenchHR
Module: HR
Path: Modules/HR/resources/views/emails/welcome.blade.php
```

This makes it obvious that editing will modify source code.

---

# 22. Project Template Save Confirmation

Because saving modifies real project source, consider showing a confirmation the first time:

```text
This will modify the actual project file:

resources/views/emails/welcome.blade.php

[Cancel] [Save File]
```

For the first version, use explicit Save rather than autosave for project files.

Track unsaved changes and warn when navigating away.

---

# 23. External File Changes

Developers may edit the same Blade file in VS Code.

Therefore:

- Always read current content when opening.
- Provide Refresh/Rescan.
- Do not assume cached content is current.
- After saving, re-read the file.
- Re-extract variables after every save.

Optional future improvement:

```text
File changed outside RAI Planner.
[Reload] [Keep Current Editor]
```

---

# 24. Project Filtering

Because multiple projects may exist, support:

```text
Project:
[ All Projects ▼ ]
```

Examples:

```text
BenchHR
Squadify
RAI Planner
```

Combine with:

```text
All
General
Project Backend
```

---

# 25. Recommended Frontend Types

Keep General and Project templates distinct.

Example:

```ts
type EmailTemplate =
  | GeneralEmailTemplate
  | ProjectEmailTemplate;

type GeneralEmailTemplate = {
  type: "general";
  id: string;
  name: string;
  description?: string;
  content: string;
};

type ProjectEmailTemplate = {
  type: "project_backend";
  id: string;
  projectId: string;
  projectName: string;
  relativePath: string;
  framework: "laravel";
  moduleName?: string;
  content?: string;
  variables: EmailTemplateVariable[];
};
```

Follow existing TypeScript conventions.

---

# 26. Recommended Components

Reuse existing components where possible.

Potential components:

```text
EmailTemplateList
EmailTemplateFilters
EmailTemplateEditor
EmailTemplatePreview
EmailTemplateVariables
EmailTemplateVariablePicker
TemplateTypeSelector
GeneralEmailTemplateBadge
ProjectEmailTemplateBadge
UnsavedChangesDialog
```

Do not create unnecessary abstractions.

---

# 27. API

Follow existing API conventions. Suggested conceptual endpoints:

### General

```http
GET    /api/email-templates
POST   /api/email-templates
GET    /api/email-templates/{id}
PATCH  /api/email-templates/{id}
DELETE /api/email-templates/{id}
```

### Project

```http
GET   /api/projects/{project_id}/email-templates
GET   /api/projects/{project_id}/email-templates/{template_id}
PATCH /api/projects/{project_id}/email-templates/{template_id}
POST  /api/projects/{project_id}/email-templates/scan
```

Do not blindly use these URLs if the existing API architecture has another convention.

---

# 28. Recommended Backend Services

Adapt to the existing backend architecture.

Potential services:

```text
EmailTemplateService
ProjectEmailTemplateService
EmailTemplateScanner
LaravelEmailTemplateScanner
BladeEmailVariableExtractor
EmailTemplatePreviewService
ProjectFilesystemService
```

The scanner architecture should be extensible:

```text
EmailTemplateScanner
  └── LaravelEmailTemplateScanner
```

---

# 29. Database Considerations

Only General Templates need database-owned source content.

Possible:

```text
email_templates
----------------
id
name
description
content
type
created_by
created_at
updated_at
```

Do not create a database copy of every project Blade file unless there is a concrete need.

If project metadata persistence is useful, it may contain:

```text
project_id
relative_path
framework
module_name
```

but filesystem content remains authoritative.

Prefer on-demand discovery when practical to avoid synchronization problems.

---

# 30. Integration With Existing AI Features

RAI Planner already has:

```text
Project System Prompt
Project Rules
Project Codebase Analysis
Task Templates
AI Task Generation
```

The Email Template feature should reuse these systems.

Future AI email generation/editing should receive:

```text
Project System Prompt
+
Project Rules
+
Project Architecture
+
Backend Framework
+
Existing Email Templates
+
Current Template
```

Do not create a second independent project-rules system.

Future actions could include:

```text
Generate Email With AI
Improve Email
Generate Variables
Explain Template
Convert General Template to Laravel
```

These are future-ready ideas and do not need to be implemented unless requested.

---

# 31. Error Handling

Handle at least:

### Missing project

```text
Project not found.
```

### Missing source file

```text
This email template no longer exists in the project.
```

### Permission denied

```text
You do not have permission to edit this project template.
```

### Invalid path

```text
The requested template path is invalid.
```

Do not expose sensitive filesystem details.

### Write failure

```text
Unable to save the project email template.
The source file could not be updated.
```

### Unsupported framework

```text
This project's backend framework is not currently supported.
Laravel email templates are currently supported.
```

---

# 32. Performance

Do not scan the entire project on every page load.

Laravel scanning should be limited to:

```text
resources/views/emails
Modules/*/resources/views/emails
```

Recommended strategy:

- Load template metadata first.
- Read file content when opening editor.
- Extract variables when scanning/opening.
- Avoid loading large files unnecessarily.
- Provide explicit Refresh/Rescan.

---

# 33. Tests

Implement tests before declaring the feature complete.

## General Templates

Test:

- Create
- Read
- Update
- Delete
- Validation
- Authorization
- HTML persistence
- Variable detection
- Preview

## Laravel Scanner

Test:

- Laravel detection
- `resources/views/emails`
- `Modules/*/resources/views/emails`
- Nested directories
- `.blade.php` detection
- Non-email files ignored
- Missing directories
- Multiple modules

## Variable Parser

Test:

```blade
{{ $name }}
{{ $company_name }}
{{ $user->name }}
{{ $employee->email }}
{!! $html !!}
@if($user)
@foreach($employees as $employee)
```

Test:

- Deduplication
- Friendly names
- Raw expression preservation
- No PHP execution

## Filesystem Security

Test:

- Path traversal
- Absolute path injection
- Project boundary escape
- Unauthorized project
- Missing file
- Write failure
- Sensitive path access

## Project Editing

Test:

- Read actual file
- Save actual file
- Re-read after save
- Re-extract variables after save
- External file change handling

---

# 34. Example Discovery

Given:

```text
BenchHR/
├── artisan
├── app/
├── resources/
│   └── views/
│       └── emails/
│           ├── welcome.blade.php
│           ├── password-reset.blade.php
│           └── hr/
│               └── onboarding.blade.php
└── Modules/
    ├── HR/
    │   └── resources/
    │       └── views/
    │           └── emails/
    │               └── employee-welcome.blade.php
    └── Leave/
        └── resources/
            └── views/
                └── emails/
                    └── leave-approved.blade.php
```

The scanner should discover all five templates.

---

# 35. Example Variable Extraction

Source:

```blade
<!DOCTYPE html>
<html>
<body>
    <h1>Welcome {{ $employee->name }}</h1>

    <p>Welcome to {{ $company_name }}.</p>

    <a href="{{ $loginUrl }}">Login</a>

    @if($show_message)
        <p>{{ $message }}</p>
    @endif
</body>
</html>
```

Expected friendly variables:

```text
employee.name
company_name
loginUrl
show_message
message
```

The original Blade expressions must remain available for insertion.

---

# 36. Empty States

No General Templates:

```text
No general email templates yet.

Create your first reusable email template.

[Add Template]
```

No Project Templates:

```text
No backend email templates found.

RAI Planner scans supported project email directories.
```

Unsupported project:

```text
This project's backend framework is not currently supported.
Laravel email templates are currently supported.
```

---

# 37. UX Requirements

Include:

- Loading skeletons
- Saving state
- Scanning state
- Empty states
- Error states
- Unsaved-change warnings
- Responsive layout
- Keyboard navigation
- Accessible labels
- Focus management
- Dark/light theme support
- Consistent RAI Planner styling

Do not introduce a new design system.

---

# 38. Implementation Process

Before writing code, inspect:

1. Existing frontend structure.
2. Sidebar/navigation.
3. Routing.
4. Project model and project path handling.
5. Authentication and authorization.
6. API conventions.
7. Database/migrations.
8. Existing editor components.
9. Existing preview components.
10. Existing filesystem/project scanner.
11. Existing System Prompt implementation.
12. Existing Project Rules implementation.
13. Existing AI task-generation pipeline.
14. Existing test structure.

Reuse existing infrastructure.

Do not duplicate functionality that already exists.

---

# 39. Implementation Phases

## Phase 1 — Architecture

- Inspect existing code.
- Identify reusable infrastructure.
- Design integration points.

## Phase 2 — General Templates

- Migration/model.
- CRUD API.
- List.
- Create.
- Edit.
- Preview.
- Delete.
- Variables.

## Phase 3 — Laravel Scanner

- Laravel detection.
- Standard email directory scanning.
- Module email scanning.
- Metadata.
- Safe filesystem access.

## Phase 4 — Project Editor

- Read actual file.
- Edit actual file.
- Save actual file.
- Variable extraction.
- Variable insertion.
- Preview.

## Phase 5 — Filters

- All.
- General.
- Project Backend.
- Project filter.

## Phase 6 — Security

- Authorization.
- Path validation.
- Project-root boundary.
- Sensitive path protection.

## Phase 7 — Tests

- Backend tests.
- Frontend tests.
- Scanner tests.
- Parser tests.
- Filesystem safety tests.
- Regression tests.

## Phase 8 — UX Polish

- Loading.
- Empty states.
- Unsaved changes.
- Responsive behavior.
- Accessibility.
- Performance.

---

# 40. Definition of Done

- [ ] Email Templates appears in the left menu.
- [ ] Template list works.
- [ ] All/General/Project filters work.
- [ ] Project filtering works.
- [ ] General templates are stored in the database.
- [ ] General templates can be created.
- [ ] General templates can be edited.
- [ ] General templates can be previewed.
- [ ] General templates can be deleted.
- [ ] Laravel projects are detected.
- [ ] `resources/views/emails` is scanned.
- [ ] `Modules/*/resources/views/emails` is scanned.
- [ ] Nested email directories work.
- [ ] Only appropriate Blade email files are discovered.
- [ ] Project templates are read from the actual filesystem.
- [ ] Project edits modify the actual source file.
- [ ] Project source is not database-owned.
- [ ] Project templates cannot be deleted through this feature.
- [ ] Blade variables are detected.
- [ ] Variables are deduplicated.
- [ ] Variables can be inserted.
- [ ] Original Blade syntax is preserved.
- [ ] Preview works safely.
- [ ] Preview never executes arbitrary PHP.
- [ ] Authorization works.
- [ ] Path traversal is prevented.
- [ ] Sensitive files are protected.
- [ ] Unsaved changes are handled.
- [ ] Loading/error/empty states exist.
- [ ] Responsive UI works.
- [ ] Accessibility requirements are met.
- [ ] Backend tests pass.
- [ ] Frontend tests pass.
- [ ] Existing RAI Planner functionality remains intact.

---

# 41. Final Engineering Principle

This is not simply an HTML editor.

It is a bridge between:

```text
RAI Planner
│
├── General Email Templates
│   └── Database
│
└── Project Email Templates
    └── Actual Backend Filesystem
        └── Laravel Blade
```

Always distinguish:

```text
DATABASE-OWNED CONTENT
```

from:

```text
PROJECT-SOURCE-OWNED CONTENT
```

General templates are application data.

Project backend templates are source code.

Never silently convert one ownership model into the other.

The final feature should feel native to RAI Planner, reuse existing architecture, provide a polished developer experience, and safely allow owners to manage reusable templates and real Laravel email source files.
