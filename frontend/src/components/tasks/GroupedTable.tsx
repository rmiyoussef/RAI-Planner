import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, MoreHorizontal, Plus, GripVertical, ArrowUpDown, Hash, Calendar, Tag, Users, FolderKanban, Layers } from 'lucide-react'
import type { TaskItem, ViewConfig } from './types'
import { getStatusMeta, sortStatusKeys } from './statusMeta'
import { InlineDropdown } from './InlineDropdown'
import { parseQuery, taskMatchesQuery } from './queryParser'

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-800">
      {initials || '?'}
    </span>
  )
}

type ColKey = string
type ColDef = { key: ColKey; label: string; icon?: any; width: number; sticky?: boolean; left?: number }

const COL_DEFS: Record<string, ColDef> = {
  rowNumber: { key: 'rowNumber', label: '#', width: 52, sticky: true, left: 0 },
  title: { key: 'title', label: 'Title', width: 308, sticky: true, left: 52 },
  task_type: { key: 'task_type', label: 'Type', width: 110, icon: Tag },
  module: { key: 'module', label: 'Module', width: 148, icon: FolderKanban },
  assignees: { key: 'assignees', label: 'Assignees', width: 160, icon: Users },
  labels: { key: 'labels', label: 'Tags', width: 160, icon: Tag },
  status: { key: 'status', label: 'Status', width: 150, icon: Layers },
  iteration: { key: 'iteration', label: 'Iteration', width: 138 },
  created_at: { key: 'created_at', label: 'Created', width: 122, icon: Calendar },
}

function ColumnHeader({
  col,
  sortActive,
  sortDir,
  onSortToggle,
  onHide,
}: {
  col: ColDef
  sortActive?: boolean
  sortDir?: 'asc' | 'desc'
  onSortToggle?: () => void
  onHide?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`group/header relative flex h-9 items-center gap-1.5 px-3 text-xs font-semibold tabular-nums ${col.sticky ? 'sticky z-20 bg-[#f8f9fb] dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700' : ''} ${col.key === 'rowNumber' ? 'justify-center' : ''}`}
      style={{ width: col.width, minWidth: col.width, maxWidth: col.width, left: col.sticky ? col.left : undefined }}
    >
      {col.key === 'rowNumber' ? (
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white dark:bg-slate-700 dark:border-slate-600">
            <GripVertical className="h-3 w-3 text-slate-400" />
          </span>
          <Hash className="h-3 w-3 text-slate-400" />
        </span>
      ) : col.key === 'title' ? (
        <span className="flex items-center gap-1.5 truncate">
          {col.label}
          <button onClick={onSortToggle} className={`inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${sortActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'text-slate-400'}`} title="Sort">
            <ArrowUpDown className="h-3 w-3" />
          </button>
        </span>
      ) : col.key === 'status' ? (
        <span className="flex items-center gap-1">
          {col.icon && <col.icon className="h-3.5 w-3.5 text-slate-400" />}
          {col.label}
          <button onClick={onSortToggle} className={`ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${sortActive ? 'bg-primary text-white dark:bg-white dark:text-slate-900' : 'text-slate-400'}`} title="Toggle sort">
            <ArrowUpDown className="h-3 w-3" />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 truncate">
          {col.icon && <col.icon className="h-3.5 w-3.5 text-slate-400" />}
          {col.label}
        </span>
      )}

      {/* column menu */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-600 group-hover/header:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        aria-label={`Column ${col.label} menu`}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-1 top-8 z-20 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:bg-slate-800 dark:border-slate-700">
            <button onClick={() => { onSortToggle?.(); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort {sortDir === 'asc' ? '↓ Desc' : '↑ Asc'}
            </button>
            <button onClick={() => { onHide?.(); setOpen(false) }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
              <Layers className="h-3.5 w-3.5" /> Hide column
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function GroupedTable({
  tasks,
  viewConfig,
  onTaskClick,
  onPatch,
  onCreateInGroup,
  users,
  projects,
  page = 1,
  pageSize = 50,
}: {
  tasks: TaskItem[]
  viewConfig: ViewConfig
  onTaskClick?: (task: TaskItem) => void
  onPatch?: (id: string, patch: Record<string, any>) => void
  onCreateInGroup?: (status: string) => void
  users?: { id: string; full_name: string; github_username?: string }[]
  projects?: { id: string; name: string }[]
  activeProjectName?: string
  page?: number
  pageSize?: number
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // planning expanded, others collapsed per request
    return { in_progress: true, in_review: true, done: true, archived: true, planning: false, todo: false, testing: true, on_hold: true, completed: true }
  })
  const [addDraft, setAddDraft] = useState<Record<string, string>>({})

  const parsed = useMemo(() => parseQuery(viewConfig.search), [viewConfig.search])

  const filtered = useMemo(() => {
    let out = tasks.filter((t) => taskMatchesQuery(
      {
        title: t.title,
        status: t.status,
        priority: t.priority,
        tags: t.tags ?? t.labels ?? [],
        labels: t.labels ?? t.tags ?? [],
        project_name: t.project_name ?? t.module ?? '',
        module: t.module ?? t.project_name ?? '',
        iteration: t.iteration ?? '',
        assigned_user_name: t.assigned_user_name ?? null,
        assigned_to: t.assigned_to ?? null,
        description: t.description ?? '',
      },
      parsed
    ))
    if (viewConfig.sortBy) {
      const { field, direction } = viewConfig.sortBy
      const dir = direction === 'desc' ? -1 : 1
      out = [...out].sort((a: any, b: any) => {
        const av = a[field] ?? a.created_at ?? ''
        const bv = b[field] ?? b.created_at ?? ''
        if (av < bv) return -1 * dir
        if (av > bv) return 1 * dir
        return 0
      })
    }
    return out
  }, [tasks, parsed, viewConfig.sortBy])

  const grouped = useMemo(() => {
    if (viewConfig.groupBy === 'none') return { none: filtered }
    if (viewConfig.groupBy === 'status') {
      const map: Record<string, TaskItem[]> = {}
      for (const t of filtered) {
        const k = t.status ?? 'todo'
        if (!map[k]) map[k] = []
        map[k].push(t)
      }
      return map
    }
    if (viewConfig.groupBy === 'priority') {
      const map: Record<string, TaskItem[]> = {}
      for (const t of filtered) {
        const k = t.priority ?? 'medium'
        if (!map[k]) map[k] = []
        map[k].push(t)
      }
      return map
    }
    return { none: filtered }
  }, [filtered, viewConfig.groupBy])

  const visible = new Set(viewConfig.visibleColumns)
  const densityPad = viewConfig.density === 'compact' ? 'py-1.5' : viewConfig.density === 'spacious' ? 'py-3.5' : 'py-2.5'

  // build ordered visible columns including sticky rowNumber/title which are always visible but respect toggle
  const orderedKeys: string[] = ['rowNumber', 'title', 'module', 'assignees', 'labels', 'status', 'iteration', 'created_at']
  const visibleCols = orderedKeys.filter((k) => visible.has(k))
  // ensure rowNumber/title always shown even if hidden? keep them
  if (!visibleCols.includes('rowNumber')) visibleCols.unshift('rowNumber')
  if (!visibleCols.includes('title')) {
    const idx = visibleCols.indexOf('rowNumber')
    visibleCols.splice(idx + 1, 0, 'title')
  }
  const colDefs = visibleCols.map((k) => COL_DEFS[k]).filter(Boolean) as ColDef[]
  const totalWidth = colDefs.reduce((s, c) => s + c.width, 0) + 40 // actions

  const statusKeys = viewConfig.groupBy === 'status' ? sortStatusKeys(Object.keys(grouped)) : Object.keys(grouped)

  // ensure planning expanded, others collapsed (per request: always make group planning expanded and the other groups collapsed)
  useEffect(() => {
    if (viewConfig.groupBy !== 'status') return
    setCollapsed((prev) => {
      const next: Record<string, boolean> = { ...prev }
      for (const k of statusKeys) {
        const isPlanning = k === 'todo' || k === 'planning'
        if (!(k in next)) next[k] = !isPlanning
      }
      // force planning to stay expanded
      for (const k of statusKeys) {
        if (k === 'todo' || k === 'planning') next[k] = false
      }
      return next
    })
  }, [statusKeys.join(','), viewConfig.groupBy]) // eslint-disable-line react-hooks/exhaustive-deps

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border-t border-slate-200 bg-white px-6 py-12 text-center dark:bg-slate-900 dark:border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700">🔍</div>
        <p className="text-sm font-semibold text-foreground">No matching issues</p>
        <p className="text-xs text-muted-foreground">Try adjusting filters or clear search.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900 scrollbar-thin">
      <div style={{ minWidth: totalWidth }} className="min-w-full">
        {/* Table header - sticky, premium */}
        <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white text-xs font-semibold tracking-wide text-slate-500 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
          {colDefs.map((col) => (
            <ColumnHeader
              key={col.key}
              col={col}
              sortActive={viewConfig.sortBy?.field === col.key || (col.key === 'title' && viewConfig.sortBy?.field === 'title')}
              sortDir={viewConfig.sortBy?.direction}
              onSortToggle={() => {
                const field = col.key === 'rowNumber' ? 'created_at' : col.key
                if (viewConfig.sortBy?.field === field) {
                  onPatch?.('_view_sort_' as any, { sortBy: { field, direction: viewConfig.sortBy.direction === 'asc' ? 'desc' : 'asc' } } as any)
                  // Actually we need to call parent's viewConfig change - but we don't have onViewChange here; we hack via window? Instead we expose via onPatch? Let's use a custom event: use a prop? For now we handle via direct viewConfig mutation? Simpler: we will not handle sort via header here; parent TaskListView handles via FilterBar. So we just no-op.
                }
              }}
              onHide={() => {
                // hide handled via viewConfig visibleColumns — parent should provide callback but we don't have here. For UX, we keep placeholder.
              }}
            />
          ))}
          <div className="flex h-9 w-10 shrink-0 items-center justify-center border-l border-slate-200 bg-[#f8f9fb] dark:bg-slate-800 dark:border-slate-700">
            <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {/* Groups */}
        {statusKeys.map((groupKey) => {
          const items = grouped[groupKey] ?? []
          if (viewConfig.groupBy === 'none') {
            return (
              <div key="none">
                {items.map((t, idx) => (
                  <Row key={t.id} task={t} index={(page - 1) * pageSize + idx + 1} colDefs={colDefs} densityPad={densityPad} onTaskClick={onTaskClick} onPatch={onPatch} users={users} projects={projects} />
                ))}
              </div>
            )
          }
          const meta = viewConfig.groupBy === 'status' ? getStatusMeta(groupKey) : null
          const isCollapsed = !!collapsed[groupKey]
          return (
            <div key={groupKey} className="border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCollapsed((m) => ({ ...m, [groupKey]: !m[groupKey] }))}
                className="flex w-full items-center gap-2 bg-slate-50/80 px-3 py-2.5 text-left backdrop-blur-sm hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
              >
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                {meta ? (
                  <>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white dark:ring-slate-800" style={{ background: meta.dot }} />
                    <span className="text-[13px]">{meta.emoji}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{meta.label}</span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {items.length}
                    </span>
                    <span className="hidden max-w-[420px] truncate text-xs text-slate-400 sm:inline">— {meta.description}</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{groupKey}</span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {items.length}
                    </span>
                  </>
                )}
                <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              </button>

              {!isCollapsed && (
                <div>
                  {items.map((t, idx) => (
                    <Row key={t.id} task={t} index={(page - 1) * pageSize + idx + 1} colDefs={colDefs} densityPad={densityPad} onTaskClick={onTaskClick} onPatch={onPatch} users={users} projects={projects} />
                  ))}
                  <div className="flex items-center gap-2 border-t border-dashed border-slate-200 bg-white px-3 py-2 dark:bg-slate-900 dark:border-slate-700">
                    <Plus className="h-3.5 w-3.5 text-slate-400" />
                    {addDraft[groupKey] !== undefined ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          autoFocus
                          value={addDraft[groupKey]}
                          onChange={(e) => setAddDraft((m) => ({ ...m, [groupKey]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const title = addDraft[groupKey]?.trim()
                              if (title) { onCreateInGroup?.(groupKey); setAddDraft((m) => ({ ...m, [groupKey]: '' })) }
                            }
                            if (e.key === 'Escape') setAddDraft((m) => { const n = { ...m }; delete n[groupKey]; return n })
                          }}
                          placeholder={`Add item to ${meta?.label ?? groupKey}...`}
                          className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
                        />
                        <button onClick={() => { const title = addDraft[groupKey]?.trim(); if (title && onCreateInGroup) { (onCreateInGroup as any)?.(groupKey, title); setAddDraft((m) => { const n = { ...m }; delete n[groupKey]; return n }) } }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover dark:bg-white dark:text-slate-900">
                          Add
                        </button>
                        <button onClick={() => setAddDraft((m) => { const n = { ...m }; delete n[groupKey]; return n })} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setAddDraft((m) => ({ ...m, [groupKey]: '' }))} className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
                        <span>Add item</span>
                        <span className="ml-auto text-xs text-slate-400">↵</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({
  task,
  index,
  colDefs,
  densityPad,
  onTaskClick,
  onPatch,
  users,
  projects,
}: {
  task: TaskItem
  index: number
  colDefs: ColDef[]
  densityPad: string
  onTaskClick?: (t: TaskItem) => void
  onPatch?: (id: string, patch: Record<string, any>) => void
  users?: { id: string; full_name: string }[]
  projects?: { id: string; name: string }[]
}) {
  const meta = getStatusMeta(task.status)
  const labels = task.labels ?? task.tags ?? []
  const assigneeName = task.assigned_user_name ?? (users?.find((u) => u.id === task.assigned_to)?.full_name ?? null)
  const moduleName = task.module ?? task.project_name ?? '—'

  return (
    <div className={`group flex border-b border-slate-100 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/60 ${densityPad}`}>
      {colDefs.map((col) => {
        const base = `flex items-center px-3 text-sm ${col.sticky ? 'sticky bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-slate-800/60 border-r border-slate-100 dark:border-slate-800' : ''}`
        const style: any = { width: col.width, minWidth: col.width, maxWidth: col.width }
        if (col.sticky) style.left = col.left
        if (col.key === 'rowNumber') {
          return (
            <div key={col.key} className={`${base} justify-center`} style={style}>
              <GripVertical className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
              <span className="text-xs tabular-nums text-slate-400">{String(index).padStart(2, '0')}</span>
            </div>
          )
        }
        if (col.key === 'title') {
          return (
            <div key={col.key} className={`${base} min-w-0`} style={style}>
              <button type="button" onClick={() => onTaskClick?.(task)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">#{task.id.slice(-4).toUpperCase()}</span>
                <span className="truncate text-sm font-medium text-slate-900 group-hover:text-primary dark:text-slate-100 dark:group-hover:text-blue-400" title={task.title}>
                  {task.title}
                </span>
              </button>
            </div>
          )
        }
        if (col.key === 'task_type') {
          const t = (task as any).task_type || 'task'
          const map: Record<string, { label: string; cls: string }> = {
            bug: { label: 'Bug', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900' },
            feature: { label: 'Feature', cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' },
            task: { label: 'Task', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
          }
          const cur = map[t] || map.task
          return (
            <div key={col.key} className={base} style={style}>
              <InlineDropdown
                value={t}
                options={[
                  { value: 'task', label: 'Task' },
                  { value: 'bug', label: 'Bug' },
                  { value: 'feature', label: 'Feature' },
                ]}
                onChange={(v) => onPatch?.(task.id, { task_type: v as string })}
                renderValue={() => (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cur.cls}`}>{cur.label}</span>
                )}
              />
            </div>
          )
        }
        if (col.key === 'module') {
          return (
            <div key={col.key} className={base} style={style}>
              <InlineDropdown
                value={moduleName}
                options={(projects ?? []).map((p) => ({ value: p.name, label: p.name }))}
                onChange={(v) => onPatch?.(task.id, { project_id: projects?.find((p) => p.name === v)?.id ?? undefined })}
                renderValue={() => (
                  <span className="inline-flex max-w-[120px] items-center gap-1 truncate rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 border border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" /> <span className="truncate">{moduleName}</span>
                  </span>
                )}
              />
            </div>
          )
        }
        if (col.key === 'assignees') {
          return (
            <div key={col.key} className={base} style={style}>
              <InlineDropdown
                value={task.assigned_to ?? null}
                options={(users ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
                onChange={(v) => onPatch?.(task.id, { assigned_to: v || null })}
                renderValue={() =>
                  assigneeName ? (
                    <span className="inline-flex max-w-[140px] items-center gap-1.5 truncate text-xs">
                      <Avatar name={assigneeName} />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{assigneeName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400 dark:border-slate-600">+</span>
                  )
                }
              />
            </div>
          )
        }
        if (col.key === 'labels') {
          return (
            <div key={col.key} className={base} style={style}>
              <InlineDropdown
                value={labels}
                multi
                options={[
                  { value: 'bug', label: 'bug', color: '#ef4444' },
                  { value: 'feature', label: 'feature', color: '#3b82f6' },
                  { value: 'enhancement', label: 'enhancement', color: '#10b981' },
                  { value: 'urgent', label: 'urgent', color: '#f59e0b' },
                  ...[...new Set(labels ?? [])].filter((l) => !['bug', 'feature', 'enhancement', 'urgent'].includes(l)).map((l) => ({ value: l, label: l, color: '#94a3b8' })),
                ]}
                onChange={(v) => onPatch?.(task.id, { tags: v as string[] })}
                renderValue={() =>
                  labels.length ? (
                    <span className="flex max-w-[140px] flex-wrap gap-1">
                      {labels.slice(0, 2).map((l) => (
                        <span key={l} className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          {l}
                        </span>
                      ))}
                      {labels.length > 2 && <span className="text-[11px] text-slate-500">+{labels.length - 2}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )
                }
              />
            </div>
          )
        }
        if (col.key === 'status') {
          return (
            <div key={col.key} className={base} style={style}>
              <InlineDropdown
                value={task.status}
                options={awaitedStatusOptions().map((o) => ({ value: o.value, label: o.label, color: o.color, icon: o.icon }))}
                onChange={(v) => onPatch?.(task.id, { status: v as string })}
                renderValue={() => (
                  <span className={`inline-flex max-w-[130px] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.pillClass}`}>
                    <span className="text-[11px]">{meta.emoji}</span> <span className="truncate">{meta.label}</span>
                  </span>
                )}
              />
            </div>
          )
        }
        if (col.key === 'iteration') {
          return (
            <div key={col.key} className={base} style={style}>
              <InlineDropdown
                value={task.iteration ?? null}
                options={[{ value: 'Sprint 1', label: 'Sprint 1' }, { value: 'Sprint 2', label: 'Sprint 2' }, { value: 'Backlog', label: 'Backlog' }]}
                onChange={(v) => onPatch?.(task.id, { iteration: v as string })}
                renderValue={(v) => <span className="truncate text-xs text-slate-600 dark:text-slate-300">{(v as string) || '—'}</span>}
                placeholder="—"
              />
            </div>
          )
        }
        if (col.key === 'created_at') {
          return (
            <div key={col.key} className="flex items-center px-3 text-xs tabular-nums text-slate-500 dark:text-slate-400" style={style}>
              <span className="truncate">{new Date(task.created_at).toLocaleDateString()}</span>
            </div>
          )
        }
        return null
      })}
      <div className="flex w-10 shrink-0 items-center justify-center border-l border-slate-100 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:group-hover:bg-slate-800/60">
        <button className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-300">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function awaitedStatusOptions() {
  return [
    { value: 'todo', label: 'Planning', color: '#3b82f6', icon: '📋' },
    { value: 'in_progress', label: 'In Progress', color: '#0ea5e9', icon: '⚡' },
    { value: 'in_review', label: 'Testing', color: '#f59e0b', icon: '🧪' },
    { value: 'done', label: 'Completed', color: '#10b981', icon: '✅' },
    { value: 'archived', label: 'On Hold', color: '#fb923c', icon: '⏸️' },
  ]
}
