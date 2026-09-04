import { useEffect, useMemo, useState } from 'react'
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
  TrendingDown,
  Minus,
  Gauge,
} from 'lucide-react'

type Granularity = 'daily' | 'weekly' | 'monthly'

type BarDatum = { date: string; count: number }
type TrendPoint = { key: string; label: string; count: number }

const PERIOD_COUNT: Record<Granularity, number> = { daily: 14, weekly: 12, monthly: 12 }
const PERIOD_NOUN: Record<Granularity, string> = { daily: 'day', weekly: 'week', monthly: 'month' }

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function isoWeekKey(d: Date): string {
  // ISO week key YYYY-Www from a UTC date
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (tmp.getUTCDay() + 6) % 7 // Mon=0
  tmp.setUTCDate(tmp.getUTCDate() - day + 3) // Thursday of this week
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((tmp.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${tmp.getUTCFullYear()}-W${pad2(week)}`
}

function buildKeys(gran: Granularity, now = new Date()): string[] {
  const n = PERIOD_COUNT[gran]
  const keys: string[] = []
  if (gran === 'daily') {
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      keys.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`)
    }
  } else if (gran === 'weekly') {
    // start from Monday of current ISO week
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const day = (today.getUTCDay() + 6) % 7
    const monday = new Date(today.getTime() - day * 86400000)
    for (let i = n - 1; i >= 0; i--) {
      keys.push(isoWeekKey(new Date(monday.getTime() - i * 7 * 86400000)))
    }
  } else {
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - i, 1))
      keys.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`)
    }
  }
  return keys
}

function formatBucketLabel(key: string, gran: Granularity): string {
  try {
    if (gran === 'daily') {
      return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    if (gran === 'monthly') {
      return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    }
    return key.replace('-W', ' W')
  } catch {
    return key
  }
}

function buildSeries(raw: BarDatum[] | undefined, gran: Granularity): TrendPoint[] {
  const map = new Map<string, number>()
  for (const d of raw ?? []) map.set(d.date, (map.get(d.date) ?? 0) + d.count)
  return buildKeys(gran).map((key) => ({ key, label: formatBucketLabel(key, gran), count: map.get(key) ?? 0 }))
}

function summarize(series: TrendPoint[]) {
  const total = series.reduce((s, p) => s + p.count, 0)
  const avg = series.length ? total / series.length : 0
  const peak = series.reduce<TrendPoint>((best, p) => (p.count > best.count ? p : best), { key: '', label: '—', count: 0 })
  const last = series.length ? series[series.length - 1].count : 0
  const prev = series.length > 1 ? series[series.length - 2].count : 0
  const deltaPct = prev === 0 ? (last > 0 ? 100 : 0) : ((last - prev) / prev) * 100
  return { total, avg, peak, last, prev, deltaPct }
}

function DeltaBadge({ deltaPct, noun }: { deltaPct: number; noun: string }) {
  const flat = Math.abs(deltaPct) < 0.5
  if (flat)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden="true" /> flat vs prev {noun}
      </span>
    )
  const up = deltaPct > 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        up
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
          : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
      {up ? '+' : ''}{Math.round(deltaPct)}% vs prev {noun}
    </span>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-bold tabular-nums text-foreground">{value}</span>
    </span>
  )
}

function TrendChart({
  series,
  barClass,
  label = 'Trend',
}: {
  series: TrendPoint[]
  barClass: string
  label?: string
}) {
  const max = Math.max(...series.map((p) => p.count), 1)
  const peakCount = Math.max(...series.map((p) => p.count), 0)
  const allZero = peakCount === 0
  // sparse x labels: first, middle, last (plus peak if distinct)
  const labelIdx = new Set<number>([0, Math.floor((series.length - 1) / 2), series.length - 1])
  const peakIdx = series.findIndex((p) => p.count === peakCount && peakCount > 0)
  if (peakIdx >= 0) labelIdx.add(peakIdx)

  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label={label}>
        {series.map((p, i) => {
          const isPeak = p.count === peakCount && peakCount > 0
          const h = p.count === 0 ? 3 : Math.max(8, Math.round((p.count / max) * 128))
          return (
            <div key={p.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch" title={`${p.label}: ${p.count}`}>
              <span className={`text-[10px] font-bold tabular-nums ${isPeak ? 'text-foreground' : 'text-transparent'} select-none`} aria-hidden="true">
                {p.count}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ease-out motion-reduce:transition-none ${
                    p.count === 0 ? 'bg-border' : `${barClass}${isPeak ? ' ring-1 ring-black/10 dark:ring-white/20' : ' opacity-80'}`
                  }`}
                  style={{ height: p.count === 0 ? 3 : h }}
                  aria-hidden="true"
                />
              </div>
              <span className={`truncate text-[10px] font-medium ${labelIdx.has(i) ? 'text-muted-foreground' : 'text-transparent'} select-none`} aria-hidden={!(labelIdx.has(i))}>
                {p.label}
              </span>
            </div>
          )
        })}
      </div>
      {allZero && (
        <p className="mt-2 text-center text-xs font-medium text-muted-foreground">No activity in this window — zeros shown so gaps aren’t hidden.</p>
      )}
    </div>
  )
}

function ThroughputChart({ created, completed }: { created: TrendPoint[]; completed: TrendPoint[] }) {
  const max = Math.max(...created.map((p) => p.count), ...completed.map((p) => p.count), 1)
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[11px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Created</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" /> Completed</span>
      </div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Created versus completed">
        {created.map((p, i) => {
          const c = completed[i]?.count ?? 0
          const h1 = p.count === 0 ? 3 : Math.max(8, Math.round((p.count / max) * 128))
          const h2 = c === 0 ? 3 : Math.max(8, Math.round((c / max) * 128))
          return (
            <div key={p.key} className="flex min-w-0 flex-1 items-end justify-center gap-0.5 self-stretch" title={`${p.label} — created ${p.count}, completed ${c}`}>
              <div className={`w-full rounded-t-md ${p.count === 0 ? 'bg-border' : 'bg-emerald-500 opacity-90'}`} style={{ height: p.count === 0 ? 3 : h1 }} aria-hidden="true" />
              <div className={`w-full rounded-t-md ${c === 0 ? 'bg-border' : 'bg-amber-500 opacity-90'}`} style={{ height: c === 0 ? 3 : h2 }} aria-hidden="true" />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-muted-foreground">
        <span className="truncate">{created[0]?.label}</span>
        <span className="truncate">{created[created.length - 1]?.label}</span>
      </div>
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

  // Zero-filled timelines so gaps are visible (no backend change)
  const createdSeries = useMemo(() => buildSeries(data?.tasks_created_over_time as BarDatum[] | undefined, gran), [data, gran])
  const completedSeries = useMemo(() => buildSeries(data?.tasks_completed_over_time as BarDatum[] | undefined, gran), [data, gran])
  const projectsSeries = useMemo(() => buildSeries(data?.projects_created_over_time as BarDatum[] | undefined, gran), [data, gran])
  const createdSum = useMemo(() => summarize(createdSeries), [createdSeries])
  const completedSum = useMemo(() => summarize(completedSeries), [completedSeries])
  const projectsSum = useMemo(() => summarize(projectsSeries), [projectsSeries])
  // Portfolio running total ending at the current size (flat = no new workspaces)
  const portfolioSeries: TrendPoint[] = useMemo(() => {
    let run = Math.max(0, (data?.projects_total ?? 0) - projectsSeries.reduce((s, p) => s + p.count, 0))
    return projectsSeries.map((p) => {
      run += p.count
      return { ...p, count: run }
    })
  }, [data, projectsSeries])

  const windowLabel = gran === 'daily' ? 'Last 14 days' : gran === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'
  const noun = PERIOD_NOUN[gran]
  const completionRate = createdSum.total ? Math.round((completedSum.total / createdSum.total) * 100) : completedSum.total > 0 ? 100 : 0
  const netFlow = createdSum.total - completedSum.total
  const throughputInsight =
    createdSum.total === 0 && completedSum.total === 0
      ? `No task movement in ${windowLabel.toLowerCase()} — create work or close reviews to see flow.`
      : `Completed ${completedSum.total} of ${createdSum.total} created (${completionRate}%) — backlog ${
          netFlow > 0 ? `grew by ${netFlow}` : netFlow < 0 ? `shrank by ${-netFlow}` : 'unchanged'
        }.`

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

      {/* Trends — throughput + per-metric detail with KPIs */}
      <section className="space-y-4" aria-label="Trends">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm" aria-hidden="true">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Delivery Throughput</h3>
              <p className="text-xs font-medium text-muted-foreground">Created vs completed • {windowLabel}</p>
            </div>
            <div className="ml-auto">
              <DeltaBadge deltaPct={completedSum.deltaPct} noun={noun} />
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Kpi label="Created" value={String(createdSum.total)} />
            <Kpi label="Completed" value={String(completedSum.total)} />
            <Kpi label="Completion" value={`${completionRate}%`} />
            <Kpi label="Backlog Δ" value={`${netFlow > 0 ? '+' : ''}${netFlow}`} />
          </div>
          <ThroughputChart created={createdSeries} completed={completedSeries} />
          <p className="mt-3 text-xs font-medium text-muted-foreground">{throughputInsight}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm" aria-hidden="true">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Tasks Created</h3>
                <p className="text-xs font-medium text-muted-foreground">{windowLabel} • inflow</p>
              </div>
              <div className="ml-auto">
                <DeltaBadge deltaPct={createdSum.deltaPct} noun={noun} />
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Kpi label="Total" value={String(createdSum.total)} />
              <Kpi label={`Avg/${noun}`} value={createdSum.avg.toFixed(1)} />
              <Kpi label="Peak" value={createdSum.total ? `${createdSum.peak.count} (${createdSum.peak.label})` : '—'} />
            </div>
            <TrendChart series={createdSeries} barClass="bg-emerald-500" label="Tasks created trend" />
          </div>

          <div className="card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm" aria-hidden="true">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Tasks Completed</h3>
                <p className="text-xs font-medium text-muted-foreground">{windowLabel} • output</p>
              </div>
              <div className="ml-auto">
                <DeltaBadge deltaPct={completedSum.deltaPct} noun={noun} />
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Kpi label="Total" value={String(completedSum.total)} />
              <Kpi label={`Avg/${noun}`} value={completedSum.avg.toFixed(1)} />
              <Kpi label="Peak" value={completedSum.total ? `${completedSum.peak.count} (${completedSum.peak.label})` : '—'} />
            </div>
            <TrendChart series={completedSeries} barClass="bg-amber-500" label="Tasks completed trend" />
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary dark:bg-blue-950/50 dark:text-blue-300" aria-hidden="true">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Portfolio Growth</h3>
              <p className="text-xs font-medium text-muted-foreground">Running project total • +{projectsSum.total} in window</p>
            </div>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {data.projects_total ?? 0} total
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Kpi label="Added" value={String(projectsSum.total)} />
            <Kpi label={`Avg/${noun}`} value={projectsSum.avg.toFixed(1)} />
            <Kpi label="Total" value={String(data.projects_total ?? 0)} />
          </div>
          <TrendChart series={portfolioSeries} barClass="bg-primary" label="Portfolio growth" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">Flat means no new workspaces — growth only moves when projects are created.</p>
        </div>
      </section>
    </div>
  )
}
