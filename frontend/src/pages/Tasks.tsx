import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { api } from '../api/client'
import { MarkdownPreview } from '../components/Markdown'
import { useSearchParams } from 'react-router-dom'
import { statusLabel, priorityLabel, statusTone, priorityTone, humanize } from '../utils/taskLabels'
import { TaskListView } from '../components/tasks/TaskListView'
import type { TaskItem } from '../components/tasks/types'
import { useAuth } from '../store/AuthContext'
import {
  CheckSquare,
  Plus,
  Copy,
  Download,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
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
  Check,
} from 'lucide-react'

const GENERATING_STAGES = [
  'Reading project',
  'Reading .brain',
  'Building context',
  'Analyzing task',
  'Generating task',
  'Saving version',
]

export function Tasks() {
  const { owner } = useAuth()
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
  const [drawerTab, setDrawerTab] = useState<'edit' | 'preview'>('preview')
  const [versions, setVersions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const saveTimeoutRef = useRef<number | null>(null)

  // Title inline editing
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Description editing
  const [descDraft, setDescDraft] = useState('')
  const [descSaveStatus, setDescSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const descTimeoutRef = useRef<number | null>(null)

  // Tags editing
  const [tagsDraft, setTagsDraft] = useState('')
  const [tagsEditing, setTagsEditing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      // fetch all pages (limit 100 max) to support 1000+ tasks with client pagination
      const all: any[] = []
      let page = 1
      let total = 0
      do {
        const q = new URLSearchParams()
        if (filterProject) q.set('project_id', filterProject)
        q.set('page', String(page))
        q.set('limit', '100')
        const data = await api.get(`/tasks?${q.toString()}`)
        all.push(...(data.items ?? []))
        total = data.total ?? (data.items?.length ?? 0)
        if ((data.items?.length ?? 0) < 100) break
        page++
        if (page > 20) break // safety
      } while (all.length < total)
      setItems(all)
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

  // Sync drafts when selected changes
  useEffect(() => {
    if (selected) {
      setTitleDraft(selected.title ?? '')
      setDescDraft(selected.description ?? '')
      setTagsDraft(Array.isArray(selected.tags) ? selected.tags.join(', ') : (selected.tags ?? ''))
      setTitleEditing(false)
      setTagsEditing(false)
      setSaveStatus('idle')
      setDescSaveStatus('idle')
      setSaveError('')
    }
  }, [selected?.id])

  // Focus title input when editing starts
  useEffect(() => {
    if (titleEditing && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [titleEditing])

  // Debounced description auto-save (800ms after typing stops)
  useEffect(() => {
    if (!selected || drawerTab !== 'edit') return
    if (descDraft === (selected.description ?? '')) return
    if (descTimeoutRef.current) window.clearTimeout(descTimeoutRef.current)
    descTimeoutRef.current = window.setTimeout(() => {
      void saveDescriptionDebounced()
    }, 800)
    return () => {
      if (descTimeoutRef.current) window.clearTimeout(descTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descDraft])

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
      setDrawerTab('preview')
      const vs = await api.get(`/tasks/${id}/versions`)
      setVersions(vs ?? [])
      const acts = await api.get(`/tasks/${id}/activities`)
      setActivities(acts ?? [])
    } catch (e: any) {
      setError(e.message)
    }
  }

  // Central patch helper with optimistic UI and save indicators
  const patchTask = useCallback(async (
    patch: Record<string, any>,
    optimistic?: Record<string, any>
  ) => {
    if (!selected) return
    // Don't send if no actual change
    const hasChange = Object.keys(patch).some((k) => {
      const oldVal = selected[k]
      const newVal = patch[k]
      if (Array.isArray(oldVal) && Array.isArray(newVal)) {
        return JSON.stringify(oldVal) !== JSON.stringify(newVal)
      }
      return oldVal !== newVal
    })
    if (!hasChange) return

    const prev = { ...selected }
    // Optimistic update
    if (optimistic) {
      setSelected((s: any) => s ? { ...s, ...optimistic } : s)
    } else {
      setSelected((s: any) => s ? { ...s, ...patch } : s)
    }
    setSaveStatus('saving')
    setSaveError('')

    try {
      const updated = await api.patch(`/tasks/${selected.id}`, patch)
      setSelected(updated)
      // Refresh versions/activities silently (no loading flash)
      try {
        const vs = await api.get(`/tasks/${selected.id}/versions`)
        setVersions(vs ?? [])
        const acts = await api.get(`/tasks/${selected.id}/activities`)
        setActivities(acts ?? [])
      } catch {}
      setSaveStatus('saved')
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = window.setTimeout(() => setSaveStatus('idle'), 2000)
      load()
      return updated
    } catch (e: any) {
      // Revert optimistic
      setSelected(prev)
      setSaveStatus('error')
      setSaveError(e.message || 'Could not save changes. Please try again.')
      throw e
    }
  }, [selected])

  // Title handlers
  async function saveTitle() {
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setTitleDraft(selected?.title ?? '')
      setTitleEditing(false)
      return
    }
    if (trimmed === selected?.title) {
      setTitleEditing(false)
      return
    }
    try {
      await patchTask({ title: trimmed }, { title: trimmed })
      setTitleEditing(false)
    } catch {
      // keep editing state so user doesn't lose input
    }
  }

  function cancelTitle() {
    setTitleDraft(selected?.title ?? '')
    setTitleEditing(false)
  }

  // Description debounced save
  async function saveDescriptionDebounced() {
    if (descDraft === (selected?.description ?? '')) return
    setDescSaveStatus('saving')
    try {
      await patchTask({ description: descDraft }, { description: descDraft })
      setDescSaveStatus('saved')
      setTimeout(() => setDescSaveStatus('idle'), 2000)
    } catch {
      setDescSaveStatus('error')
    }
  }

  async function saveDescriptionBlur() {
    if (descTimeoutRef.current) {
      window.clearTimeout(descTimeoutRef.current)
      descTimeoutRef.current = null
    }
    if (descDraft !== (selected?.description ?? '')) {
      await saveDescriptionDebounced()
    }
  }

  // Tags
  async function saveTags() {
    const parsed = tagsDraft.split(',').map((s) => s.trim()).filter(Boolean)
    const current = selected?.tags ?? []
    if (JSON.stringify(parsed) === JSON.stringify(current)) {
      setTagsEditing(false)
      return
    }
    try {
      await patchTask({ tags: parsed }, { tags: parsed })
      setTagsEditing(false)
    } catch {
      // keep editing
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

  // Save indicator component
  const SaveIndicator = ({ status }: { status: typeof saveStatus }) => {
    if (status === 'idle') return null
    if (status === 'saving') return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>
    if (status === 'saved') return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> Saved</span>
    return <span className="text-xs font-medium text-destructive">Could not save</span>
  }

  // Adapt backend tasks -> TaskItem for TaskListView
  const taskItems: TaskItem[] = useMemo(() => {
    return items.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status ?? 'todo',
      priority: t.priority,
      assigned_to: t.assigned_to ?? null,
      assigned_user_name: t.assigned_user_name ?? null,
      assignees: t.assigned_to ? [{ id: t.assigned_to, name: t.assigned_user_name ?? t.assigned_to }] : [],
      labels: t.tags ?? [],
      tags: t.tags ?? [],
      module: t.project_name ?? t.project_id ?? '—',
      project_id: t.project_id,
      project_name: t.project_name,
      iteration: (t as any).iteration ?? 'Backlog',
      created_at: t.created_at,
      updated_at: t.updated_at,
      version: t.version,
      ai_generated: t.ai_generated,
      description: t.description,
    }))
  }, [items])

  const activeProjectName = useMemo(() => {
    if (!filterProject) return 'All Projects'
    return projects.find((p) => p.id === filterProject)?.name ?? filterProject
  }, [filterProject, projects])

  async function handleInlinePatch(id: string, patch: Record<string, any>) {
    try {
      await api.patch(`/tasks/${id}`, patch)
      load()
      // if drawer open for this task, refresh it
      if (selected?.id === id) {
        const updated = await api.get(`/tasks/${id}`)
        setSelected(updated)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleCreateInGroup(payload: { title: string; status: string; project_id?: string }) {
    // payload from GroupedTable: status is group key, title may be passed as second arg via hack
    // GroupedTable calls onCreateInGroup(status, title) — we handle both signatures
    let title = (payload as any).title
    let status = (payload as any).status
    // if called as (status, title)
    if (typeof payload === 'string') {
      status = payload as unknown as string
      title = (arguments[1] as string) ?? `New task in ${status}`
    }
    // fallback project
    const projectId = (payload as any).project_id ?? filterProject ?? projects[0]?.id
    if (!projectId) {
      setError('Select a project first to create tasks')
      return
    }
    try {
      await api.post('/tasks', {
        project_id: projectId,
        title: title || `New ${status} task`,
        description: '',
        priority: 'medium',
        status: mapGroupToStatus(status),
        assigned_to: null,
        tags: [],
      })
      load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  function mapGroupToStatus(group: string): string {
    // map Plane group names back to backend statuses
    const m: Record<string, string> = {
      planning: 'todo',
      testing: 'in_review',
      'on_hold': 'archived',
      completed: 'done',
      todo: 'todo',
      in_progress: 'in_progress',
      in_review: 'in_review',
      done: 'done',
      archived: 'archived',
    }
    return m[group] ?? 'todo'
  }

  return (
    <>
      <div className="flex flex-col gap-4 h-[calc(100dvh-125px)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between shrink-0">
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

      {/* Project scope selector (keeps existing UX, complements Saved Views) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="relative w-full sm:max-w-[240px]">
          <label htmlFor="task-project-filter" className="sr-only">Project scope</label>
          <FolderKanban className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <select
            id="task-project-filter"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-[38px] w-full cursor-pointer appearance-none rounded-xl border border-border bg-card py-2 pl-10 pr-9 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div
          id="create-task-card"
          className="card space-y-5 border-primary/10 shadow-glass animate-in motion-reduce:animate-none shrink-0 max-h-[40vh] overflow-auto"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-primary-light text-primary dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
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
                  <option value="low">{priorityLabel('low')}</option>
                  <option value="medium">{priorityLabel('medium')}</option>
                  <option value="high">{priorityLabel('high')}</option>
                  <option value="critical">{priorityLabel('critical')}</option>
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
                  <option value="todo">{statusLabel('todo')}</option>
                  <option value="in_progress">{statusLabel('in_progress')}</option>
                  <option value="in_review">{statusLabel('in_review')}</option>
                  <option value="done">{statusLabel('done')}</option>
                  <option value="archived">{statusLabel('archived')}</option>
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

      {/* Plane/Linear-style TaskListView — fills height, only tasks scroll */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-card py-12 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading tasks...
          </div>
        ) : (
          <TaskListView
            tasks={taskItems}
            users={users}
            projects={projects}
            activeProjectId={filterProject || null}
            activeProjectName={activeProjectName}
            ownerId={owner?.id ?? null}
            onTaskClick={(t) => openTask(t.id)}
            onTaskPatch={handleInlinePatch}
            onTaskCreate={handleCreateInGroup}
            workflowsCount={projects.length}
          />
        )}
      </div>
      </div>

      {/* Drawer — 50-65% width on desktop - outside animated container to avoid fixed-offset white gap */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <div className="relative flex h-dvh w-full flex-col bg-card shadow-xl border-l border-border dark:bg-slate-900 lg:w-[60vw] lg:max-w-[65vw] animate-in motion-reduce:animate-none">
            {/* Header with inline title editing — solid, no translucency gap */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 dark:bg-slate-900 sm:px-6">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusTone(selected.status)}>{statusLabel(selected.status)}</span>
                  <span className={priorityTone(selected.priority)}>{priorityLabel(selected.priority)}</span>
                  {selected.ai_generated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      AI Generated
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    <Hash className="h-3 w-3" aria-hidden="true" />v{selected.version}
                  </span>
                  <SaveIndicator status={saveStatus} />
                  {saveError && <span className="text-xs font-medium text-destructive">{saveError}</span>}
                </div>
                {/* Inline editable title */}
                {titleEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={titleInputRef}
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void saveTitle() }
                        if (e.key === 'Escape') { e.preventDefault(); cancelTitle() }
                      }}
                      onBlur={() => void saveTitle()}
                      className="input h-9 flex-1 bg-card text-base font-bold"
                      aria-label="Edit task title"
                      maxLength={300}
                    />
                    <button
                      type="button"
                      onClick={() => void saveTitle()}
                      className="btn btn-primary btn-sm shrink-0"
                      aria-label="Save title"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelTitle}
                      className="btn btn-ghost btn-sm shrink-0"
                      aria-label="Cancel title edit"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setTitleDraft(selected.title); setTitleEditing(true) }}
                    className="group flex w-full items-center gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    aria-label="Click to edit title"
                  >
                    <h2 id="task-drawer-title" className="flex-1 truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
                      {selected.title}
                    </h2>
                    <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true" />
                  </button>
                )}
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
              {/* Metadata — auto-save fields */}
              <section className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Metadata
                  </h3>
                  <SaveIndicator status={saveStatus} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Project (read-only) */}
                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Project</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {selectedProjectName}
                    </p>
                  </div>

                  {/* Priority — auto-save */}
                  <div className="space-y-1.5">
                    <label htmlFor="field-priority" className="text-xs font-semibold tracking-wide text-foreground">Priority</label>
                    <div className="relative">
                      <select
                        id="field-priority"
                        value={selected.priority ?? 'medium'}
                        onChange={(e) => void patchTask({ priority: e.target.value })}
                        className="input cursor-pointer appearance-none pr-9"
                      >
                        <option value="low">{priorityLabel('low')}</option>
                        <option value="medium">{priorityLabel('medium')}</option>
                        <option value="high">{priorityLabel('high')}</option>
                        <option value="critical">{priorityLabel('critical')}</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Status — auto-save */}
                  <div className="space-y-1.5">
                    <label htmlFor="field-status" className="text-xs font-semibold tracking-wide text-foreground">Status</label>
                    <div className="relative">
                      <select
                        id="field-status"
                        value={selected.status ?? 'todo'}
                        onChange={(e) => void patchTask({ status: e.target.value })}
                        className="input cursor-pointer appearance-none pr-9"
                      >
                        <option value="todo">{statusLabel('todo')}</option>
                        <option value="in_progress">{statusLabel('in_progress')}</option>
                        <option value="in_review">{statusLabel('in_review')}</option>
                        <option value="done">{statusLabel('done')}</option>
                        <option value="archived">{statusLabel('archived')}</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Assigned — auto-save */}
                  <div className="space-y-1.5">
                    <label htmlFor="field-assigned" className="text-xs font-semibold tracking-wide text-foreground">Assigned To</label>
                    <div className="relative">
                      <select
                        id="field-assigned"
                        value={selected.assigned_to || ''}
                        onChange={(e) => void patchTask({ assigned_to: e.target.value || null })}
                        className="input cursor-pointer appearance-none pr-9"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Tags — inline edit with auto-save on blur/Enter */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="field-tags" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Tags
                    </label>
                    {tagsEditing ? (
                      <div className="flex gap-2">
                        <input
                          id="field-tags"
                          value={tagsDraft}
                          onChange={(e) => setTagsDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); void saveTags() }
                            if (e.key === 'Escape') { setTagsDraft(selected.tags?.join(', ') ?? ''); setTagsEditing(false) }
                          }}
                          onBlur={() => void saveTags()}
                          placeholder="comma separated"
                          className="input flex-1 cursor-text"
                          autoFocus
                        />
                        <button type="button" onClick={() => void saveTags()} className="btn btn-primary btn-sm shrink-0"><Save className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { setTagsDraft(selected.tags?.join(', ') ?? ''); setTagsEditing(false) }} className="btn btn-ghost btn-sm shrink-0"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setTagsDraft(selected.tags?.join(', ') ?? ''); setTagsEditing(true) }}
                        className="flex w-full flex-wrap gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer min-h-[44px] items-center"
                      >
                        {selected.tags?.length ? (
                          selected.tags.map((tag: string) => (
                            <span key={tag} className="badge badge-muted font-normal"><Tag className="mr-1 h-3 w-3" />{tag}</span>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Click to add tags — comma separated</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums text-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />{new Date(selected.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Updated</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium tabular-nums text-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />{new Date(selected.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Assigned display */}
                <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned User</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />{assignedUserName}
                  </p>
                  {selected.assigned_to && <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{selected.assigned_to}</p>}
                </div>
              </section>

              {/* Description — Edit / Preview with polished markdown */}
              <section className="card space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Description
                  </h3>
                  <div className="flex items-center gap-2">
                    <SaveIndicator status={descSaveStatus} />
                    <div className="inline-flex rounded-xl border border-border bg-muted p-1">
                      <button
                        type="button"
                        onClick={() => setDrawerTab('edit')}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${drawerTab === 'edit' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
                        aria-pressed={drawerTab === 'edit'}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawerTab('preview')}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${drawerTab === 'preview' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}
                        aria-pressed={drawerTab === 'preview'}
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                    </div>
                  </div>
                </div>

                {drawerTab === 'edit' ? (
                  <div className="space-y-3">
                    <textarea
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      onBlur={() => void saveDescriptionBlur()}
                      placeholder="Write task details in Markdown…

# Example
## Requirements
- Validate token
- Handle expiry
- Add tests

```js
// code
```"
                      className="input min-h-[280px] resize-y py-3 font-mono text-[13px] leading-relaxed"
                      aria-label="Task description (Markdown)"
                    />
                    <p className="text-xs text-muted-foreground">Auto-saves 800ms after you stop typing, or on blur. Markdown is preserved.</p>
                  </div>
                ) : (
                  <div className="min-h-[180px] rounded-xl border border-border bg-card p-5 shadow-sm">
                    {descDraft ? (
                      <MarkdownPreview content={descDraft} />
                    ) : (
                      <p className="text-sm text-muted-foreground">No description</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Markdown • {drawerTab === 'edit' ? 'editing' : 'preview'}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={copy} className="btn btn-outline btn-sm gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button type="button" onClick={download} className="btn btn-outline btn-sm gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Download .md
                    </button>
                  </div>
                </div>
              </section>

              {/* AI Generation */}
              <section className="card space-y-4 border-violet-200/50 dark:border-violet-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
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
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating — please wait
                    </div>
                    <ol className="mt-3 space-y-1.5">
                      {GENERATING_STAGES.map((stage, idx) => (
                        <li key={stage} className="flex items-center gap-2 text-xs font-medium text-violet-700/80 dark:text-violet-300/80">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-violet-600 shadow-sm border border-violet-200 dark:bg-violet-900 dark:text-violet-200">{idx + 1}</span>
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
                  className="btn btn-primary w-full justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate task With AI
                </button>
                {selected.ai_generated ? (
                  <p className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
                    <Bot className="h-3.5 w-3.5" /> AI generation has already been performed for this task.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed font-medium text-muted-foreground">AI will inspect project and .brain to rewrite task. This can only be done once per task.</p>
                )}
              </section>

              {/* Activity */}
              <section className="card space-y-4">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Activity
                </h3>
                {activities.length ? (
                  <div className="relative space-y-0">
                    <div className="absolute left-2 top-2 h-[calc(100%-16px)] w-px bg-border" aria-hidden="true" />
                    <ul className="space-y-4">
                      {activities.map((a) => (
                        <li key={a.id} className="relative flex gap-3 pl-6">
                          <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">{new Date(a.timestamp).toLocaleString()}</span>
                              <span className="text-xs font-semibold text-foreground">{statusLabel(a.action) !== a.action ? statusLabel(a.action) : humanizeAction(a.action)}</span>
                              <span className="badge badge-muted text-[11px]">v{a.version}</span>
                            </div>
                            {a.changes?.length ? (
                              <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                                {a.changes.map((c: any, i: number) => (
                                  <li key={i} className="font-mono text-[12px]">
                                    <span className="font-semibold text-foreground">{humanize(c.field)}:</span> {String(c.old_value)} → <span className="font-semibold text-foreground">{String(c.new_value)}</span>
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
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">No activity</p>
                )}
              </section>

              {/* Versions */}
              <section className="card space-y-4">
                <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                  <History className="h-4 w-4 text-muted-foreground" /> Timeline — Versions
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
                              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${v.version === selected.version ? 'bg-primary text-white' : 'bg-muted text-muted-foreground border border-border'}`}>v{v.version}</span>
                              {v.title}
                            </span>
                          </p>
                          <span className="whitespace-nowrap font-mono text-[11px] font-medium text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                        </div>
                        <details className="mt-3 group">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground border border-border shadow-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <FileText className="h-3.5 w-3.5" /> View description <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                          </summary>
                          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-3 font-mono text-xs leading-relaxed text-foreground">{String(v.description ?? '').slice(0, 1000)}</pre>
                        </details>
                        {v.version !== selected.version && <p className="mt-2 text-[11px] font-medium text-muted-foreground">Read-only (only latest can be edited)</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">No versions</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    task_created: 'Task Created',
    task_updated: 'Task Updated',
    title_changed: 'Title Changed',
    description_changed: 'Description Changed',
    priority_changed: 'Priority Changed',
    status_changed: 'Status Changed',
    assigned_user_changed: 'Assignee Changed',
    tags_changed: 'Tags Changed',
    ai_generation: 'AI Generation',
  }
  if (map[action]) return map[action]
  return action.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
