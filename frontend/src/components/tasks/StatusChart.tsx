import { getStatusMeta } from './statusMeta'

export function StatusChart({ tasks }: { tasks: { status: string }[] }) {
  const counts: Record<string, number> = {}
  for (const t of tasks) {
    const k = t.status || 'todo'
    counts[k] = (counts[k] || 0) + 1
  }
  // ensure all statuses shown even if 0
  const order = ['todo', 'in_progress', 'in_review', 'done', 'archived']
  const labels: Record<string, string> = {
    todo: 'Planning',
    in_progress: 'In Progress',
    in_review: 'Testing',
    done: 'Done',
    archived: 'On Hold',
  }
  // also compute opened/closed aggregates
  const opened = (counts['todo'] || 0) + (counts['in_progress'] || 0) + (counts['in_review'] || 0)
  const closed = (counts['done'] || 0) + (counts['archived'] || 0)
  const max = Math.max(...order.map((k) => counts[k] || 0), 1)

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-3 dark:from-slate-800/50 dark:to-slate-900 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20 mr-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          By status
        </span>
        {order.map((k) => {
          const meta = getStatusMeta(k)
          const cnt = counts[k] || 0
          const pct = Math.round((cnt / max) * 100)
          return (
            <div key={k} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:bg-slate-800 dark:border-slate-700">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{labels[k]}</span>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 shadow-sm border border-slate-200 dark:bg-slate-700 dark:text-white dark:border-slate-600">{cnt}</span>
              <span className="hidden sm:inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ml-1">
                <span className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.dot }} />
              </span>
            </div>
          )
        })}
        <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:inline-block" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300">
          Opened <span className="font-bold">{opened}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300">
          Closed <span className="font-bold">{closed}</span>
        </span>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 hidden lg:inline">Total {tasks.length}</span>
      </div>
    </div>
  )
}
