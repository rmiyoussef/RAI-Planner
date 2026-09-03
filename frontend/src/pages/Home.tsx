import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
  LayoutDashboard,
  FolderKanban,
  CheckCircle2,
  Archive,
  ClipboardList,
  BarChart3,
  Layers,
  Tag,
  CalendarRange,
  AlertCircle,
  Loader2,
  TrendingUp,
} from 'lucide-react'

type Granularity = 'daily' | 'weekly' | 'monthly'

type BarDatum = { date: string; count: number }

function SimpleBar({
  data,
  colorClass = 'bg-primary',
}: {
  data: BarDatum[]
  colorClass?: string
}) {
  if (!data.length) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6">
        <p className="text-sm font-medium text-muted-foreground">No data available</p>
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="space-y-3" role="img" aria-label="Bar chart">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex items-center gap-3"
        >
          <span className="w-20 shrink-0 truncate text-right text-xs font-medium text-muted-foreground sm:w-24">
            {d.date}
          </span>
          <div className="flex flex-1 items-center gap-3">
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out motion-reduce:transition-none ${colorClass}`}
                style={{ width: `${(d.count / max) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
              {d.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  iconWrapClass,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sublabel?: string
  iconWrapClass: string
}) {
  return (
    <div className="card group flex flex-col gap-4 hover:shadow-medium motion-reduce:transition-none">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconWrapClass}`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {sublabel ?? 'Total'}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function Pill({
  label,
  value,
  variant = 'muted',
}: {
  label: string
  value: number
  variant?: 'primary' | 'success' | 'warn' | 'danger' | 'muted'
}) {
  const variantClass: Record<string, string> = {
    primary: 'badge-primary',
    success: 'badge-success',
    warn: 'badge-warn',
    danger: 'badge-danger',
    muted: 'badge-muted',
  }
  return (
    <span className={`badge cursor-default ${variantClass[variant]}`}>
      <span className="font-semibold">{label}</span>
      <span className="ml-1.5 rounded-full bg-white/60 px-1.5 py-0 text-[11px] font-bold tabular-nums dark:bg-black/20">
        {value}
      </span>
    </span>
  )
}

function getStatusVariant(status: string): 'primary' | 'success' | 'warn' | 'muted' | 'danger' {
  const s = status.toLowerCase()
  if (['done', 'completed', 'closed'].includes(s)) return 'success'
  if (['in_progress', 'in progress', 'active', 'doing'].includes(s)) return 'primary'
  if (['todo', 'pending', 'backlog'].includes(s)) return 'muted'
  if (['blocked', 'on_hold', 'cancelled'].includes(s)) return 'danger'
  return 'warn'
}

function getPriorityVariant(priority: string): 'danger' | 'warn' | 'primary' | 'muted' {
  const p = priority.toLowerCase()
  if (['urgent', 'high', 'critical'].includes(p)) return 'danger'
  if (['medium', 'normal'].includes(p)) return 'warn'
  if (['low'].includes(p)) return 'muted'
  return 'primary'
}

export function Home() {
  const [data, setData] = useState<any>(null)
  const [gran, setGran] = useState<Granularity>('daily')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api
      .get(`/dashboard?granularity=${gran}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [gran])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-80 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-32 animate-pulse">
              <div className="h-10 w-10 rounded-xl bg-muted" />
              <div className="mt-6 h-7 w-20 rounded bg-muted" />
              <div className="mt-2 h-4 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading dashboard...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Unable to load dashboard</p>
            <p className="mt-1 text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const tasksByStatus = (data.tasks_by_status ?? {}) as Record<string, number>
  const tasksByPriority = (data.tasks_by_priority ?? {}) as Record<string, number>

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm" aria-hidden="true">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
              Home Dashboard
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Monitor performance, track project health and stay ahead of delivery — built for decisive business owners.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor="granularity" className="sr-only">
            Select granularity
          </label>
          <div className="relative">
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <select
              id="granularity"
              value={gran}
              onChange={(e) => setGran(e.target.value as Granularity)}
              className="h-10 cursor-pointer appearance-none rounded-xl border border-border bg-card py-2 pl-9 pr-9 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border focus:border-border focus:outline-none focus:ring-0 focus-visible:border-border focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
              ▾
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={FolderKanban}
            label="Total Projects"
            value={data.projects_total ?? 0}
            sublabel="Portfolio"
            iconWrapClass="bg-primary-light text-primary border-primary/10 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50"
          />
          <StatCard
            icon={CheckCircle2}
            label="Active Projects"
            value={data.projects_active ?? 0}
            sublabel="Active"
            iconWrapClass="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
          />
          <StatCard
            icon={Archive}
            label="Disabled Projects"
            value={data.projects_disabled ?? 0}
            sublabel="Disabled"
            iconWrapClass="bg-muted text-muted-foreground border-border"
          />
          <StatCard
            icon={ClipboardList}
            label="Total Tasks"
            value={data.tasks_total ?? 0}
            sublabel="Workload"
            iconWrapClass="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          />
        </div>
      </section>

      {/* Tasks by status / priority */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Tasks breakdown">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary dark:bg-blue-950/50 dark:text-blue-300" aria-hidden="true">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Tasks by Status</h3>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {Object.keys(tasksByStatus).length} types
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tasksByStatus).map(([k, v]) => (
              <Pill key={k} label={k} value={v as number} variant={getStatusVariant(k)} />
            ))}
            {!Object.keys(tasksByStatus).length && (
              <span className="text-sm font-medium text-muted-foreground">No tasks</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent" aria-hidden="true">
              <Tag className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Tasks by Priority</h3>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {Object.keys(tasksByPriority).length} levels
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tasksByPriority).map(([k, v]) => (
              <Pill key={k} label={k} value={v as number} variant={getPriorityVariant(k)} />
            ))}
            {!Object.keys(tasksByPriority).length && (
              <span className="text-sm font-medium text-muted-foreground">No tasks</span>
            )}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="space-y-4" aria-label="Trends">
        <div className="card">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm" aria-hidden="true">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Projects Created Over Time
              </h3>
              <p className="text-xs font-medium capitalize text-muted-foreground">{gran} granularity</p>
            </div>
            <TrendingUp className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <SimpleBar data={data.projects_created_over_time ?? []} colorClass="bg-primary" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm" aria-hidden="true">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Tasks Created Over Time</h3>
            </div>
            <SimpleBar data={data.tasks_created_over_time ?? []} colorClass="bg-emerald-500" />
          </div>

          <div className="card">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm" aria-hidden="true">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Tasks Completed Over Time</h3>
            </div>
            <SimpleBar data={data.tasks_completed_over_time ?? []} colorClass="bg-amber-500" />
          </div>
        </div>
      </section>
    </div>
  )
}
