/**
 * Centralized human-readable labels for task status & priority.
 * Never expose raw enum keys (e.g. "in_progress") to the UI.
 */

export const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  archived: 'Archived',
  // future-proof: also handle legacy/alternate keys if backend adds them
  task_created: 'Task Created',
  on_hold: 'On Hold',
  waiting_for_review: 'Waiting for Review',
}

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  very_high: 'Very High',
}

/**
 * Convert any snake_case / raw enum key to Title Case.
 * e.g. "in_progress" -> "In Progress", "very_high" -> "Very High"
 */
export function humanize(value: string): string {
  if (!value) return ''
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function statusLabel(status: string): string {
  if (!status) return ''
  return STATUS_LABELS[status] ?? humanize(status)
}

export function priorityLabel(priority: string): string {
  if (!priority) return ''
  return PRIORITY_LABELS[priority] ?? humanize(priority)
}

/** Badge tone classes for status */
export function statusTone(status: string): string {
  switch (status) {
    case 'todo':
      return 'badge badge-muted'
    case 'in_progress':
      return 'badge badge-primary'
    case 'in_review':
      return 'badge badge-warn'
    case 'done':
      return 'badge badge-success'
    case 'archived':
      return 'badge bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
    default:
      return 'badge badge-muted'
  }
}

/** Badge tone classes for priority */
export function priorityTone(priority: string): string {
  switch (priority) {
    case 'low':
      return 'badge bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
    case 'medium':
      return 'badge badge-primary'
    case 'high':
      return 'badge badge-warn'
    case 'critical':
      return 'badge badge-danger'
    default:
      return 'badge badge-muted'
  }
}
