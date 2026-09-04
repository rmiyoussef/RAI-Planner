import { useState } from 'react'
import { Plus, X, Bookmark, MoreHorizontal, Check } from 'lucide-react'
import type { SavedView } from './types'

export function SavedViewTabs({
  views,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
}: {
  views: SavedView[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename?: (id: string, name: string) => void
  onDelete?: (id: string) => void
  onDuplicate?: (id: string) => void
}) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function submitNew() {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setShowNew(false)
  }

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-x-auto scrollbar-thin">
      <div className="flex items-center gap-1 px-2 py-1.5">
        {views.map((v) => {
          const active = v.id === activeId
          return (
            <div key={v.id} className="relative flex items-center">
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className={`group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border ${
                  active
                    ? 'bg-primary text-white border-primary shadow-sm dark:bg-white dark:text-slate-900 dark:border-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-[13px]">{v.icon ?? '📄'}</span>
                {editingId === v.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        onRename?.(v.id, editName)
                        setEditingId(null)
                      }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => {
                      if (editName.trim() && editName !== v.name) onRename?.(v.id, editName.trim())
                      setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-24 rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-900 dark:bg-slate-900 dark:text-white dark:border-slate-600"
                  />
                ) : (
                  <span>{v.name}</span>
                )}
                {typeof v.count === 'number' && (
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${active ? 'bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {v.count}
                  </span>
                )}
              </button>
              {/* overflow menu for custom views */}
              {!v.isDefault && (
                <button
                  type="button"
                  onClick={() => setMenuId(menuId === v.id ? null : v.id)}
                  className={`ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md ${active ? 'text-white/70 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  aria-label="View actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
              {menuId === v.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                  <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:bg-slate-800 dark:border-slate-700">
                    <button
                      onClick={() => {
                        setEditName(v.name)
                        setEditingId(v.id)
                        setMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Bookmark className="h-3.5 w-3.5" /> Rename
                    </button>
                    <button
                      onClick={() => {
                        onDuplicate?.(v.id)
                        setMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Check className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                    <button
                      onClick={() => {
                        onDelete?.(v.id)
                        setMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <X className="h-3.5 w-3.5" /> Delete view
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}

        {/* + New View */}
        {!showNew ? (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" /> New View
          </button>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 dark:bg-slate-800 dark:border-slate-600">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew()
                if (e.key === 'Escape') {
                  setShowNew(false)
                  setNewName('')
                }
              }}
              placeholder="View name"
              className="w-28 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400"
            />
            <button
              onClick={submitNew}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-slate-900"
              aria-label="Create view"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setShowNew(false)
                setNewName('')
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
