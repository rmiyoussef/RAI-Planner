import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 bg-[#f8f9fb] px-3 py-2.5 dark:bg-slate-800 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="tabular-nums">
          Showing <span className="font-semibold text-slate-800 dark:text-slate-100">{start}-{end}</span> of <span className="font-semibold">{total}</span>
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5">
          <span className="h-1 w-px bg-slate-300 dark:bg-slate-600" />
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number
            if (totalPages <= 5) p = i + 1
            else if (page <= 3) p = i + 1
            else if (page >= totalPages - 2) p = totalPages - 4 + i
            else p = page - 2 + i
            const active = p === page
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border text-xs font-semibold tabular-nums ${active ? 'bg-primary border-primary text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'}`}
              >
                {p}
              </button>
            )
          })}
          {totalPages > 5 && page < totalPages - 2 && (
            <>
              <span className="px-1 text-xs text-slate-400">…</span>
              <button
                onClick={() => onPageChange(totalPages)}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
