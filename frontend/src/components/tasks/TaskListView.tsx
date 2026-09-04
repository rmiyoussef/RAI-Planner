/**
 * <TaskListView> — simple filters + status chart (no saved view tabs per request)
 * Filters: project, assignee, status, date, title (free text)
 */
import { useEffect, useMemo, useState } from 'react'
import { Lock, CheckSquare } from 'lucide-react'
import type { TaskItem, ViewConfig } from './types'
import { DEFAULT_VIEW_CONFIG } from './types'
import { SimpleFilterBar, SimpleFilters } from './SimpleFilterBar'
import { StatusChart } from './StatusChart'
import { GroupedTable } from './GroupedTable'
import { Pagination } from './Pagination'

export type TaskListViewProps = {
  tasks: TaskItem[]
  users?: { id: string; full_name: string; github_username?: string }[]
  projects?: { id: string; name: string }[]
  activeProjectId?: string | null
  activeProjectName?: string
  ownerId?: string | null
  viewConfig?: ViewConfig
  onViewConfigChange?: (c: ViewConfig) => void
  onTaskClick?: (task: TaskItem) => void
  onTaskPatch?: (id: string, patch: Record<string, any>) => void
  onTaskCreate?: (payload: { title: string; status: string; project_id?: string }) => Promise<void> | void
  workflowsCount?: number
}

export function TaskListView({
  tasks,
  users = [],
  projects = [],
  activeProjectId = null,
  activeProjectName = 'All Projects',
  ownerId = null,
  viewConfig: controlledConfig,
  onViewConfigChange,
  onTaskClick,
  onTaskPatch,
  onTaskCreate,
  workflowsCount = 3,
}: TaskListViewProps) {
  const [internalConfig, setInternalConfig] = useState<ViewConfig>(() => ({ ...DEFAULT_VIEW_CONFIG }))

  // simple filters
  const [filters, setFilters] = useState<SimpleFilters>({
    project: activeProjectId || '',
    assignee: '',
    status: '',
    date: '',
    title: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // sync project filter when activeProjectId changes
  useEffect(() => {
    setFilters((f) => ({ ...f, project: activeProjectId || '' }))
  }, [activeProjectId])

  // reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [filters.project, filters.assignee, filters.status, filters.date, filters.title])

  const effectiveConfig: ViewConfig = controlledConfig ?? internalConfig

  function updateConfig(patch: Partial<ViewConfig>) {
    const next: ViewConfig = { ...effectiveConfig, ...patch }
    if (controlledConfig && onViewConfigChange) {
      onViewConfigChange(next)
    } else {
      setInternalConfig(next)
    }
  }

  // simple filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // project
      if (filters.project && (t.project_id !== filters.project && (t as any).project_name !== filters.project)) {
        const p = projects.find((pr) => pr.id === filters.project)
        if (p && t.project_name !== p.name && t.module !== p.name) return false
        if (!p) return false
      }
      // assignee
      if (filters.assignee) {
        if (filters.assignee === 'unassigned') {
          if (t.assigned_to || (t as any).assigned_user_name) return false
        } else if (t.assigned_to !== filters.assignee) return false
      }
      // status
      if (filters.status && t.status !== filters.status) return false
      // date (created_at) — single date
      if (filters.date) {
        const d = new Date(t.created_at)
        if (isNaN(d.getTime())) return false
        const ds = d.toISOString().slice(0, 10)
        if (ds !== filters.date) return false
      }
      // title free text
      if (filters.title) {
        const hay = `${t.title || ''} ${(t as any).description || ''}`.toLowerCase()
        const need = filters.title.toLowerCase().trim()
        if (!hay.includes(need)) return false
      }
      return true
    })
  }, [tasks, filters, projects])

  const filteredCount = filteredTasks.length
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize))
  const paginatedTasks = useMemo(() => filteredTasks.slice((page - 1) * pageSize, page * pageSize), [filteredTasks, page, pageSize])

  // clamp page when filteredCount shrinks
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  async function handleCreateInGroup(status: string, title?: string) {
    const finalTitle = typeof title === 'string' ? title : `New task in ${status}`
    if (onTaskCreate) await onTaskCreate({ title: finalTitle, status, project_id: activeProjectId ?? undefined })
  }

  // For GroupedTable, we pass filteredTasks and keep viewConfig for grouping/columns.
  const tableConfig: ViewConfig = useMemo(() => ({ ...effectiveConfig, search: '' }), [effectiveConfig])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-sm dark:bg-slate-900 dark:border-slate-800">
      {/* Top bar — premium business header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-primary/[0.03] via-transparent to-transparent px-4 py-3 dark:from-white/[0.04] dark:bg-slate-900 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-md ring-1 ring-primary/20 dark:bg-white dark:text-slate-900">
            <CheckSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight leading-none">
              {activeProjectName}
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">Active</span>
            </h2>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tasks.length} issues • {filteredCount} filtered • Business workspace
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live • Synced
        </div>
      </div>

      {/* Simple Filters */}
      <SimpleFilterBar filters={filters} onChange={setFilters} resultCount={filteredCount} users={users} projects={projects} />

      {/* Status Chart */}
      <StatusChart tasks={filteredTasks} />

      {/* Grouped Table - paginated for performance (1000+ tasks) */}
      <GroupedTable
        tasks={paginatedTasks}
        viewConfig={tableConfig}
        onTaskClick={onTaskClick}
        onPatch={onTaskPatch}
        onCreateInGroup={handleCreateInGroup as any}
        users={users}
        projects={projects}
        activeProjectName={activeProjectName}
      />

      {/* Pagination — optimized for 1000+ */}
      <Pagination
        total={filteredCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
      />
    </div>
  )
}
