/** Reusable view config — new tabs are just new configs, not new components */

export type TaskItem = {
  id: string
  title: string
  status: string
  priority?: string
  // legacy single assignee + new multi
  assigned_to?: string | null
  assigned_user_name?: string | null
  assignees?: { id: string; name: string; avatar?: string }[]
  labels?: string[]
  tags?: string[]
  module?: string
  project_id?: string
  project_name?: string
  iteration?: string
  created_at: string
  updated_at?: string
  version?: number
  ai_generated?: boolean
  description?: string
}

export type SortConfig = {
  field: string
  direction: 'asc' | 'desc'
}

export type ViewConfig = {
  /** raw query string: e.g. '-status:"Completed" assignee:rami free text' */
  search: string
  groupBy: 'status' | 'priority' | 'project' | 'assignee' | 'none'
  sortBy: SortConfig | null
  visibleColumns: string[]
  /** row density */
  density?: 'compact' | 'comfortable' | 'spacious'
}

export type SavedView = {
  id: string
  name: string
  icon?: string
  config: ViewConfig
  ownerId?: string
  projectId?: string | null
  isDefault?: boolean
  count?: number
}

export const ALL_COLUMNS = [
  'rowNumber',
  'title',
  'module',
  'assignees',
  'labels',
  'status',
  'iteration',
  'created_at',
] as const

export type ColumnKey = (typeof ALL_COLUMNS)[number]

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'rowNumber',
  'title',
  'module',
  'assignees',
  'labels',
  'status',
  'iteration',
  'created_at',
]

export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  search: '',
  groupBy: 'status',
  sortBy: null,
  visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
  density: 'comfortable',
}
