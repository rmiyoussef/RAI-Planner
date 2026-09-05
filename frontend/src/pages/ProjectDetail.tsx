import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  FolderKanban,
  Tag,
  Calendar,
  FileText,
  Brain,
  Sparkles,
  Bot,
  ListChecks,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Hash,
  Clock,
  MapPin,
  Eye,
  Copy,
  Download,
  Loader2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  LayoutTemplate,
} from 'lucide-react'
import { MarkdownPreview } from '../components/Markdown'
import { ProjectRulesTab } from '../components/projects/ProjectRulesTab'
import { TaskTemplatesTab } from '../components/projects/TaskTemplatesTab'
import { statusLabel, priorityLabel, statusTone, priorityTone } from '../utils/taskLabels'

function OverviewPanel({
  project,
  brain,
  taskStats,
  sysChars,
  onOpenSystem,
}: {
  project: any
  brain: any
  taskStats: { total: number; items: any[]; truncated: boolean } | null
  sysChars: number
  onOpenSystem: () => void
}) {
  const items = taskStats?.items ?? []
  const total = taskStats?.total ?? 0
  const byStatus: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  let unassigned = 0
  for (const t of items) {
    byStatus[t.status ?? 'todo'] = (byStatus[t.status ?? 'todo'] ?? 0) + 1
    if (t.priority) byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
    if (!t.assigned_to) unassigned++
  }
  const done = byStatus['done'] ?? 0
  const open = total - done
  const pct = total ? Math.round((done / total) * 100) : 0
  const recent = [...items]
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
    .slice(0, 5)
  const maxStatus = Math.max(...Object.values(byStatus), 1)

  function copyPath() {
    if (project.project_path) navigator.clipboard.writeText(project.project_path)
  }

  return (
    <div className="grid gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total tasks', value: String(total), icon: ListChecks, wrap: 'bg-primary-light text-primary border-primary/10 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50' },
          { label: 'Completed', value: `${pct}%`, icon: CheckCircle2, wrap: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
          { label: 'Open', value: String(open), icon: Clock, wrap: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
          { label: 'Unassigned', value: String(unassigned), icon: Flag, wrap: 'bg-muted text-muted-foreground border-border' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 !p-4">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${s.wrap}`} aria-hidden="true">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums leading-none">{taskStats ? s.value : '—'}</p>
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Project details */}
      <div className="card shrink-0">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Project overview</h3>
        <dl className="grid gap-4">
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0">Description</dt>
            <dd className="text-sm flex-1">{project.description || <span className="text-muted-foreground">— No description</span>}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Path</dt>
            <dd className="flex-1 min-w-0">
              {project.project_path ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 font-mono text-xs">
                  <span className="truncate" title={project.project_path}>{project.project_path}</span>
                  <button type="button" onClick={copyPath} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Copy project path">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Tags</dt>
            <dd className="flex flex-wrap gap-1.5">
              {project.tags?.length ? project.tags.map((t: string) => <span key={t} className="badge badge-muted">{t}</span>) : <span className="text-sm text-muted-foreground">—</span>}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0 flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> AI Brain</dt>
            <dd className="text-sm">
              {brain?.exists ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Available{brain?.file_count ? ` • ${brain.file_count} files` : ''}
                </span>
              ) : (
                <span className="font-medium text-amber-700 dark:text-amber-300">Not installed — add a .brain/ directory</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:gap-4">
            <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0 flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> AI Policy</dt>
            <dd className="text-sm">
              <button type="button" onClick={onOpenSystem} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline underline-offset-4 cursor-pointer">
                System Prompt • {sysChars.toLocaleString()} chars — edit in System Prompt tab
              </button>
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Created</p>
              <p className="text-sm font-medium">{new Date(project.created_at).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Updated</p>
              <p className="text-sm font-medium">{new Date(project.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </dl>
      </div>

      {/* Tasks summary */}
      <div className="card shrink-0 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary dark:bg-blue-950/50 dark:text-blue-300" aria-hidden="true">
            <ListChecks className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight">Tasks summary</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{total}</span>
          <Link to={`/tasks?project_id=${project.id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4 cursor-pointer">
            View all tasks <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {!taskStats ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…
          </div>
        ) : total === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
            No tasks yet for this project.
          </p>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Completion</span>
                <span className="tabular-nums">{done}/{total} done • {pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct}% tasks completed`}>
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(byStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([s, c]) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className={`${statusTone(s)} shrink-0`}>{statusLabel(s)}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((c / maxStatus) * 100)}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">{c}</span>
                  </div>
                ))}
            </div>
            {Object.keys(byPriority).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {Object.entries(byPriority)
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, c]) => (
                    <span key={p} className={priorityTone(p)}>{priorityLabel(p)} • {c}</span>
                  ))}
              </div>
            )}
            {taskStats.truncated && (
              <p className="text-[11px] font-medium text-muted-foreground">Showing first {items.length} of {total} — breakdown is partial.</p>
            )}
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recently updated</p>
              {recent.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className={`${statusTone(t.status ?? 'todo')} shrink-0 !px-2 !py-0 text-[11px]`}>{statusLabel(t.status ?? 'todo')}</span>
                  <span className="min-w-0 flex-1 truncate font-medium" title={t.title}>{t.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<any>(null)
  const [brain, setBrain] = useState<any>(null)
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState<any>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // brain file modal
  const [brainFile, setBrainFile] = useState<{ path: string; content: string; size?: number } | null>(null)
  const [brainFileLoading, setBrainFileLoading] = useState(false)
  const [brainFileError, setBrainFileError] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['/']))
  // tabs: overview | system prompt | rules | templates | AI brain
  const [activeTab, setActiveTab] = useState<'overview' | 'system' | 'rules' | 'templates' | 'brain'>('overview')
  // project system prompt (engineering policy for the AI agent)
  const [sysPrompt, setSysPrompt] = useState('')
  const [sysDraft, setSysDraft] = useState('')
  const [sysSaveState, setSysSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const sysDirty = sysDraft !== sysPrompt
  // generate-by-AI modal
  const [sysGenOpen, setSysGenOpen] = useState(false)
  const [sysGenerating, setSysGenerating] = useState(false)
  const [sysGenProgress, setSysGenProgress] = useState<{ stage: number; status: string; detail: string } | null>(null)
  const [sysGenPreview, setSysGenPreview] = useState<string | null>(null)
  const [sysGenAnalysis, setSysGenAnalysis] = useState<any>(null)
  const [sysGenError, setSysGenError] = useState('')

  type TreeNode = { name: string; path: string; isFolder: boolean; children: Map<string, TreeNode>; files: string[] }
  function buildFileTree(files: string[]): TreeNode {
    const root: TreeNode = { name: '', path: '/', isFolder: true, children: new Map(), files: [] }
    for (const f of [...files].sort()) {
      const parts = f.split('/')
      let cur = root
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        const isFile = isLast && part.includes('.')
        // treat last part with dot as file, otherwise folder + file
        if (isLast) {
          // file at current folder
          cur.files.push(f)
        } else {
          const folderPath = parts.slice(0, i + 1).join('/')
          if (!cur.children.has(part)) {
            cur.children.set(part, { name: part, path: folderPath, isFolder: true, children: new Map(), files: [] })
          }
          cur = cur.children.get(part)!
        }
      }
      // handle root files that were pushed as files but also need to handle single-part files
      // The above pushes every file to its parent's files, but for root files (no folder) we already did at root
      // For nested files, the above incorrectly also pushes to root; so we need cleaner logic:
    }
    // Rebuild properly to avoid duplicate root push
    const cleanRoot: TreeNode = { name: '', path: '/', isFolder: true, children: new Map(), files: [] }
    for (const f of [...files].sort()) {
      const parts = f.split('/')
      if (parts.length === 1) {
        cleanRoot.files.push(f)
      } else {
        let cur2 = cleanRoot
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          const folderPath = parts.slice(0, i + 1).join('/')
          if (!cur2.children.has(part)) {
            cur2.children.set(part, { name: part, path: folderPath, isFolder: true, children: new Map(), files: [] })
          }
          cur2 = cur2.children.get(part)!
        }
        cur2.files.push(f)
      }
    }
    return cleanRoot
  }

  function toggleFolder(path: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // tasks summary for the overview tab (up to 500 tasks, paged)
  const [taskStats, setTaskStats] = useState<{ total: number; items: any[]; truncated: boolean } | null>(null)

  async function load() {
    try {
      const p = await api.get(`/projects/${id}`)
      setProject(p); setForm(p)
      setSysPrompt(p.system_prompt ?? ''); setSysDraft(p.system_prompt ?? '')
      const b = await api.get(`/projects/${id}/brain`)
      setBrain(b)
      try {
        const all: any[] = []
        let total = 0
        for (let page = 1; page <= 5; page++) {
          const d = await api.get(`/tasks?project_id=${id}&page=${page}&limit=100`)
          all.push(...(d.items ?? []))
          total = d.total ?? all.length
          if ((d.items ?? []).length < 100 || all.length >= total) break
        }
        setTaskStats({ total, items: all, truncated: all.length < total })
      } catch {
        setTaskStats({ total: 0, items: [], truncated: false })
      }
    } catch(e:any){ setError(e.message)}
  }
  useEffect(()=>{ load() }, [id])
  useEffect(()=>{ setActiveTab('overview') }, [id])

  async function save() {
    setSaving(true)
    try {
      await api.put(`/projects/${id}`, {
        name: form.name, description: form.description, project_path: form.project_path, tags: form.tags, status: form.status
      })
      setEdit(false); load()
    } catch(e:any){ setError(e.message)}
    finally{ setSaving(false) }
  }

  async function openBrainFile(relPath: string) {
    setBrainFile(null)
    setBrainFileError('')
    setBrainFileLoading(true)
    try {
      const data = await api.get(`/projects/${id}/brain/file?path=${encodeURIComponent(relPath)}`)
      setBrainFile({ path: data.path || relPath, content: data.content || '', size: data.size })
    } catch (e: any) {
      setBrainFileError(e.message || 'Failed to load file')
    } finally {
      setBrainFileLoading(false)
    }
  }

  const SYSGEN_STAGES = [
    'Reading project structure',
    'Detecting framework',
    'Inspecting APIs',
    'Inspecting tests',
    'Reading .brain & docs',
    'Building engineering rules',
    'Generating prompt',
  ]

  async function saveSysPrompt() {
    if (!sysDirty || sysSaveState === 'saving') return
    setSysSaveState('saving')
    try {
      const updated = await api.put(`/projects/${id}/system-prompt`, { system_prompt: sysDraft })
      setSysPrompt(updated.system_prompt ?? sysDraft)
      setSysDraft(updated.system_prompt ?? sysDraft)
      setProject((prev: any) => (prev ? { ...prev, system_prompt: updated.system_prompt ?? sysDraft } : prev))
      setSysSaveState('saved')
      window.setTimeout(() => setSysSaveState('idle'), 2000)
    } catch (e: any) {
      setError(e.message || 'Could not save system prompt.')
      setSysSaveState('idle')
    }
  }

  function stopSysGenPoll(timer: number | null) {
    if (timer) window.clearInterval(timer)
  }

  async function generateSysPrompt() {
    setSysGenOpen(true)
    setSysGenPreview(null)
    setSysGenAnalysis(null)
    setSysGenError('')
    setSysGenerating(true)
    setSysGenProgress({ stage: 0, status: 'running', detail: 'Starting…' })
    const pollOnce = async () => {
      try {
        const p = await api.get(`/projects/${id}/system-prompt/generate/progress`)
        setSysGenProgress({ stage: p.stage ?? 0, status: p.status ?? 'running', detail: p.detail ?? '' })
        return p.status
      } catch {
        return 'running'
      }
    }
    void pollOnce()
    const timer = window.setInterval(() => {
      void pollOnce().then((s) => {
        if (s === 'done' || s === 'error') stopSysGenPoll(timer)
      })
    }, 1500)
    try {
      const res = await api.post(`/projects/${id}/system-prompt/generate`, {})
      setSysGenPreview(res.system_prompt ?? '')
      setSysGenAnalysis(res.analysis ?? null)
      setSysGenProgress({ stage: SYSGEN_STAGES.length, status: 'done', detail: 'Done' })
    } catch (e: any) {
      // Existing prompt is never touched on failure.
      setSysGenError(e.message || 'Unable to generate the system prompt.')
    } finally {
      stopSysGenPoll(timer)
      setSysGenerating(false)
    }
  }

  function closeSysGen() {
    if (sysGenerating) return
    setSysGenOpen(false)
  }

  function copyBrainFile() {
    if (brainFile?.content) navigator.clipboard.writeText(brainFile.content)
  }

  function downloadBrainFile() {
    if (!brainFile) return
    const blob = new Blob([brainFile.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = brainFile.path.split('/').pop() || 'brain.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!project) return (
    <div className="w-[95%] mx-auto py-12">
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading project...
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6 h-[calc(100dvh-120px)] overflow-hidden">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm shrink-0">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight leading-none">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">{project.project_path}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`badge ${project.status==='active' ? 'badge-success' : 'badge-danger'}`}>
                {project.status === 'active' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                {project.status}
              </span>
              <span className="badge badge-muted">
                <Hash className="w-3 h-3 mr-1" /> {project.task_count} tasks
              </span>
              <span className="badge badge-muted">
                <Clock className="w-3 h-3 mr-1" /> {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/tasks?project_id=${project.id}`} className="btn btn-outline gap-2">
            <ExternalLink className="w-4 h-4" /> View tasks
          </Link>
          <button onClick={()=>{ if (!edit) setActiveTab('overview'); setEdit(!edit) }} className={`btn ${edit ? 'btn-outline' : 'btn-primary'} gap-2`}>
            {edit ? <><X className="w-4 h-4" /> Cancel</> : <><Edit3 className="w-4 h-4" /> Edit</>}
          </button>
        </div>
      </div>

      {project.status==='disabled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /> This project is disabled — tasks are preserved but no new work should be assigned.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border shrink-0 -mb-2" role="tablist" aria-label="Project sections">
        {([
          { id: 'overview', label: 'Overview', icon: FolderKanban, dot: false },
          { id: 'system', label: 'System Prompt', icon: Bot, dot: sysDirty },
          { id: 'rules', label: 'Rules', icon: ListChecks, dot: false },
          { id: 'templates', label: 'Templates', icon: LayoutTemplate, dot: false },
          { id: 'brain', label: 'AI Project Brain', icon: Brain, dot: !!brain?.exists },
        ] as const).map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className={`relative flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" />
              <span>{t.label}</span>
              {t.dot && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${t.id === 'system' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
      {activeTab === 'overview' && (
      <>
      {edit ? (
        <div className="card space-y-4 shrink-0 max-h-[45vh] overflow-auto">
          <h3 className="font-semibold flex items-center gap-2"><Edit3 className="w-4 h-4 text-primary" /> Edit project</h3>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project name</label>
              <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="input" placeholder="My Awesome Project" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} rows={3} className="input resize-none" placeholder="What does this project do?" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Project path</label>
              <input value={form.project_path} onChange={e=>setForm({...form, project_path:e.target.value})} className="input font-mono text-sm" placeholder="/opt/projects/my-project" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags (comma separated)</label>
                <input value={(form.tags||[]).join(', ')} onChange={e=>setForm({...form, tags:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} className="input" placeholder="web, api, v2" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="input cursor-pointer">
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={()=>setEdit(false)} className="btn btn-ghost">Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      ) : (
        <OverviewPanel
          project={project}
          brain={brain}
          taskStats={taskStats}
          sysChars={sysDraft.length}
          onOpenSystem={() => setActiveTab('system')}
        />
      )}

      </>
      )}

      {activeTab === 'system' && (
      /* System Prompt — full-height editor, textarea scrolls internally */
      <div className="card flex min-h-[calc(100dvh-380px)] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-tight">System Prompt</h3>
            <p className="text-xs text-muted-foreground">Engineering rules the AI follows when analyzing this project and writing tasks.</p>
          </div>
          {sysSaveState === 'saved' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Saved
            </span>
          )}
          {sysDirty && sysSaveState !== 'saving' && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <label htmlFor="project-system-prompt" className="sr-only">Project system prompt</label>
          <textarea
            id="project-system-prompt"
            value={sysDraft}
            onChange={(e) => setSysDraft(e.target.value.slice(0, 20000))}
            rows={12}
            placeholder="You are an expert software engineer working on this project…"
            className="input min-h-[320px] flex-1 resize-y py-3 font-mono text-[13px] leading-relaxed"
          />
          <p className="text-[11px] font-medium tabular-nums text-muted-foreground">{sysDraft.length.toLocaleString()} / 20,000 characters</p>
        </div>
        <div className="mt-auto flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={generateSysPrompt} disabled={sysGenerating} className="btn btn-outline gap-2 disabled:opacity-50">
            {sysGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate by AI
          </button>
          <button type="button" onClick={saveSysPrompt} disabled={!sysDirty || sysSaveState === 'saving'} className="btn btn-primary gap-2 disabled:opacity-50">
            {sysSaveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {sysSaveState === 'saving' ? 'Saving…' : sysSaveState === 'saved' ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>
      )}

      {activeTab === 'rules' && (
        <ProjectRulesTab projectId={project.id} />
      )}

      {activeTab === 'templates' && (
        <TaskTemplatesTab projectId={project.id} />
      )}

      {activeTab === 'brain' && (
      <div className="card border-2 flex flex-col overflow-hidden">
        <h3 className="font-semibold flex items-center gap-2 mb-4 shrink-0">
          <Brain className="w-5 h-5 text-primary" /> AI Project Brain
          {brain?.exists && <span className="badge badge-success ml-auto"><CheckCircle2 className="w-3 h-3 mr-1" /> Available</span>}
        </h3>
        {brain?.exists ? (
          <div className="space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI project brain is available</p>
                <p className="text-xs opacity-80 mt-0.5">The Smart Engineering Agent will use this context to generate high-quality tasks.</p>
              </div>
            </div>
            {brain.files && (() => {
              const tree = buildFileTree(brain.files)
              const countFiles = (n: TreeNode): number => n.files.length + Array.from(n.children.values()).reduce((a, c) => a + countFiles(c), 0)
              const renderNode = (node: TreeNode, depth: number): React.ReactNode => (
                <div key={node.path} className="space-y-1">
                  {Array.from(node.children.values())
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((child) => {
                    const isOpen = expandedFolders.has(child.path)
                    const fileCount = countFiles(child)
                    return (
                      <div key={child.path} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleFolder(child.path)}
                          className="w-full flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-left hover:bg-card hover:border-border hover:shadow-sm transition-colors group"
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          {isOpen ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />}
                          <span className="text-xs font-semibold truncate">{child.name}</span>
                          <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{fileCount}</span>
                        </button>
                        {isOpen && (
                          <div className="ml-2 pl-3 border-l border-border/60 space-y-1">
                            {renderNode(child, depth + 1)}
                            {child.files
                              .sort()
                              .map((f: string) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => openBrainFile(f)}
                                className="group/file w-full text-left font-mono text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 hover:border-primary/30 hover:bg-primary-light/30 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-colors cursor-pointer ml-1"
                                title={`Open ${f}`}
                              >
                                <span className="truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground group-hover/file:text-primary" />{f.split('/').pop()}</span>
                                <Eye className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/file:opacity-100 group-hover/file:text-primary" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {depth === 0 && node.files
                    .sort()
                    .map((f: string) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => openBrainFile(f)}
                      className="group w-full text-left font-mono text-xs bg-card border border-border rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 hover:border-primary/30 hover:bg-primary-light/30 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-colors cursor-pointer"
                      title={`Open ${f}`}
                    >
                      <span className="truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />{f}</span>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )
              return (
                <div className="rounded-xl bg-muted/50 border border-border p-4 flex-1 flex flex-col min-h-0">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 shrink-0"><Hash className="w-3 h-3" /> .brain file manager — {brain.file_count} files in {tree.children.size + (tree.files.length ? 1 : 0)} folders — click file to preview</p>
                  <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-1 bg-background/50 rounded-lg border border-border/50 p-2">
                    {renderNode(tree, 0)}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Folder className="w-3 h-3" /> Folder
                    <span className="h-3 w-px bg-border" />
                    <FileText className="w-3 h-3" /> File — opens formatted markdown
                  </div>
                </div>
              )
            })()}
            <p className="font-mono text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg border inline-flex">{brain?.path}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800 px-4 py-4 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-bold text-amber-900 dark:text-amber-200">the ai tool need to instal on this project</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Add a <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">.brain/</code> directory to unlock AI task generation.</p>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{brain?.path}</p>
          </div>
        )}
      </div>
      )}
      </div>

      {/* Generate System Prompt modal — analyze → preview → apply (never auto-overwrites) */}
      {sysGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sysgen-title">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeSysGen} aria-hidden="true" />
          <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in">
            <div className="flex items-start gap-3 border-b border-border bg-gradient-to-r from-violet-600/10 via-transparent to-fuchsia-600/10 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
                {sysGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="sysgen-title" className="text-base font-bold tracking-tight">Generate Project System Prompt</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Analyzes the actual project — read-only, modifies nothing. Apply only if you like the result.</p>
              </div>
              <button
                type="button"
                onClick={closeSysGen}
                disabled={sysGenerating}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-background px-5 py-5">
              {/* Progress */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {SYSGEN_STAGES.map((stage, idx) => {
                    const cur = sysGenProgress?.stage ?? 0
                    const finished = sysGenProgress?.status === 'done' || idx < cur
                    const active = sysGenerating && sysGenProgress?.status !== 'error' && idx === cur
                    const failed = sysGenProgress?.status === 'error' && idx === cur
                    return (
                      <li
                        key={stage}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium ${
                          finished
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                            : active
                              ? 'border-primary/30 bg-primary-light/40 text-foreground dark:bg-primary/10'
                              : failed
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                                : 'border-border bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          finished ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {finished ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
                        </span>
                        <span className="truncate">{stage}</span>
                        {active && <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                      </li>
                    )
                  })}
                </ol>
                {(sysGenProgress?.detail || sysGenError) && (
                  <p className="mt-2 truncate text-xs font-medium text-muted-foreground" title={sysGenError || sysGenProgress?.detail}>
                    {sysGenError ? `Failed: ${sysGenError}` : `› ${sysGenProgress?.detail}`}
                  </p>
                )}
              </div>
              {/* Analysis summary */}
              {sysGenAnalysis && (
                <div className="flex flex-wrap gap-1.5">
                  {['framework', 'language', 'api_style', 'database', 'authentication', 'testing'].map((k) =>
                    sysGenAnalysis[k] ? (
                      <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <span className="font-semibold text-foreground capitalize">{k.replace('_', ' ')}</span> {String(sysGenAnalysis[k])}
                      </span>
                    ) : null
                  )}
                </div>
              )}
              {/* Preview */}
              {sysGenPreview !== null && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide">Generated System Prompt — review before applying</p>
                  <textarea value={sysGenPreview} readOnly rows={14} className="input min-h-[300px] resize-y py-3 font-mono text-[13px] leading-relaxed bg-muted/30" />
                </div>
              )}
              {sysGenError && !sysGenerating && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="font-medium break-words">{sysGenError} Your existing prompt has not been changed.</p>
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeSysGen} disabled={sysGenerating} className="btn btn-ghost disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={sysGenPreview === null || sysGenerating}
                onClick={() => {
                  if (sysGenPreview !== null) {
                    setSysDraft(sysGenPreview.slice(0, 20000))
                    setSysGenOpen(false)
                  }
                }}
                className="btn btn-primary gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Apply Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brain file modal — formatted markdown — no top white gap */}
      {(brainFile || brainFileLoading || brainFileError) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 sm:pt-8 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="brain-modal-title">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setBrainFile(null); setBrainFileError('') }} aria-hidden="true" />
          <div className="relative flex max-h-[85vh] w-[95vw] max-w-7xl flex-col rounded-2xl bg-card shadow-xl overflow-hidden animate-in my-4 border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="brain-modal-title" className="truncate text-sm font-semibold" title={brainFile?.path || ''}>{brainFile?.path || 'Loading...'}</h3>
                  {brainFile?.size !== undefined && <p className="text-xs text-muted-foreground">{brainFile.size} bytes • .brain</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={copyBrainFile}
                  disabled={!brainFile?.content}
                  className="btn btn-outline btn-sm gap-1.5 disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={downloadBrainFile}
                  disabled={!brainFile?.content}
                  className="btn btn-outline btn-sm gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => { setBrainFile(null); setBrainFileError('') }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-background p-6">
              {brainFileLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading file...
                </div>
              ) : brainFileError ? (
                <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {brainFileError}
                </div>
              ) : brainFile?.content ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <MarkdownPreview content={brainFile.content} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No content</p>
              )}
            </div>

            <div className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
              <span>Formatted markdown preview • read-only</span>
              <span className="font-mono hidden sm:inline truncate max-w-[200px]" title={brain?.path}>{brain?.path}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
