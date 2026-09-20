import { useMemo, useState } from 'react'
import { Search, Plus } from 'lucide-react'

export function EmailTemplateVariables({
  title = 'Variables',
  generalVars = [],
  bladeVars = [],
  onInsert,
}: {
  title?: string
  generalVars?: string[]
  bladeVars?: { name: string; raw: string }[]
  onInsert: (text: string) => void
}) {
  const [q, setQ] = useState('')
  const items = useMemo(() => {
    if (bladeVars.length) {
      const f = q.toLowerCase()
      return bladeVars
        .filter((v) => !f || v.name.toLowerCase().includes(f) || v.raw.toLowerCase().includes(f))
        .map((v) => ({ label: v.name, sub: v.raw, insert: v.raw }))
    }
    const f = q.toLowerCase()
    return generalVars
      .filter((v) => !f || v.toLowerCase().includes(f))
      .map((v) => ({ label: `{${v}}`, sub: v, insert: `{${v}}` }))
  }, [q, generalVars, bladeVars])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="badge badge-muted tabular-nums">{items.length}</span>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search variables..."
          aria-label="Search variables"
          className="input pl-9 text-sm"
        />
      </div>
      <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs font-medium text-muted-foreground">
            No variables found.
          </p>
        )}
        {items.map((it) => (
          <div key={it.label + it.insert} className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs font-semibold" title={it.label}>{it.label}</p>
              {it.sub !== it.label && (
                <p className="truncate font-mono text-[11px] text-muted-foreground" title={it.sub}>{it.sub}</p>
              )}
            </div>
            <button type="button" onClick={() => onInsert(it.insert)} className="btn btn-outline btn-sm shrink-0 cursor-pointer" aria-label={`Insert ${it.label}`}>
              <Plus className="h-3 w-3" /> Insert
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
