/**
 * Plane.so-style status grouping meta
 * Covers Plane/Linear issue tracker grouping UX:
 * - status icon/color dot, emoji, count badge, description, overflow menu
 * - collapsible groups
 */

export type StatusMeta = {
  key: string
  label: string
  color: string // tailwind bg
  dot: string // hex for dot
  emoji: string
  description: string
  pillClass: string
}

export const STATUS_META: Record<string, StatusMeta> = {
  todo: {
    key: 'todo',
    label: 'Planning',
    color: 'bg-blue-500',
    dot: '#3b82f6',
    emoji: '📋',
    description: 'This is ready to be picked up',
    pillClass: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe] dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  },
  in_progress: {
    key: 'in_progress',
    label: 'In Progress',
    color: 'bg-sky-500',
    dot: '#0ea5e9',
    emoji: '⚡',
    description: 'Work in progress',
    pillClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900',
  },
  in_review: {
    key: 'in_review',
    label: 'Testing',
    color: 'bg-amber-400',
    dot: '#f59e0b',
    emoji: '🧪',
    description: 'Ready for testing & review',
    pillClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  },
  done: {
    key: 'done',
    label: 'Completed',
    color: 'bg-emerald-500',
    dot: '#10b981',
    emoji: '✅',
    description: 'This is completed',
    pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  },
  archived: {
    key: 'archived',
    label: 'On Hold',
    color: 'bg-orange-400',
    dot: '#fb923c',
    emoji: '⏸️',
    description: 'Paused — waiting to resume',
    pillClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
  },
  // Aliases for future-proof grouping based on Plane naming
  planning: {
    key: 'planning',
    label: 'Planning',
    color: 'bg-blue-500',
    dot: '#3b82f6',
    emoji: '📋',
    description: 'This is ready to be picked up',
    pillClass: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe] dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  },
  testing: {
    key: 'testing',
    label: 'Testing',
    color: 'bg-amber-400',
    dot: '#f59e0b',
    emoji: '🧪',
    description: 'Ready for testing & review',
    pillClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  },
  on_hold: {
    key: 'on_hold',
    label: 'On Hold',
    color: 'bg-orange-400',
    dot: '#fb923c',
    emoji: '⏸️',
    description: 'Paused — waiting to resume',
    pillClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
  },
  completed: {
    key: 'completed',
    label: 'Completed',
    color: 'bg-emerald-500',
    dot: '#10b981',
    emoji: '✅',
    description: 'This is completed',
    pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  },
}

export function getStatusMeta(status: string): StatusMeta {
  if (!status) return STATUS_META.todo
  const key = status.toLowerCase()
  return STATUS_META[key] ?? {
    key,
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color: 'bg-slate-400',
    dot: '#94a3b8',
    emoji: '📄',
    description: '',
    pillClass: 'bg-muted text-muted-foreground border-border',
  }
}

export const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'archived', 'done']
export function sortStatusKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a)
    const ib = STATUS_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}
