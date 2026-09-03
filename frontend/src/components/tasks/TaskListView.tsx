/**
 * <TaskListView> — reusable Plane.so/Linear-style issue tracker
 * Accepts viewConfig object (filters, groupBy, sortBy, visibleColumns)
 * New tabs are just new configs — not new components.
 */
import { useEffect, useMemo, useState } from 'react'
import { Lock, Plus, BarChart3, Workflow, PanelRight, CheckSquare } from 'lucide-react'
import type { TaskItem, ViewConfig, SavedView } from './types'
import { DEFAULT_VIEW_CONFIG } from './types'
import { SavedViewTabs } from './SavedViewTabs'
import { FilterBar } from './FilterBar'
import { GroupedTable } from './GroupedTable'
import { loadViews, saveViews, loadActiveViewId, saveActiveViewId, createView, defaultViews } from './viewStore'
import { parseQuery, taskMatchesQuery } from './queryParser'

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
  const [views, setViews] = useState<SavedView[]>(() => loadViews(ownerId, activeProjectId))
  const [activeId, setActiveId] = useState<string>(() => loadActiveViewId(ownerId, activeProjectId) ?? 'backlog')
  const [internalConfig, setInternalConfig] = useState<ViewConfig>(() => {
    const vs = loadViews(ownerId, activeProjectId)
    const active = vs.find((v) => v.id === (loadActiveViewId(ownerId, activeProjectId) ?? 'backlog'))
    return active?.config ?? { ...DEFAULT_VIEW_CONFIG }
  })
  const [splitOpen, setSplitOpen] = useState(false)

  // sync when owner/project changes
  useEffect(() => {
    const loaded = loadViews(ownerId, activeProjectId)
    setViews(loaded)
    const aid = loadActiveViewId(ownerId, activeProjectId) ?? loaded[0]?.id ?? 'backlog'
    setActiveId(aid)
    const av = loaded.find((v) => v.id === aid)
    if (av && !controlledConfig) setInternalConfig(av.config)
  }, [ownerId, activeProjectId])

  // active view derived
  const activeView = useMemo(() => views.find((v) => v.id === activeId) ?? views[0], [views, activeId])

  const effectiveConfig: ViewConfig = controlledConfig ?? activeView?.config ?? internalConfig

  function persistViews(next: SavedView[]) {
    setViews(next)
    saveViews(next, ownerId, activeProjectId)
  }

  function updateConfig(patch: Partial<ViewConfig>) {
    const next: ViewConfig = { ...effectiveConfig, ...patch }
    if (controlledConfig && onViewConfigChange) {
      onViewConfigChange(next)
    } else {
      setInternalConfig(next)
      // also update active view's stored config
      const idx = views.findIndex((v) => v.id === activeId)
      if (idx >= 0) {
        const nextViews = [...views]
        nextViews[idx] = { ...nextViews[idx], config: next }
        persistViews(nextViews)
      }
    }
  }

  function handleSelectView(id: string) {
    setActiveId(id)
    saveActiveViewId(id, ownerId, activeProjectId)
    const v = views.find((x) => x.id === id)
    if (v && !controlledConfig) setInternalConfig(v.config)
  }

  function handleCreateView(name: string) {
    const nv = createView(name, effectiveConfig, ownerId, activeProjectId)
    const next = [...views, nv]
    persistViews(next)
    handleSelectView(nv.id)
  }

  function handleRename(id: string, name: string) {
    const next = views.map((v) => (v.id === id ? { ...v, name } : v))
    persistViews(next)
  }
  function handleDelete(id: string) {
    if (views.length <= 1) return
    const next = views.filter((v) => v.id !== id)
    persistViews(next)
    if (activeId === id) handleSelectView(next[0].id)
  }
  function handleDuplicate(id: string) {
    const src = views.find((v) => v.id === id)
    if (!src) return
    const nv = createView(`${src.name} copy`, src.config, ownerId, activeProjectId)
    const next = [...views, nv]
    persistViews(next)
  }

  const filteredCount = useMemo(() => {
    const parsed = parseQuery(effectiveConfig.search)
    if (!parsed.tokens.length && !parsed.freeText) return tasks.length
    return tasks.filter((t) =>
      taskMatchesQuery(
        {
          title: t.title,
          status: t.status,
          priority: t.priority,
          tags: (t as any).tags ?? (t as any).labels ?? [],
          labels: (t as any).labels ?? (t as any).tags ?? [],
          project_name: (t as any).project_name ?? (t as any).module ?? '',
          module: (t as any).module ?? (t as any).project_name ?? '',
          iteration: (t as any).iteration ?? '',
          assigned_user_name: (t as any).assigned_user_name ?? null,
          assigned_to: (t as any).assigned_to ?? null,
          description: (t as any).description ?? '',
        },
        parsed
      )
    ).length
  }, [tasks, effectiveConfig.search])

  // annotate views with counts
  const viewsWithCount = useMemo(() => {
    return views.map((v) => {
      const p = parseQuery(v.config.search)
      const c = tasks.filter((t) =>
        taskMatchesQuery(
          {
            title: t.title,
            status: t.status,
            priority: t.priority,
            tags: (t as any).tags ?? (t as any).labels ?? [],
            labels: (t as any).labels ?? (t as any).tags ?? [],
            project_name: (t as any).project_name ?? (t as any).module ?? '',
            module: (t as any).module ?? (t as any).project_name ?? '',
            iteration: (t as any).iteration ?? '',
            assigned_user_name: (t as any).assigned_user_name ?? null,
            assigned_to: (t as any).assigned_to ?? null,
            description: (t as any).description ?? '',
          },
          p
        )
      ).length
      return { ...v, count: c }
    })
  }, [views, tasks])

  async function handleCreateInGroup(status: string, title?: string) {
    const finalTitle = typeof title === 'string' ? title : `New task in ${status}`
    if (onTaskCreate) await onTaskCreate({ title: finalTitle, status, project_id: activeProjectId ?? undefined })
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-sm dark:bg-slate-900 dark:border-slate-800">
      {/* Top bar — project name with lock, insights, workflows, split toggle */}
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-card px-3 py-2 dark:bg-slate-900 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm dark:bg-white dark:text-slate-900">
            <CheckSquare className="h-4 w-4" />
          </div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            {activeProjectName}
            <Lock className="h-3.5 w-3.5 text-slate-400" />
          </h2>
          <span className="hidden text-xs text-slate-400 sm:inline">· {tasks.length} issues</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 sm:inline-flex">
            <Plus className="h-3.5 w-3.5" /> Add status update
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
            <BarChart3 className="h-3.5 w-3.5" /> Insights
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
            <Workflow className="h-3.5 w-3.5" /> Workflows
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">{workflowsCount}</span>
          </button>
          <div className="ml-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={() => setSplitOpen((v) => !v)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${splitOpen ? 'bg-primary text-white border-primary shadow-sm dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}
            title="Toggle split view"
            aria-pressed={splitOpen}
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Saved View Tabs */}
      <SavedViewTabs
        views={viewsWithCount}
        activeId={activeId}
        onSelect={handleSelectView}
        onCreate={handleCreateView}
        onRename={handleRename}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />

      {/* Filter / Query Bar */}
      <FilterBar config={effectiveConfig} onChange={updateConfig} resultCount={filteredCount} users={users} projects={projects} />

      {/* Grouped Table */}
      <GroupedTable
        tasks={tasks}
        viewConfig={effectiveConfig}
        onTaskClick={onTaskClick}
        onPatch={onTaskPatch}
        onCreateInGroup={handleCreateInGroup as any}
        users={users}
        projects={projects}
        activeProjectName={activeProjectName}
      />

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-[#f8f9fb] px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
        <span className="tabular-nums">
          Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredCount}</span> of {tasks.length}
        </span>
        <span className="hidden sm:inline">Sticky columns · inline edit via dropdown · grouping: {effectiveConfig.groupBy}</span>
      </div>
    </div>
  )
}
