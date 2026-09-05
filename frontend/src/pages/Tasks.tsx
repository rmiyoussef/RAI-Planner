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
  AlertTriangle,
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
  Trash2,
  Zap,
  Wand2,
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
    task_type: 'task',
  })
  const [tagInput, setTagInput] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [drawerTab, setDrawerTab] = useState<'edit' | 'preview'>('preview')
  const [versions, setVersions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [generateElapsed, setGenerateElapsed] = useState(0)
  const [loading, setLoading] = useState(false)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const saveTimeoutRef = useRef<number | null>(null)

  // Title inline editing
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Description editing (manual save)
  const [descDraft, setDescDraft] = useState('')
  const [descSaveStatus, setDescSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Tags editing (multi-add, same as Labels)
  const [tagsDraft, setTagsDraft] = useState('')
  const [drawerTagInput, setDrawerTagInput] = useState('')

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Collapsible bottom sections (collapsed by default)
  const [activityOpen, setActivityOpen] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)

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
    if (selected || showCreate) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected, showCreate])

  // Sync drafts when selected changes
  useEffect(() => {
    if (selected) {
      setTitleDraft(selected.title ?? '')
      setDescDraft(selected.description ?? '')
      setTagsDraft(Array.isArray(selected.tags) ? selected.tags.join(', ') : (selected.tags ?? ''))
      setTitleEditing(false)
      setDrawerTagInput('')
      setGenerateError('')
      setGenResult(null)
      setActivityOpen(false)
      setVersionsOpen(false)
      setSaveStatus('idle')
      setDescSaveStatus('idle')
      setSaveError('')
    }
  }, [selected?.id])

  // Elapsed timer while AI generation runs (slow models can take minutes)
  useEffect(() => {
    if (!generating) return
    setGenerateElapsed(0)
    const t = window.setInterval(() => setGenerateElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [generating])

  // Focus title input when editing starts
  useEffect(() => {
    if (titleEditing && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [titleEditing])

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
        task_type: form.task_type,
      })
      setShowCreate(false)
      setForm((f) => ({ ...f, title: '', description: '', tags: '', task_type: 'task' }))
      setTagInput('')
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

  // Description manual save (Save button only — no auto-save)
  const descDirty = descDraft !== (selected?.description ?? '')
  async function saveDescription() {
    if (!descDirty) return
    setDescSaveStatus('saving')
    try {
      await patchTask({ description: descDraft }, { description: descDraft })
      setDescSaveStatus('saved')
      setTimeout(() => setDescSaveStatus('idle'), 2000)
    } catch {
      setDescSaveStatus('error')
    }
  }

  // Tags (multi-add, same as Labels in create drawer — auto-save)
  function parseDrawerTags(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  async function commitDrawerTags(nextDraft: string) {
    const parsed = parseDrawerTags(nextDraft)
    const current = selected?.tags ?? []
    setTagsDraft(nextDraft)
    if (JSON.stringify(parsed) === JSON.stringify(current)) return
    try {
      await patchTask({ tags: parsed }, { tags: parsed })
    } catch {
      // keep draft so user doesn't lose input
    }
  }
  async function saveTags() {
    await commitDrawerTags(tagsDraft)
  }
  function addDrawerTagsFromInput(raw: string) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    const existing = parseDrawerTags(tagsDraft)
    const existingLower = new Set(existing.map((t) => t.toLowerCase()))
    const toAdd = parts.filter((p) => !existingLower.has(p.toLowerCase()))
    if (!toAdd.length) {
      setDrawerTagInput('')
      return
    }
    const next = [...existing, ...toAdd].join(', ')
    setDrawerTagInput('')
    void commitDrawerTags(next)
  }
  function removeDrawerTag(tag: string) {
    const next = parseDrawerTags(tagsDraft).filter((t) => t !== tag).join(', ')
    void commitDrawerTags(next)
  }

  async function handleDeleteTask() {
    if (!selected) return
    setDeleting(true)
    try {
      await api.delete(`/tasks/${selected.id}`)
      setShowDeleteConfirm(false)
      setSelected(null)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const [genProgress, setGenProgress] = useState<{ stage: number; status: string; detail: string } | null>(null)
  const [genResult, setGenResult] = useState<{ elapsedMs: number | null; protocol: string | null } | null>(null)
  const genPollRef = useRef<number | null>(null)

  function formatGenDuration(ms: number | null): string | null {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return null
    const s = Math.max(0, Math.round(ms / 1000))
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  function stopGenPoll() {
    if (genPollRef.current) {
      window.clearInterval(genPollRef.current)
      genPollRef.current = null
    }
  }

  async function generate() {
    if (selected?.ai_generated) return
    const taskId = selected.id
    setGenerating(true)
    setError('')
    setGenerateError('')
    setGenResult(null)
    setGenProgress({ stage: 0, status: 'running', detail: 'Starting…' })
    // Poll live per-stage progress (display only — the POST below is source of truth)
    const poll = async () => {
      try {
        const p = await api.get(`/tasks/${taskId}/generate/progress`)
        setGenProgress({ stage: p.stage ?? 0, status: p.status ?? 'running', detail: p.detail ?? '' })
        if (p.status === 'done' || p.status === 'error') stopGenPoll()
      } catch {
        // old backend or network blip — keep the generic animation
      }
    }
    stopGenPoll()
    void poll()
    genPollRef.current = window.setInterval(() => void poll(), 1500)
    try {
      const res = await api.post(`/tasks/${taskId}/generate`, {})
      const updated = res.task ?? res
      setSelected(updated)
      // Replace drawer content with the AI result (same id, so drafts need manual sync)
      setTitleDraft(updated.title ?? '')
      setDescDraft(updated.description ?? '')
      setTagsDraft(Array.isArray(updated.tags) ? updated.tags.join(', ') : (updated.tags ?? ''))
      setDrawerTagInput('')
      setDrawerTab('preview')
      setDescSaveStatus('idle')
      setSaveStatus('idle')
      if (typeof res.elapsed_ms === 'number' || res.protocol) {
        setGenResult({ elapsedMs: res.elapsed_ms ?? null, protocol: res.protocol ?? null })
      }
      setGenProgress({ stage: 6, status: 'done', detail: 'Saved' })
      setVersions(await api.get(`/tasks/${taskId}/versions`))
      setActivities(await api.get(`/tasks/${taskId}/activities`))
      load()
    } catch (e: any) {
      setGenerateError(e.message || 'Generation failed. Please try again.')
      setError(e.message)
    } finally {
      stopGenPoll()
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
      task_type: (t as any).task_type ?? 'task',
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

      {/* Create drawer — same style as edit/view (right side modal) */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="create-drawer-title">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} aria-hidden="true" />
          <div className="relative flex h-dvh w-full flex-col bg-card shadow-2xl border-l border-border dark:bg-slate-900 lg:w-[60vw] lg:max-w-[65vw] animate-in motion-reduce:animate-none">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent px-5 py-4 dark:from-white/[0.04] dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="create-drawer-title" className="text-[15px] font-semibold tracking-tight">Create Task</h3>
                  <p className="text-xs font-medium text-muted-foreground">Add a new task to your project backlog.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground"
                aria-label="Close create"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-background p-5 sm:p-6 space-y-5">
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="task-project" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary"><FolderKanban className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Project <span className="text-destructive">*</span>
              </label>
              <div className="relative group">
                <select
                  id="task-project"
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  className="input h-11 cursor-pointer appearance-none pr-10 text-[15px] font-medium bg-card border-border group-hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-all"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground">Task will be created in this workspace</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="task-title" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Hash className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Title <span className="text-destructive">*</span>
              </label>
              <input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Implement real-time trade blotter"
                className="input h-11 text-[15px] font-medium bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-all"
              />
              <p className="text-xs text-muted-foreground">Clear, actionable title for the assignee</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="task-description" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><FileText className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Description <span className="text-xs font-normal text-muted-foreground">(Markdown)</span>
              </label>
              <textarea
                id="task-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={10}
                placeholder="Describe goals, acceptance criteria, and technical notes in Markdown…

**Example:**
- Validate token
- Handle expiry
- Add tests"
                className="input min-h-[280px] cursor-text resize-y py-3.5 text-[14px] leading-relaxed bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-all font-mono"
              />
              <p className="text-xs text-muted-foreground">Supports <span className="font-mono font-medium">Markdown</span> — preview in task view</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="task-type" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Tag className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Type
              </label>
              <div className="relative">
                <select
                  id="task-type"
                  value={form.task_type}
                  onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                  className="input h-11 cursor-pointer appearance-none pr-9 bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="task-priority" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Priority
              </label>
              <div className="relative">
                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="input h-11 cursor-pointer appearance-none pr-9 bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
                >
                  <option value="low">{priorityLabel('low')}</option>
                  <option value="medium">{priorityLabel('medium')}</option>
                  <option value="high">{priorityLabel('high')}</option>
                  <option value="critical">{priorityLabel('critical')}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="task-status" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Status
              </label>
              <div className="relative">
                <select
                  id="task-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input h-11 cursor-pointer appearance-none pr-9 bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
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

            <div className="space-y-2">
              <label htmlFor="task-assigned" className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600"><User className="h-3.5 w-3.5" aria-hidden="true" /></span>
                Assigned To
              </label>
              <div className="relative">
                <select
                  id="task-assigned"
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="input h-11 cursor-pointer appearance-none pr-9 bg-card border-border hover:border-border focus:border-border focus:ring-0 focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors"
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

            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="task-tags" className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Tag className="h-3.5 w-3.5" aria-hidden="true" /></span> Tags <span className="text-xs font-normal text-muted-foreground">— add many</span></span>
                <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{form.tags.split(',').filter(s=>s.trim()).length} selected</span>
              </label>
              <div className="group relative flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-border bg-card min-h-[48px] focus-within:border-border focus-within:ring-0 focus-within:ring-offset-0 hover:border-border dark:hover:border-border transition-all shadow-sm">
                {form.tags.split(',').map(s=>s.trim()).filter(Boolean).map((t) => {
                  const colors: Record<string,string> = {
                    bug: 'bg-red-500 text-white border-red-600',
                    feature: 'bg-blue-500 text-white border-blue-600',
                    urgent: 'bg-amber-500 text-white border-amber-600',
                    enhancement: 'bg-emerald-500 text-white border-emerald-600',
                  }
                  const cls = colors[t.toLowerCase()] || 'bg-primary text-white border-primary'
                  return (
                    <span key={t} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all ${cls}`}>
                      {t}
                      <button type="button" onClick={() => setForm({ ...form, tags: form.tags.split(',').map(s=>s.trim()).filter(s=>s!==t).join(', ') })} className="ml-0.5 rounded-full bg-white/20 hover:bg-white/30 p-0.5 -mr-1" aria-label={`Remove tag ${t}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                })}
                <input
                  id="task-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      const parts = tagInput.split(',').map(s=>s.trim()).filter(Boolean)
                      const existingLower = new Set(form.tags.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean))
                      const toAdd = parts.filter((p) => !existingLower.has(p.toLowerCase()))
                      if (toAdd.length) {
                        const existing = form.tags.split(',').map(s=>s.trim()).filter(Boolean)
                        setForm({ ...form, tags: [...existing, ...toAdd].join(', ') })
                      }
                      setTagInput('')
                    } else if (e.key === 'Backspace' && !tagInput && form.tags) {
                      const tags = form.tags.split(',').map(s=>s.trim()).filter(Boolean)
                      tags.pop()
                      setForm({ ...form, tags: tags.join(', ') })
                    } else if (e.key === 'Escape') {
                      setTagInput('')
                    }
                  }}
                  onBlur={() => {
                    if (!tagInput.trim()) return
                    const parts = tagInput.split(',').map(s=>s.trim()).filter(Boolean)
                    const existingLower = new Set(form.tags.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean))
                    const toAdd = parts.filter((p) => !existingLower.has(p.toLowerCase()))
                    if (toAdd.length) {
                      const existing = form.tags.split(',').map(s=>s.trim()).filter(Boolean)
                      setForm({ ...form, tags: [...existing, ...toAdd].join(', ') })
                    }
                    setTimeout(()=>setTagInput(''), 150)
                  }}
                  placeholder={form.tags ? "Add more tags…" : "Type tag + Enter — e.g. urgent, backend, ui"}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 shadow-none"
                />
                {(() => {
                  const suggested = ['bug','feature','enhancement','urgent','backend','frontend','ui','api','design','docs','critical','high','low']
                  const filtered = tagInput ? suggested.filter(s => s.toLowerCase().includes(tagInput.toLowerCase()) && !form.tags.split(',').map(t=>t.trim().toLowerCase()).includes(s.toLowerCase())).slice(0,5) : []
                  if (!filtered.length) return null
                  return (
                    <div className="absolute left-0 top-full mt-2 z-10 w-48 rounded-xl border border-border bg-card shadow-lg p-1">
                      {filtered.map(s => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e)=>{ e.preventDefault(); const newTags = form.tags ? `${form.tags}, ${s}` : s; setForm({...form, tags: newTags}); setTagInput('') }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary hover:text-white transition-colors flex items-center gap-2"
                        >
                          <Tag className="w-3 h-3" /> {s}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">Press <span className="font-mono bg-muted px-1 py-0.5 rounded">Enter</span> or <span className="font-mono bg-muted px-1 py-0.5 rounded">,</span> to add • Click × to remove</p>
            </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={create} className="btn btn-primary cursor-pointer">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </button>
          </div>
            </div>
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
          <div className="relative flex h-dvh w-full flex-col bg-card shadow-2xl border-l border-border dark:bg-slate-900 lg:w-[60vw] lg:max-w-[65vw] animate-in motion-reduce:animate-none">
            {/* Header — premium business */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-gradient-to-r from-primary/[0.04] via-transparent to-transparent px-5 py-4 dark:from-white/[0.04] dark:bg-slate-900 sm:px-6">
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
              {/* AI Hero — Generate with AI at top */}
              <section aria-label="AI task generation" className={`relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-5 text-white shadow-xl shadow-violet-600/20 dark:border-violet-800/60 dark:shadow-violet-950/40 sm:p-6 motion-reduce:animate-none ${generating ? 'ai-border-animated' : ''}`}>
                {/* decorative orbs + grid */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
                  <div className="absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-fuchsia-300/20 blur-3xl" />
                  <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '18px 18px' }} />
                </div>

                <div className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-md">
                        {generating ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="h-5 w-5" aria-hidden="true" />
                        )}
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-violet-700 shadow">
                          <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                        </span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-bold tracking-tight">AI Task Engineer</h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/25 backdrop-blur">
                            <Zap className="h-2.5 w-2.5" aria-hidden="true" /> 1-click boost
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/80">
                          Rough task → shippable spec. Reads project + <span className="font-mono font-semibold text-white">.brain</span>, rewrites acceptance criteria.
                        </p>
                      </div>
                    </div>
                    {selected.ai_generated ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-white/30 backdrop-blur">
                        <Check className="h-3 w-3" aria-hidden="true" /> AI Enhanced • v{selected.version}
                      </span>
                    ) : (
                      <span className="hidden items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/20 sm:inline-flex">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" aria-hidden="true" /> Ready • once per task
                      </span>
                    )}
                  </div>

                  {/* capability pills */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {[
                      { icon: FolderKanban, label: 'Reads project' },
                      { icon: FileText, label: '.brain context' },
                      { icon: ListChecks, label: 'Acceptance criteria' },
                    ].map((f) => (
                      <span key={f.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
                        <f.icon className="h-3 w-3" aria-hidden="true" /> {f.label}
                      </span>
                    ))}
                  </div>

                  {/* generating progress */}
                  {generating ? (
                    <div role="status" aria-live="polite" className="mt-4 rounded-2xl bg-black/25 p-4 ring-1 ring-white/20 backdrop-blur-md">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Wand2 className="h-4 w-4 animate-pulse" aria-hidden="true" /> Engineering your task…
                        <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ring-1 ring-white/20">
                          {generateElapsed}s
                        </span>
                      </div>
                      {(genProgress?.detail || genProgress?.status === 'error') && (
                        <p className="mt-2 truncate text-xs font-medium text-white/85" title={genProgress?.detail}>
                          {genProgress?.status === 'error' ? 'Failed: ' : '› '}{genProgress?.detail || 'Failed'}
                        </p>
                      )}
                      <ol className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {GENERATING_STAGES.map((stage, idx) => {
                          const cur = genProgress?.stage ?? 0
                          const finished = genProgress?.status === 'done' || idx < cur
                          const active = genProgress?.status !== 'done' && genProgress?.status !== 'error' && idx === cur
                          const failed = genProgress?.status === 'error' && idx === cur
                          return (
                            <li
                              key={stage}
                              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium ring-1 motion-reduce:animate-none ${
                                finished
                                  ? 'bg-emerald-400/20 text-white ring-emerald-200/30'
                                  : active
                                    ? 'bg-white/15 text-white ring-white/30'
                                    : failed
                                      ? 'bg-red-400/20 text-white ring-red-200/30'
                                      : 'bg-white/10 text-white/55 ring-white/15'
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  finished ? 'bg-emerald-300 text-emerald-900' : failed ? 'bg-red-300 text-red-900' : 'bg-white text-violet-700'
                                }`}
                              >
                                {finished ? <Check className="h-3 w-3" aria-hidden="true" /> : failed ? <X className="h-3 w-3" aria-hidden="true" /> : idx + 1}
                              </span>
                              <span className="truncate">{stage}</span>
                              {active && <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
                            </li>
                          )
                        })}
                      </ol>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-white via-violet-200 to-white transition-all duration-500 motion-reduce:transition-none"
                          style={{ width: `${Math.min(100, Math.round(((genProgress?.stage ?? 0) / GENERATING_STAGES.length) * 100))}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-white/70">Please keep this open — saving a new version on finish.</p>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        disabled={!!selected.ai_generated}
                        onClick={generate}
                        className="group inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-violet-700 shadow-lg shadow-black/10 transition-all hover:scale-[1.01] hover:bg-violet-50 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                      >
                        <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden="true" />
                        {selected.ai_generated ? 'Already enhanced with AI' : 'Generate Task with AI'}
                        {!selected.ai_generated && (
                          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-700">✦ AI</span>
                        )}
                      </button>
                      {!selected.ai_generated && (
                        <p className="text-center text-[11px] font-medium leading-relaxed text-white/70 sm:max-w-[180px] sm:text-left">
                          One-time rewrite. You can still edit everything after.
                        </p>
                      )}
                    </div>
                  )}

                  {generateError && !generating && (
                    <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-xl bg-red-500/20 px-3 py-2 text-xs font-medium leading-relaxed text-white ring-1 ring-white/30">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="break-words">{generateError}</span>
                    </p>
                  )}

                  {selected.ai_generated && !generating && (
                    <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white/90 ring-1 ring-white/20">
                      <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> AI has already polished this task. Check Timeline below for the AI version.
                      {(() => {
                        const dur = formatGenDuration(genResult?.elapsedMs ?? null)
                        const bits = [
                          genResult?.protocol ? `via ${genResult.protocol}` : null,
                          dur ? `in ${dur}` : null,
                        ].filter(Boolean)
                        return bits.length ? <span className="ml-auto shrink-0 font-mono text-[11px] text-white/70">({bits.join(' · ')})</span> : null
                      })()}
                    </p>
                  )}
                </div>
              </section>

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

                  {/* Type — auto-save */}
                  <div className="space-y-1.5">
                    <label htmlFor="field-tasktype" className="text-xs font-semibold tracking-wide text-foreground">Type</label>
                    <div className="relative">
                      <select
                        id="field-tasktype"
                        value={selected.task_type ?? 'task'}
                        onChange={(e) => void patchTask({ task_type: e.target.value })}
                        className="input cursor-pointer appearance-none pr-9"
                      >
                        <option value="task">Task</option>
                        <option value="bug">Bug</option>
                        <option value="feature">Feature</option>
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

                  {/* Tags — multi-add, same as Labels, beside Assigned To */}
                  <div className="space-y-1.5">
                    <label htmlFor="field-tags" className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wide text-foreground">
                      <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Tags</span>
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{parseDrawerTags(tagsDraft).length} selected</span>
                    </label>
                    <div className="group relative flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-border bg-card min-h-[48px] focus-within:border-border focus-within:ring-0 focus-within:ring-offset-0 hover:border-border transition-all shadow-sm">
                      {parseDrawerTags(tagsDraft).map((t) => {
                        const colors: Record<string,string> = {
                          bug: 'bg-red-500 text-white border-red-600',
                          feature: 'bg-blue-500 text-white border-blue-600',
                          urgent: 'bg-amber-500 text-white border-amber-600',
                          enhancement: 'bg-emerald-500 text-white border-emerald-600',
                        }
                        const cls = colors[t.toLowerCase()] || 'bg-primary text-white border-primary'
                        return (
                          <span key={t} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all ${cls}`}>
                            {t}
                            <button type="button" onClick={() => removeDrawerTag(t)} className="ml-0.5 rounded-full bg-white/20 hover:bg-white/30 p-0.5 -mr-1" aria-label={`Remove tag ${t}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      })}
                      <input
                        id="field-tags"
                        value={drawerTagInput}
                        onChange={(e) => setDrawerTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault()
                            addDrawerTagsFromInput(drawerTagInput)
                          } else if (e.key === 'Backspace' && !drawerTagInput && tagsDraft) {
                            const tags = parseDrawerTags(tagsDraft)
                            tags.pop()
                            void commitDrawerTags(tags.join(', '))
                          } else if (e.key === 'Escape') {
                            setDrawerTagInput('')
                          }
                        }}
                        onBlur={() => {
                          if (drawerTagInput.trim()) addDrawerTagsFromInput(drawerTagInput)
                        }}
                        placeholder={parseDrawerTags(tagsDraft).length ? "Add more tags…" : "Type tag + Enter — e.g. urgent, backend, ui"}
                        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 shadow-none"
                      />
                      {(() => {
                        const suggested = ['bug','feature','enhancement','urgent','backend','frontend','ui','api','design','docs','critical','high','low']
                        const existingLower = new Set(parseDrawerTags(tagsDraft).map(t=>t.toLowerCase()))
                        const filtered = drawerTagInput ? suggested.filter(s => s.toLowerCase().includes(drawerTagInput.toLowerCase()) && !existingLower.has(s.toLowerCase())).slice(0,5) : []
                        if (!filtered.length) return null
                        return (
                          <div className="absolute left-0 top-full mt-2 z-10 w-48 rounded-xl border border-border bg-card shadow-lg p-1">
                            {filtered.map(s => (
                              <button
                                key={s}
                                type="button"
                                onMouseDown={(e)=>{ e.preventDefault(); addDrawerTagsFromInput(s) }}
                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary hover:text-white transition-colors flex items-center gap-2"
                              >
                                <Tag className="w-3 h-3" /> {s}
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground">Press <span className="font-mono bg-muted px-1 py-0.5 rounded">Enter</span> or <span className="font-mono bg-muted px-1 py-0.5 rounded">,</span> to add • Click × to remove • Auto-saves</p>
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
                <div className="sticky top-0 z-10 -mx-1 bg-card/95 px-1 py-2 backdrop-blur flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      Description
                    </span>
                    {selected.ai_generated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                        <Bot className="h-3 w-3" aria-hidden="true" /> AI Generated • v{selected.version}
                      </span>
                    )}
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
                      placeholder="Write task details in Markdown…

# Example
## Requirements
- Validate token
- Handle expiry
- Add tests

```js
// code
```"
                      className="input min-h-[280px] resize-y py-3 font-mono text-[13px] leading-relaxed !border-slate-300 !shadow-sm dark:!border-slate-500"
                      aria-label="Task description (Markdown)"
                    />
                    <p className="text-xs text-muted-foreground">Click Save to apply your changes. Markdown is preserved.</p>
                  </div>
                ) : (
                  <div className="min-h-[180px] rounded-xl border-2 border-slate-300 bg-card p-5 shadow dark:border-slate-500">
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
                    <button
                      type="button"
                      onClick={() => void saveDescription()}
                      disabled={!descDirty || descSaveStatus === 'saving'}
                      className="btn btn-primary btn-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {descSaveStatus === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                      {descSaveStatus === 'saving' ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={copy} className="btn btn-outline btn-sm gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button type="button" onClick={download} className="btn btn-outline btn-sm gap-1.5">
                      <Download className="h-3.5 w-3.5" /> Download .md
                    </button>
                  </div>
                </div>
              </section>

              {/* Activity — collapsible */}
              <section className="card space-y-4">
                <button
                  type="button"
                  onClick={() => setActivityOpen((v) => !v)}
                  aria-expanded={activityOpen}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <Activity className="h-4 w-4 text-muted-foreground" /> Activity
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {activities.length}
                  </span>
                  <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none ${activityOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
                </button>
                {activityOpen && (activities.length ? (
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
                ))}
              </section>

              {/* Versions — collapsible */}
              <section className="card space-y-4">
                <button
                  type="button"
                  onClick={() => setVersionsOpen((v) => !v)}
                  aria-expanded={versionsOpen}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
                    <History className="h-4 w-4 text-muted-foreground" /> Timeline — Versions
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {versions.length}
                  </span>
                  <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none ${versionsOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
                </button>
                {versionsOpen && (versions.length ? (
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
                ))}
              </section>

              {/* Delete Task — smart business danger zone (end of screen) */}
              <section className="relative overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-r from-red-50/90 to-white shadow-sm dark:from-red-950/20 dark:to-slate-900 dark:border-red-900/30">
                <div className="absolute left-0 top-0 h-full w-1 bg-red-500" aria-hidden="true" />
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Danger Zone</h3>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 mt-1">
                        Permanently delete <span className="font-semibold text-slate-900 dark:text-white">“{selected?.title}”</span> and all versions/activity. This is <span className="font-bold text-red-600 dark:text-red-400">irreversible</span>.
                      </p>
                    </div>
                    <span className="hidden sm:inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">Irreversible</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-red-100 dark:border-red-900/20">
                    <p className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <AlertCircle className="h-3.5 w-3.5" /> Business data will be permanently lost
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-300 dark:bg-slate-800 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Task
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
          {/* Delete confirmation — smart business modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteConfirm(false)} aria-hidden="true" />
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in">
                <div className="bg-gradient-to-r from-red-50 to-white dark:from-red-950/20 dark:to-slate-900 px-6 py-5 border-b border-red-100 dark:border-red-900/20">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm shrink-0">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 id="delete-title" className="text-base font-bold tracking-tight">Delete “{selected?.title}”?</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">This will permanently remove the task and all its history.</p>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex gap-2.5 dark:bg-amber-950/20 dark:border-amber-900/50">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200"><span className="font-bold">Irreversible:</span> Versions, activity and assignments will be lost. Use with caution.</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="btn btn-ghost h-10 px-5 disabled:opacity-50">Cancel</button>
                    <button type="button" onClick={handleDeleteTask} disabled={deleting} className="btn bg-red-600 text-white hover:bg-red-700 h-10 px-6 gap-2 shadow-sm disabled:opacity-50">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {deleting ? 'Deleting...' : 'Delete forever'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
