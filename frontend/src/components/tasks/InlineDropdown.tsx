import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export function InlineDropdown({
  value,
  options,
  onChange,
  renderValue,
  placeholder = 'Select',
  multi = false,
}: {
  value: string | string[] | null
  options: { value: string; label: string; color?: string; icon?: string }[]
  onChange: (next: string | string[] | null) => void
  renderValue?: (v: string | string[] | null) => React.ReactNode
  placeholder?: string
  multi?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const isArray = Array.isArray(value)
  const selectedSet = new Set(isArray ? (value as string[]) : value ? [value as string] : [])

  function toggleOption(optVal: string) {
    if (multi) {
      const next = new Set(selectedSet)
      if (next.has(optVal)) next.delete(optVal)
      else next.add(optVal)
      onChange(Array.from(next))
    } else {
      onChange(optVal)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs hover:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:border-slate-700"
      >
        <span className="flex items-center gap-1">
          {renderValue ? renderValue(value) : isArray ? (value as string[]).join(', ') || placeholder : (value as string) || placeholder}
        </span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:bg-slate-800 dark:border-slate-700">
          {options.map((opt) => {
            const active = selectedSet.has(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleOption(opt.value)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${active ? 'bg-slate-50 dark:bg-slate-700 font-semibold' : ''}`}
              >
                {opt.color && <span className="h-2 w-2 rounded-full" style={{ background: opt.color }} />}
                {opt.icon && <span className="text-xs">{opt.icon}</span>}
                <span className="flex-1">{opt.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-slate-900 dark:text-white" />}
              </button>
            )
          })}
          {multi && (
            <div className="flex justify-end border-t border-slate-100 px-2 py-1 dark:border-slate-700">
              <button onClick={() => setOpen(false)} className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover dark:bg-white dark:text-slate-900">
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
