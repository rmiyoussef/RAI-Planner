import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { MarkdownPreview } from '../components/Markdown'
import { useSearchParams } from 'react-router-dom'
import {
  CheckSquare,
  Plus,
  Copy,
  Download,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  Filter,
  CalendarDays,
  User,
  FolderKanban,
  Tag,
  Clock3,
  Hash,
  Pencil,
  Save,
  Eye,
  FileText,
  History,
  Activity,
  Bot,
  ListChecks,
  ChevronDown,
} from 'lucide-react'

function statusTone(status: string) {
  switch (status) {
    case 'todo':
      return 'badge badge-muted capitalize'
    case 'in_progress':
      return 'badge badge-primary capitalize'
    case 'in_review':
      return 'badge badge-warn capitalize'
    case 'done':
      return 'badge badge-success capitalize'
    case 'archived':
      return 'badge bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 capitalize'
    default:
      return 'badge badge-muted capitalize'
  }
}

function priorityTone(priority: string) {
  switch (priority) {
    case 'low':
      return 'badge bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 capitalize'
    case 'medium':
      return 'badge badge-primary capitalize'
    case 'high':
      return 'badge badge-warn capitalize'
    case 'critical':
      return 'badge badge-danger capitalize'
    default:
      return 'badge badge-muted capitalize'
  }
}

const GENERATING_STAGES = [
  'Reading project',
  'Reading .brain',
  'Building context',
  'Analyzing task',
  'Generating task',
  'Saving version',
]

export function Tasks() {
  const [searchParams] = useSearchParams()
  const initialProject = searchParams.get('project_id') || ''
  const [items, setItems] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [filterProject, setFilterProject] = useState(initialProject)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    assigned_to: '',
    tags: '',
  })
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerTab, setDrawerTab] = useState<'edit' | 'preview'>('edit')
  const [versions, setVersions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (filterProject) q.set('project_id', filterProject)
      const data = await api.get(`/tasks?${q.toString()}`)
      setItems(data.items ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMeta() {
    try {
      const p = await api.get('/projects?limit=100')
      setProjects(p.items ?? [])
      const u = await api.get('/users')
      setUsers(u.items ?? [])
      if (!form.project_id && p.items?.[0]) setForm((f) => ({ ...f, project_id: initialProject || p.items[0].id }))
    } catch {}
  }

  useEffect(() => {
    load()
    loadMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject])

  useEffect(() => {
    if (initialProject) setFilterProject(initialProject)
  }, [initialProject])

  // lock body scroll when drawer open
  useEffect(() => {
    if (selected) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected])

  async function create() {
    try {
      setError('')
      await api.post('/tasks', {
        project_id: form.project_id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: form.status,
        assigned_to: form.assigned_to || null,
        tags: form.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      setShowCreate(false)
      setForm((f) => ({ ...f, title: '', description: '', tags: '' }))
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function openTask(id: string) {
    try {
      setError('')
      const t = await api.get(`/tasks/${id}`)
      setSelected(t)
      setEditForm(t)
      setIsEditing(false)
      setDrawerTab('edit')
      const vs = await api.get(`/tasks/${id}/versions`)
      setVersions(vs ?? [])
      const acts = await api.get(`/tasks/${id}/activities`)
      setActivities(acts ?? [])
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function saveEdit() {
    try {
      setError('')
      const updated = await api.put(`/tasks/${selected.id}`, {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        status: editForm.status,
        assigned_to: editForm.assigned_to || null,
        tags:
          typeof editForm.tags === 'string'
            ? editForm.tags
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : editForm.tags,
      })
      setSelected(updated)
      const vs = await api.get(`/tasks/${selected.id}/versions`)
      setVersions(vs ?? [])
      const acts = await api.get(`/tasks/${selected.id}/activities`)
      setActivities(acts ?? [])
      load()
      setIsEditing(false)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function generate() {
    if (selected?.ai_generated) return
    setGenerating(true)
    setError('')
    try {
      const res = await api.post(`/tasks/${selected.id}/generate`, {})
      const updated = res.task ?? res
      setSelected(updated)
      setEditForm(updated)
      setVersions(await api.get(`/tasks/${selected.id}/versions`))
      setActivities(await api.get(`/tasks/${selected.id}/activities`))
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function copy() {
    navigator.clipboard.writeText(selected?.description || '')
  }

  function download() {
    const blob = new Blob([selected?.description || ''], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected?.title || 'task'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedProjectName =
    selected?.project_name || projects.find((p) => p.id === selected?.project_id)?.name || selected?.project_id || '—'
  const assignedUserName =
    selected?.assigned_user_name || users.find((u) => u.id === selected?.assigned_to)?.full_name || (selected?.assigned_to ? selected.assigned_to : 'Unassigned')

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8 animate-in motion-reduce:animate-none">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm" aria-hidden="true">
              <CheckSquare className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Tasks</h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Plan execution, track delivery status, and turn requirements into shippable work.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary shrink-0 cursor-pointer shadow-sm"
          aria-expanded={showCreate}
          aria-controls="create-task-card"
        >
          {showCreate ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {showCreate ? 'Close' : 'Create New Task'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto shrink-0 cursor-pointer rounded-lg p-1 text-red-600 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-900/40"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="hidden sm:inline">Filters</span>
        </div>

        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <label htmlFor="task-project-filter" className="sr-only">
              Filter by project
            </label>
            <FolderKanban className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <select
              id="task-project-filter"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="h-[42px] w-full cursor-pointer appearance-none rounded-xl border border-border bg-card py-2 pl-10 pr-9 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold tabular-nums text-muted-foreground sm:self-auto">
            <Hash className="h-3.5 w-3.5" aria-hidden="true" />
            {items.length} tasks
          </span>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          id="create-task-card"
          className="card space-y-5 border-primary/10 shadow-glass animate-in motion-reduce:animate-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-primary-light text-primary">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Create Task</h3>
                <p className="text-xs font-medium text-muted-foreground">Add a new task to your project backlog.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn btn-ghost btn-sm cursor-pointer"
              aria-label="Close create form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="task-project" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Project <span className="font-normal text-destructive">*</span>
              </label>
              <div className="relative">
                <select
                  id="task-project"
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  className="input cursor-pointer appearance-none pr-9"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-title" className="text-xs font-semibold tracking-wide text-foreground">
                Title <span className="font-normal text-destructive">*</span>
              </label>
              <input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Implement real-time trade blotter"
                className="input cursor-text"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="task-description" className="text-xs font-semibold tracking-wide text-foreground">
                Description (Markdown)
              </label>
              <textarea
                id="task-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Describe goals, acceptance criteria, and technical notes in Markdown…"
                className="input min-h-[112px] cursor-text resize-y py-3"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-priority" className="text-xs font-semibold tracking-wide text-foreground">
                Priority
              </label>
              <div className="relative">
                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="input cursor-pointer appearance-none pr-9"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-status" className="text-xs font-semibold tracking-wide text-foreground">
                Status
              </label>
              <div className="relative">
                <select
                  id="task-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input cursor-pointer appearance-none pr-9"
                >
                  <option value="todo">todo</option>
                  <option value="in_progress">in_progress</option>
                  <option value="in_review">in_review</option>
                  <option value="done">done</option>
                  <option value="archived">archived</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-assigned" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Assigned To
              </label>
              <div className="relative">
                <select
                  id="task-assigned"
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="input cursor-pointer appearance-none pr-9"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.github_username})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-tags" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Tags
              </label>
              <input
                id="task-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="comma separated"
                className="input cursor-text"
              />
              <p className="text-[11px] font-medium text-muted-foreground">Comma separated values</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={create} className="btn btn-primary cursor-pointer">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card flex items-center justify-center gap-2.5 py-12 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading tasks...
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      Title
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                      Project
                    </span>
                  </th>
                  <th>Priority</th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                      Assigned To
                    </span>
                  </th>
                  <th className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      Created At
                    </span>
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTask(t.id)}
                    className="group cursor-pointer transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openTask(t.id)
                      }
                    }}
                  >
                    <td className="min-w-[220px] max-w-[320px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground group-hover:text-primary">{t.title}</span>
                        {t.ai_generated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 border border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900">
                            <Bot className="h-3 w-3" aria-hidden="true" />
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-sm font-medium text-muted-foreground">{t.project_name || t.project_id}</td>
                    <td className="whitespace-nowrap">
                      <span className={priorityTone(t.priority)}>{t.priority}</span>
                    </td>
                    <td className="whitespace-nowrap text-sm font-medium text-muted-foreground">{t.assigned_user_name || '—'}</td>
                    <td className="whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={statusTone(t.status)}>{String(t.status).replace('_', ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!items.length && (
            <div className="flex flex-col items-center justify-center gap-3 border-t border-border bg-muted/20 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
                <ListChecks className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No tasks yet</p>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {filterProject ? 'No tasks match this project filter. Try a different project or create a new task.' : 'Create your first task to start tracking work for your projects.'}
                </p>
              </div>
              {!showCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="btn btn-primary mt-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Task
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
            <span className="tabular-nums">
              Showing <span className="font-semibold text-foreground">{items.length}</span> tasks
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Click row to inspect
            </span>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title">
          {/* Overlay with glassmorphism */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />

          {/* Panel: 60vw on desktop, full-screen on mobile */}
          <div className="relative flex h-full w-full flex-col bg-white shadow-glass border-l border-border dark:bg-slate-900 lg:w-[60vw] lg:max-w-none animate-in motion-reduce:animate-none">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-white/80 px-5 py-4 backdrop-blur-xl dark:bg-slate-900/80 sm:px-6">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusTone(selected.status)}>{String(selected.status).replace('_', ' ')}</span>
                  <span className={priorityTone(selected.priority)}>{selected.priority}</span>
                  {selected.ai_generated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      AI Generated
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    <Hash className="h-3 w-3" aria-hidden="true" />v{selected.version}
                  </span>
                </div>
                <h2 id="task-drawer-title" className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {selected.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto bg-background px-5 py-6 sm:px-6 space-y-6">
              {/* Metadata */}
              <section className="card space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Metadata
                  </h3>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="btn btn-outline btn-sm cursor-pointer gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit Task
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-primary">Editing</span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Project</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {selectedProjectName}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {assignedUserName}
                    </p>
                    {selected.assigned_to && <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{selected.assigned_to}</p>}
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selected.tags?.length ? (
                        selected.tags.map((tag: string) => (
                          <span key={tag} className="badge badge-muted font-normal">
                            <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums text-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {new Date(selected.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Updated</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums text-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {new Date(selected.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Edit form */}
                {isEditing && (
                  <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary-light/40 p-4 dark:bg-primary/10">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <label htmlFor="edit-title" className="text-xs font-semibold tracking-wide text-foreground">
                          Title
                        </label>
                        <input
                          id="edit-title"
                          value={editForm.title ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="input cursor-text bg-card"
                          placeholder="Task title"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="edit-priority" className="text-xs font-semibold tracking-wide text-foreground">
                          Priority
                        </label>
                        <div className="relative">
                          <select
                            id="edit-priority"
                            value={editForm.priority ?? 'medium'}
                            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                            className="input cursor-pointer appearance-none bg-card pr-9"
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                            <option value="critical">critical</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="edit-status" className="text-xs font-semibold tracking-wide text-foreground">
                          Status
                        </label>
                        <div className="relative">
                          <select
                            id="edit-status"
                            value={editForm.status ?? 'todo'}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            className="input cursor-pointer appearance-none bg-card pr-9"
                          >
                            <option value="todo">todo</option>
                            <option value="in_progress">in_progress</option>
                            <option value="in_review">in_review</option>
                            <option value="done">done</option>
                            <option value="archived">archived</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="edit-assigned" className="text-xs font-semibold tracking-wide text-foreground">
                          Assigned
                        </label>
                        <div className="relative">
                          <select
                            id="edit-assigned"
                            value={editForm.assigned_to || ''}
                            onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                            className="input cursor-pointer appearance-none bg-card pr-9"
                          >
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="edit-tags" className="text-xs font-semibold tracking-wide text-foreground">
                          Tags
                        </label>
                        <input
                          id="edit-tags"
                          value={Array.isArray(editForm.tags) ? editForm.tags.join(', ') : (editForm.tags ?? '')}
                          onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                          placeholder="comma separated"
                          className="input cursor-text bg-card"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setIsEditing(false)} className="btn btn-ghost cursor-pointer">
                        Cancel
                      </button>
                      <button type="button" onClick={saveEdit} className="btn btn-primary cursor-pointer">
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Markdown editor */}
              <section className="card space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Markdown
                  </h3>

                  <div className="inline-flex rounded-xl border border-border bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('edit')}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${drawerTab === 'edit' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
                      aria-pressed={drawerTab === 'edit'}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('preview')}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${drawerTab === 'preview' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
                      aria-pressed={drawerTab === 'preview'}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Preview
                    </button>
                  </div>
                </div>

                {drawerTab === 'edit' ? (
                  <>
                    <textarea
                      rows={12}
                      value={isEditing ? (editForm.description ?? '') : (selected.description ?? '')}
                      onChange={(e) => (isEditing ? setEditForm({ ...editForm, description: e.target.value }) : null)}
                      readOnly={!isEditing}
                      placeholder={isEditing ? 'Write task details in Markdown…' : 'No description'}
                      className={`input min-h-[280px] cursor-text resize-y py-3 font-mono text-[13px] leading-relaxed ${!isEditing ? 'bg-muted/30 text-muted-foreground' : 'bg-card'}`}
                    />
                    {isEditing && (
                      <div className="flex justify-end">
                        <button type="button" onClick={saveEdit} className="btn btn-primary cursor-pointer">
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save description
                        </button>
                      </div>
                    )}
                    {!isEditing && <p className="text-xs font-medium text-muted-foreground">Enable editing via the Metadata section to modify this task.</p>}
                  </>
                ) : (
                  <div className="min-h-[180px] rounded-xl border border-border bg-muted/20 p-4">
                    <MarkdownPreview content={isEditing ? (editForm.description ?? '') : (selected.description ?? '')} />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className="btn btn-outline btn-sm cursor-pointer gap-1.5">
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy
                  </button>
                  <button type="button" onClick={download} className="btn btn-outline btn-sm cursor-pointer gap-1.5">
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download
                  </button>
                </div>
              </section>

              {/* AI Generation */}
              <section className="card space-y-4 border-violet-200/50 dark:border-violet-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm" aria-hidden="true">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Smart Engineering Agent</h3>
                    <p className="text-xs font-medium text-muted-foreground">Let AI rewrite the task from project context.</p>
                  </div>
                </div>

                {generating && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      Generating — please wait
                    </div>
                    <ol className="mt-3 space-y-1.5">
                      {GENERATING_STAGES.map((stage, idx) => (
                        <li key={stage} className="flex items-center gap-2 text-xs font-medium text-violet-700/80 dark:text-violet-300/80">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-violet-600 shadow-sm border border-violet-200 dark:bg-violet-900 dark:text-violet-200">
                            {idx + 1}
                          </span>
                          {stage}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-violet-200 dark:bg-violet-900">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-violet-600" />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!!selected.ai_generated || generating}
                  onClick={generate}
                  className="btn btn-primary w-full cursor-pointer justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  Generate task With AI
                </button>

                {selected.ai_generated ? (
                  <p className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
                    <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                    AI generation has already been performed for this task.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed font-medium text-muted-foreground">
                    AI will inspect project and .brain to rewrite task. This can only be done once per task.
                  </p>
                )}
              </section>

              {/* Activity */}
              <section className="card space-y-4">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Activity
                </h3>

                {activities.length ? (
                  <div className="relative space-y-0">
                    <div className="absolute left-2 top-2 h-[calc(100%-16px)] w-px bg-border" aria-hidden="true" />
                    <ul className="space-y-4">
                      {activities.map((a) => (
                        <li key={a.id} className="relative flex gap-3 pl-6">
                          <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                                {new Date(a.timestamp).toLocaleString()}
                              </span>
                              <span className="text-xs font-semibold text-foreground">{a.action}</span>
                              <span className="badge badge-muted text-[11px]">v{a.version}</span>
                            </div>
                            {a.changes?.length ? (
                              <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                                {a.changes.map((c: any, i: number) => (
                                  <li key={i} className="font-mono text-[12px]">
                                    <span className="font-semibold text-foreground">{c.field}:</span> {String(c.old_value)} →{' '}
                                    <span className="font-semibold text-foreground">{String(c.new_value)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
                    No activity
                  </p>
                )}
              </section>

              {/* Versions Timeline */}
              <section className="card space-y-4">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Timeline — Versions
                </h3>

                {versions.length ? (
                  <div className="space-y-3">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className={`rounded-2xl border p-4 transition-colors ${v.version === selected.version ? 'border-primary/20 bg-primary-light/30 dark:bg-primary/10' : 'border-border bg-muted/20'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${v.version === selected.version ? 'bg-primary text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
                                v{v.version}
                              </span>
                              {v.title}
                            </span>
                          </p>
                          <span className="whitespace-nowrap font-mono text-[11px] font-medium text-muted-foreground">
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                        </div>

                        <details className="mt-3 group">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground border border-border shadow-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            View description
                            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                          </summary>
                          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-3 font-mono text-xs leading-relaxed text-foreground">
                            {String(v.description ?? '').slice(0, 1000)}
                          </pre>
                        </details>

                        {v.version !== selected.version && (
                          <p className="mt-2 text-[11px] font-medium text-muted-foreground">Read-only (only latest can be edited)</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
                    No versions
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
