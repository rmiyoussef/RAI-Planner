import { useEffect, useRef, useState } from 'react'
import { Search, X, SlidersHorizontal, ChevronDown, Eye, Columns3, Layers, ArrowUpDown, Grip } from 'lucide-react'
import type { ViewConfig } from './types'
import { parseQuery } from './queryParser'

export function FilterBar({
  config,
  onChange,
  resultCount,
  users,
  projects,
}: {
  config: ViewConfig
  onChange: (patch: Partial<ViewConfig>) => void
  resultCount: number
  users?: { id: string; full_name: string; github_username?: string }[]
  projects?: { id: string; name: string }[]
}) {
  const [draft, setDraft] = useState(config.search)
  const [viewOpen, setViewOpen] = useState(false)
  const parsed = parseQuery(draft)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(config.search), [config.search])

  // debounce commit to parent
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== config.search) onChange({ search: draft })
    }, 300)
    return () => clearTimeout(t)
  }, [draft])

  function clear() {
    setDraft('')
    onChange({ search: '' })
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-[#f8f9fb] px-3 py-2 dark:bg-slate-900 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      {/* Query builder input */}
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='Search — e.g. -status:"Completed" assignee:rami label:urgent  free text'
            className="h-8 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-16 text-sm placeholder:text-slate-400 focus:border-slate-200 focus:outline-none focus:ring-0 focus-visible:border-slate-200 focus-visible:outline-none focus-visible:ring-0 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-slate-700 dark:focus-visible:border-slate-700"
            aria-label="Filter tasks"
          />
          {/* token preview chips inside? show inline after? */}
          <div className="absolute right-1 flex items-center gap-1">
            {draft && (
              <button
                onClick={clear}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                aria-label="Clear filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-slate-900">
              {resultCount}
            </span>
          </div>
        </div>

        {/* Token chips preview (desktop) */}
        {parsed.tokens.length > 0 && (
          <div className="hidden items-center gap-1 lg:flex">
            {parsed.tokens.slice(0, 3).map((t, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${t.negated ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300' : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-300'}`}
              >
                {t.negated ? '−' : ''}
                {t.field}:{t.value}
              </span>
            ))}
            {parsed.tokens.length > 3 && (
              <span className="text-xs text-slate-500">+{parsed.tokens.length - 3} more</span>
            )}
          </div>
        )}
      </div>

      {/* Right: View dropdown */}
      <div className="flex items-center gap-2 self-stretch sm:self-auto">
        {/* quick project filter if provided (optional) */}
        {projects && projects.length > 0 && (
          <select
            value={(() => {
              const projTok = parsed.byField['module']?.[0]?.value
              // fallback: try to match project name to id
              return projTok ?? ''
            })()}
            onChange={(e) => {
              const val = e.target.value
              // replace or add module token
              let next = draft
              // remove existing module tokens
              next = next.replace(/(^|\s)-?module:(?:"[^"]+"|\S+)/g, '').trim()
              next = next.replace(/(^|\s)-?project:(?:"[^"]+"|\S+)/g, '').trim()
              if (val) next = (next ? next + ' ' : '') + `module:"${val}"`
              setDraft(next)
              onChange({ search: next })
            }}
            className="hidden h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 sm:block"
          >
            <option value="">All modules</option>
            {projects.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setViewOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Eye className="h-4 w-4" /> View
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${viewOpen ? 'rotate-180' : ''}`} />
          </button>
          {viewOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setViewOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:bg-slate-800 dark:border-slate-700">
                {/* Columns */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Columns3 className="h-3.5 w-3.5" /> Columns
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ['title', 'Title'],
                      ['module', 'Module'],
                      ['assignees', 'Assignees'],
                      ['labels', 'Labels'],
                      ['status', 'Status'],
                      ['iteration', 'Iteration'],
                      ['created_at', 'Created'],
                    ].map(([key, label]) => {
                      const checked = config.visibleColumns.includes(key)
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-sm hover:bg-white dark:bg-slate-700 dark:border-slate-600"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked ? [...config.visibleColumns, key] : config.visibleColumns.filter((c) => c !== key)
                              // keep at least title
                              if (!next.includes('title')) next.push('title')
                              onChange({ visibleColumns: next })
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="text-xs font-medium">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="my-3 border-t border-slate-100 dark:border-slate-700" />

                {/* Grouping */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Layers className="h-3.5 w-3.5" /> Grouping
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['status', 'priority', 'none'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => onChange({ groupBy: g as any })}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${config.groupBy === g ? 'bg-primary text-white border-primary shadow-sm dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}
                      >
                        {g === 'none' ? 'No grouping' : g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="my-3 border-t border-slate-100 dark:border-slate-700" />

                {/* Sorting */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <ArrowUpDown className="h-3.5 w-3.5" /> Sorting
                  </p>
                  <div className="flex gap-1.5">
                    <select
                      value={config.sortBy?.field ?? ''}
                      onChange={(e) => {
                        const f = e.target.value
                        if (!f) onChange({ sortBy: null })
                        else onChange({ sortBy: { field: f, direction: config.sortBy?.direction ?? 'asc' } })
                      }}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-600"
                    >
                      <option value="">Default (created)</option>
                      <option value="title">Title</option>
                      <option value="status">Status</option>
                      <option value="priority">Priority</option>
                      <option value="created_at">Created</option>
                      <option value="module">Module</option>
                    </select>
                    <button
                      onClick={() => {
                        if (!config.sortBy) return
                        onChange({ sortBy: { ...config.sortBy, direction: config.sortBy.direction === 'asc' ? 'desc' : 'asc' } })
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:bg-slate-900 dark:border-slate-600"
                      title="Toggle direction"
                    >
                      {config.sortBy?.direction === 'desc' ? '↓ Desc' : '↑ Asc'}
                    </button>
                  </div>
                </div>

                <div className="my-3 border-t border-slate-100 dark:border-slate-700" />

                {/* Density */}
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Grip className="h-3.5 w-3.5" /> Density
                  </p>
                  <div className="flex gap-1.5">
                    {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => onChange({ density: d })}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize ${config.density === d ? 'bg-primary text-white border-primary shadow-sm dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            // reset view
            setDraft('')
            onChange({ search: '', groupBy: 'status', sortBy: null, visibleColumns: ['rowNumber','title','module','assignees','labels','status','iteration','created_at'] })
          }}
          className="hidden h-8 items-center rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 sm:inline-flex"
        >
          <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Reset
        </button>
      </div>
    </div>
  )
}
