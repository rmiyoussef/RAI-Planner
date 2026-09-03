import type { SavedView, ViewConfig } from './types'
import { DEFAULT_VIEW_CONFIG } from './types'

const STORAGE_KEY = 'rai_task_views_v1'

function ownerKey(ownerId?: string | null, projectId?: string | null): string {
  return `rai_views:${ownerId ?? 'anon'}:${projectId ?? 'global'}`
}

export function loadViews(ownerId?: string | null, projectId?: string | null): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultViews(ownerId, projectId)
    const all: Record<string, SavedView[]> = JSON.parse(raw)
    const k = ownerKey(ownerId, projectId)
    const views = all[k]
    if (!views || !views.length) return defaultViews(ownerId, projectId)
    return views
  } catch {
    return defaultViews(ownerId, projectId)
  }
}

export function saveViews(views: SavedView[], ownerId?: string | null, projectId?: string | null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all: Record<string, SavedView[]> = raw ? JSON.parse(raw) : {}
    const k = ownerKey(ownerId, projectId)
    all[k] = views
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {}
}

export function defaultViews(ownerId?: string | null, projectId?: string | null): SavedView[] {
  const base: SavedView[] = [
    {
      id: 'backlog',
      name: 'Backlog',
      icon: '📋',
      isDefault: true,
      ownerId: ownerId ?? undefined,
      projectId: projectId ?? null,
      config: { ...DEFAULT_VIEW_CONFIG, search: '', groupBy: 'status', sortBy: null },
    },
    {
      id: 'my-tasks',
      name: 'My Tasks',
      icon: '👤',
      ownerId: ownerId ?? undefined,
      projectId: projectId ?? null,
      config: { ...DEFAULT_VIEW_CONFIG, search: 'assignee:me', groupBy: 'status', sortBy: null },
    },
    {
      id: 'testing',
      name: 'Testing',
      icon: '🧪',
      ownerId: ownerId ?? undefined,
      projectId: projectId ?? null,
      config: { ...DEFAULT_VIEW_CONFIG, search: 'status:"in_review"', groupBy: 'status', sortBy: null },
    },
  ]
  return base
}

export function createView(name: string, config: ViewConfig, ownerId?: string | null, projectId?: string | null): SavedView {
  return {
    id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'New View',
    icon: '✨',
    config: { ...config },
    ownerId: ownerId ?? undefined,
    projectId: projectId ?? null,
  }
}

export const ACTIVE_VIEW_KEY = 'rai_active_view_v1'
export function loadActiveViewId(ownerId?: string | null, projectId?: string | null): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_VIEW_KEY)
    if (!raw) return null
    const all: Record<string, string> = JSON.parse(raw)
    return all[ownerKey(ownerId, projectId)] ?? null
  } catch { return null }
}
export function saveActiveViewId(viewId: string, ownerId?: string | null, projectId?: string | null) {
  try {
    const raw = localStorage.getItem(ACTIVE_VIEW_KEY)
    const all: Record<string, string> = raw ? JSON.parse(raw) : {}
    all[ownerKey(ownerId, projectId)] = viewId
    localStorage.setItem(ACTIVE_VIEW_KEY, JSON.stringify(all))
  } catch {}
}
