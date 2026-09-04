import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Link } from 'react-router-dom'
import {
  FolderKanban,
  Search,
  Plus,
  Archive,
  ExternalLink,
  Tag,
  FolderOpen,
  CalendarDays,
  Hash,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'

export function Projects() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    project_path: '',
    tags: '',
    status: 'active',
  })
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      if (status) q.set('status', status)
      const data = await api.get(`/projects?${q.toString()}`)
      setItems(data.items)
      setTotal(data.total)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [search, status])

  async function create() {
    try {
      await api.post('/projects', {
        name: form.name,
        description: form.description,
        project_path: form.project_path,
        tags: form.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        status: form.status,
      })
      setShowCreate(false)
      setForm({ name: '', description: '', project_path: '', tags: '', status: 'active' })
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function disable(id: string) {
    if (!confirm('Disable project?')) return
    await api.post(`/projects/${id}/disable`, {})
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm"
              aria-hidden="true"
            >
              <FolderKanban className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Projects</h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Organize workspaces, track delivery progress, and keep every repository accountable.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary shrink-0 cursor-pointer shadow-sm"
          aria-expanded={showCreate}
          aria-controls="create-project-card"
        >
          {showCreate ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {showCreate ? 'Close' : 'New Project'}
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
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search projects by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input cursor-text pl-10"
            aria-label="Search projects"
          />
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          <label htmlFor="project-status-filter" className="sr-only">
            Filter by status
          </label>
          <div className="relative">
            <select
              id="project-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-[42px] cursor-pointer appearance-none rounded-xl border border-border bg-card py-2 pl-3.5 pr-9 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border focus:border-border focus:outline-none focus:ring-0 focus-visible:border-border focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>

          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold tabular-nums text-muted-foreground sm:inline-flex">
            <Hash className="h-3.5 w-3.5" aria-hidden="true" />
            {total} total
          </span>
        </div>
      </div>

      {/* Mobile total */}
      <p className="text-xs font-medium tabular-nums text-muted-foreground sm:hidden">
        Total: <span className="font-semibold text-foreground">{total}</span> projects
      </p>

      {/* Create form */}
      {showCreate && (
        <div
          id="create-project-card"
          className="card space-y-5 border-primary/10 shadow-glass animate-in motion-reduce:animate-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary border border-primary/10 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Create Project</h3>
                <p className="text-xs font-medium text-muted-foreground">A new workspace for tasks and delivery.</p>
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
              <label htmlFor="project-name" className="text-xs font-semibold tracking-wide text-foreground">
                Name <span className="font-normal text-destructive">*</span>
              </label>
              <input
                id="project-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Acme Platform"
                className="input cursor-text"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-path" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Project Path
              </label>
              <input
                id="project-path"
                value={form.project_path}
                onChange={(e) => setForm({ ...form, project_path: e.target.value })}
                placeholder="/path/to/repo"
                className="input cursor-text font-mono text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-tags" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Tags
              </label>
              <input
                id="project-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="web, backend, priority"
                className="input cursor-text"
              />
              <p className="text-[11px] font-medium text-muted-foreground">Comma separated</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-status" className="text-xs font-semibold tracking-wide text-foreground">
                Status
              </label>
              <div className="relative">
                <select
                  id="project-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input cursor-pointer appearance-none pr-9"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
                <span
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="project-description" className="text-xs font-semibold tracking-wide text-foreground">
                Description
              </label>
              <textarea
                id="project-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief overview of goals, scope, and stakeholders..."
                rows={3}
                className="input min-h-[96px] cursor-text resize-y py-3"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={create} className="btn btn-primary cursor-pointer">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Save Project
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      {loading ? (
        <div className="card flex items-center justify-center gap-2.5 py-12 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading projects...
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                      Name
                    </span>
                  </th>
                  <th>Status</th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                      Tags
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      Path
                    </span>
                  </th>
                  <th className="whitespace-nowrap text-center">Tasks</th>
                  <th className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      Created
                    </span>
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className={`group transition-colors hover:bg-muted/40 ${p.status === 'disabled' ? 'opacity-60' : ''}`}
                  >
                    <td className="min-w-[180px]">
                      <Link
                        to={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1.5 font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm cursor-pointer"
                      >
                        {p.name}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        className={`badge capitalize ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="min-w-[140px] max-w-[220px]">
                      {p.tags?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.tags.map((t: string) => (
                            <span key={t} className="badge badge-muted font-normal">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[220px]">
                      <span
                        title={p.project_path}
                        className="inline-block max-w-full truncate rounded-lg border border-border bg-muted/50 px-2 py-1 font-mono text-xs font-medium text-muted-foreground"
                      >
                        {p.project_path || '—'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="inline-flex min-w-7 justify-center rounded-full bg-primary-light px-2 py-1 text-xs font-bold tabular-nums text-primary border border-primary/10 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
                        {p.task_count ?? 0}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {p.status !== 'disabled' ? (
                        <button
                          type="button"
                          onClick={() => disable(p.id)}
                          className="btn btn-outline btn-sm cursor-pointer gap-1.5 text-destructive hover:bg-red-50 hover:text-destructive hover:border-red-200 dark:hover:bg-red-950/30"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Disable
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Disabled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state - inside card below table */}
          {!items.length && (
            <div className="flex flex-col items-center justify-center gap-3 border-t border-border bg-muted/20 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
                <FolderKanban className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No projects yet</p>
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Create your first project to start organizing tasks and delivery.
                </p>
              </div>
              {!showCreate && (
                <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary mt-1 cursor-pointer">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Project
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
            <span className="tabular-nums">
              Showing <span className="font-semibold text-foreground">{items.length}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span> projects
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              System operational
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
