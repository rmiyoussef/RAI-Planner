# RAI Planner — UI Instructions (read every session before touching frontend)

> Source of truth for how RAI Planner pages look. The task drawer in
> `frontend/src/pages/Tasks.tsx` is the reference implementation — every new
> drawer/editor must copy its shell, width, header, and input styles.
> Design tokens: `design-system/rai-planner/MASTER.md`. Utilities: `frontend/src/styles.css`.

## 1. Global rules

- Light mode only — `Layout.tsx` forces `rai-theme=light`, removes `dark` class.
- No hard-coded fallbacks: `VITE_API_URL` and `VITE_APP_NAME` must come from `.env` (app throws otherwise).
- Auth token in `localStorage rai_token`; API via `src/api/client.ts` (`api.get/post/put/patch/delete`, throws `ApiError` with `status/detail`).
- Icons: `lucide-react` only. Utilities only: `.btn .btn-primary .btn-outline .btn-ghost .btn-sm`, `.card`, `.badge .badge-primary .badge-success .badge-warn .badge-danger .badge-muted`, `.input`, `.table`.
- Inputs never show focus rings: global CSS kills outline/box-shadow/ring on all native inputs (keep `focus:ring-0` classes anyway).
- Every page: loading skeleton/spinner, empty state, error alert with dismiss, `aria-label`s, keyboard Escape closes overlays.

## 2. App shell (`components/Layout.tsx`)

- Sidebar fixed `w-[280px] bg-[#404040]`, light text, `Workspace` label, brand top-left (company logo or random-icon fallback), `BUSINESS EDITION` pill, footer with owner + Sign out (confirm dialog).
- Nav items: Home `/`, Projects `/projects`, Tasks `/tasks`, Email Templates `/email-templates` (Mail icon), Users `/users`, Settings `/settings`. Active = transparent bg + `border-white/40`.
- Main: `w-[95%] mx-auto py-6 lg:py-8` + `<Outlet/>`. Footer: `© 2026 Squadify Lab · {VITE_APP_NAME} · Rami Youssef · v{version}`.
- Page header pattern: icon box `flex h-9 w-9 rounded-xl bg-primary text-white` + `h1 text-2xl font-bold tracking-tight sm:text-[1.75rem]` + `p max-w-2xl text-sm text-muted-foreground`. Primary action button top-right.

## 3. Drawer — THE pattern (copy from `Tasks.tsx`, do not invent)

Shell (view task L973-979, create L648-650):

```jsx
<div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="...-title">
  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={close} aria-hidden="true" />
  <div className="relative flex h-dvh w-full flex-col bg-card shadow-2xl border-l border-border dark:bg-slate-900 lg:w-[60vw] lg:max-w-[65vw] animate-in motion-reduce:animate-none">
```

- Width: full on mobile, `lg:w-[60vw] lg:max-w-[65vw]` on desktop. Centered modals (`max-w-md/sm/3xl/4xl/7xl`) are only for confirms and file previews — never for editors.
- Header: `flex shrink-0 items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent px-5 py-4 dark:from-white/[0.04] dark:bg-slate-900 sm:px-6`; left = `h-9 w-9 rounded-xl bg-primary text-white` icon + title `text-[15px] font-semibold tracking-tight` + subtitle `text-xs font-medium text-muted-foreground`; close = `inline-flex h-9 w-9 rounded-xl border border-border bg-card text-muted-foreground shadow-soft hover:bg-muted hover:text-foreground`.
- Body: `flex-1 overflow-y-auto bg-background px-5 py-6 sm:px-6 space-y-6`.
- Field: wrapper `space-y-2`; label `flex items-center gap-2 text-sm font-semibold` with icon chip `flex h-6 w-6 items-center justify-center rounded-lg bg-{color}-500/10 text-{color}-600` + `h-3.5 w-3.5` icon; required = `<span className="text-destructive">*</span>`; helper = `text-xs text-muted-foreground`.
- Input: `input h-11 text-[15px] font-medium bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-all`. Textarea: same + `min-h-[280px] cursor-text resize-y py-3.5 text-[14px] leading-relaxed` (+ `font-mono` for code). Select: same + `cursor-pointer appearance-none pr-9` + `ChevronDown` absolute right.
- Footer: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 border-t border-border` with `btn btn-ghost` Cancel + `btn btn-primary` action.
- Confirm dialogs inside drawers use `z-[80]` centered `max-w-md` cards.

## 4. Email Templates page (`pages/EmailTemplates.tsx`)

- Header: Mail icon box + `Email Templates` + `Manage reusable email templates and templates discovered from backend projects.` + `[+ Add Template]`.
- Filters card: type tabs All / General Templates / Project Backend Templates (`btn-sm`, active = `btn-primary`) + `Project: [All Projects ▼]` select + Refresh/Rescan button (`scanning` spinner state).
- List is grouped and collapsible (same chevron pattern as `GroupedTable`): `General Templates` group (database-owned) first, then one group per module — `No module` (`resources/views/emails`) first, then `Module: HR` etc. alphabetically. Inside each module, sub-groups by folder from the relative path (`Top level files`, then `Folder: hr/` etc., root first). Group headers show badge/icon + count + project sub (`{project} · resources/views/emails`). No Actions column — clicking a template name opens the editor (preview lives in the editor's Preview tab; rescan via the filter-bar Refresh button).
- Badges: `GENERAL` = `badge-primary`, `PROJECT` = `badge-warn`. Ownership line in footer: `DATABASE-OWNED vs PROJECT-SOURCE-OWNED`.
- General row actions: Edit / Preview / Delete. Project row actions: Edit / Preview / Refresh. No project-file delete.
- Empty states: general → `No general email templates yet. Create your first reusable email template. [Add Template]`; project → `No backend email templates found. RAI Planner scans supported project email directories.`; unsupported → Laravel-only message.
- Editor = task-style drawer (`components/email/EmailTemplateEditor.tsx`): Mail icon header, GENERAL/PROJECT badge, Saved / Unsaved-changes badges, Edit|Preview tab pill, Save in header only (no footer Cancel/Save bar — removed per request). Fields: Template Name (Type icon, violet chip), Description (FileText, emerald), HTML/Blade Content (Code2, orange) with search + Copy. Editor is fixed-height (`h-[380px]`) with its own scroll (never grows the page): HTML tag toolbar (H1 H2 P B I Link Button List Table Img HR — wraps selection or inserts snippet and selects the placeholder, Tab inserts 2 spaces), synced line-number gutter, mono `text-[14px] leading-relaxed` area. Search highlights matches in-editor (yellow marks, orange current, `n/m` counter, Enter/Shift+Enter prev/next, Esc clears) via a scroll-synced transparent-textarea overlay. Unknown manually-added variables (not in the original set) show a red warning under the editor. A Template summary card under the editor shows variables used, known variables, chars/lines, last edit time, all-used check, unused + in-use lists. Live preview panel is always open below the editor (never collapsed). Variables panel right (`xl:grid-cols-[1fr_280px]`), search + Insert buttons. Project saves show `Save project file? This will modify the actual project file: {relativePath}` confirm; dirty close shows discard confirm.
- Preview: sandboxed `<iframe sandbox="" srcDoc>` + `Mock data — never executes PHP` badge; **variables always replaced with dummy data** (`Acme Corporation`, `John Doe`, `john@example.com`, `https://example.com/login`, unknown → `Sample Value`); backend `render_general_preview`/`render_blade_preview` is authoritative, frontend `previewGeneralClient`/`previewBladeClient` mirrors it live. Blade `{{ }}`, `{!! !!}`, `{{{ }}}`, with or without `$`, all substitute.
- Variables: general `{name}` only; Blade keeps raw syntax (`{{ $employee->name }}` friendly `employee.name`), never converts Blade to `{name}`.
