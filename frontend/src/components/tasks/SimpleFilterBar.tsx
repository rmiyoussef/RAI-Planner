import { Search, X, Calendar, Filter } from 'lucide-react'

export type SimpleFilters = {
  project: string // "" = all
  assignee: string // "" = all, "unassigned" = unassigned
  status: string // "" = all
  date: string // YYYY-MM-DD
  title: string // free text
}

export function SimpleFilterBar({
  filters,
  onChange,
  resultCount,
  projects = [],
  users = [],
}: {
  filters: SimpleFilters
  onChange: (next: SimpleFilters) => void
  resultCount: number
  projects?: { id: string; name: string }[]
  users?: { id: string; full_name: string }[]
}) {
  function update(patch: Partial<SimpleFilters>) {
    onChange({ ...filters, ...patch })
  }
  function clearAll() {
    onChange({ project: '', assignee: '', status: '', date: '', title: '' })
  }
  const hasActive = !!(filters.project || filters.assignee || filters.status || filters.date || filters.title)

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20 mr-1">
          <Filter className="h-3.5 w-3.5" /> Filters
        </span>

        {/* Project */}
        <div className="relative">
          <select
            value={filters.project}
            onChange={(e) => update({ project: e.target.value })}
            className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        <div className="relative">
          <select
            value={filters.assignee}
            onChange={(e) => update({ assignee: e.target.value })}
            className="h-9 min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
          >
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="relative">
          <select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value })}
            className="h-9 min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
          >
            <option value="">All statuses</option>
            <option value="todo">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">Testing</option>
            <option value="done">Completed</option>
            <option value="archived">On Hold</option>
          </select>
        </div>

        {/* Date */}
        <div className="relative flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="date"
            value={filters.date}
            onChange={(e) => update({ date: e.target.value })}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
            title="Filter by created date"
          />
        </div>

        {/* Title free text */}
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Search title..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm placeholder:text-slate-400 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
          />
          {filters.title && (
            <button
              onClick={() => update({ title: '' })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Clear title"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold tabular-nums text-white shadow-sm ring-1 ring-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            {resultCount} found
          </span>
          {hasActive && (
            <button
              onClick={clearAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
