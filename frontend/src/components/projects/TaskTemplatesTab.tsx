import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { Save, Loader2, LayoutTemplate, AlertCircle, X, Tag } from 'lucide-react'

type TplType = 'task' | 'feature' | 'bug'
type Tpl = { id: string; name: string; type: string; content: string; is_default: boolean }

const ORDER: TplType[] = ['task', 'feature', 'bug']
const TYPE_LABEL: Record<TplType, string> = { task: 'Task', feature: 'Feature', bug: 'Bug' }

export function TaskTemplatesTab({ projectId }: { projectId: string }) {
  const [templates, setTemplates] = useState<Tpl[]>([])
  const [active, setActive] = useState<TplType>('task')
  const [drafts, setDrafts] = useState<Record<string, { name: string; content: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedTick, setSavedTick] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const list: Tpl[] = await api.get(`/projects/${projectId}/task-templates`)
      setTemplates(list)
      const d: Record<string, { name: string; content: string }> = {}
      for (const t of list) d[t.id] = { name: t.name, content: t.content }
      setDrafts(d)
      const first = ORDER.find((ty) => list.some((t) => t.type === ty)) ?? 'task'
      setActive(first)
    } catch (e: any) {
      setError(e.message || 'Could not load templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const byType = useMemo(() => {
    const m: Record<string, Tpl[]> = { task: [], feature: [], bug: [] }
    for (const t of templates) (m[t.type] ?? (m[t.type] = [])).push(t)
    return m
  }, [templates])

  // The template being edited: prefer the default one of the active type.
  const current: Tpl | undefined = useMemo(() => {
    const list = byType[active] ?? []
    return list.find((t) => t.is_default) ?? list[0]
  }, [byType, active])

  const draft = current ? drafts[current.id] : undefined
  const dirty = !!current && !!draft && (draft.name !== current.name || draft.content !== current.content)

  async function save() {
    if (!current || !draft || !dirty || saving) return
    setSaving(true)
    setError('')
    try {
      const updated: Tpl = await api.patch(`/projects/${projectId}/task-templates/${current.id}`, {
        name: draft.name.trim() || current.name,
        content: draft.content,
      })
      setTemplates((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
      setDrafts((d) => ({ ...d, [updated.id]: { name: updated.name, content: updated.content } }))
      setSavedTick(true)
      window.setTimeout(() => setSavedTick(false), 2000)
    } catch (e: any) {
      setError(e.message || 'Could not save template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card shrink-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
          <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight">Task Templates</h3>
          <p className="text-xs text-muted-foreground">Starting structures for AI generation — policy and rules always win.</p>
        </div>
        {savedTick && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
            Saved
          </span>
        )}
        {dirty && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
            Unsaved changes
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Template types">
            {ORDER.map((ty) => {
              const n = (byType[ty] ?? []).length
              const isActive = active === ty
              return (
                <button
                  key={ty}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(ty)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-primary/30 bg-primary-light text-primary dark:bg-primary/10'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-slate-300'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                  {TYPE_LABEL[ty]}
                  <span className="rounded-full bg-muted px-1.5 py-0 text-[11px] font-bold tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>

          {current && draft ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="tpl-name" className="text-xs font-semibold tracking-wide">Template name</label>
                <input
                  id="tpl-name"
                  value={draft.name}
                  onChange={(e) => setDrafts((d) => ({ ...d, [current.id]: { ...draft, name: e.target.value.slice(0, 200) } }))}
                  className="input cursor-text"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="tpl-content" className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wide">
                  <span>Template content <span className="font-normal text-muted-foreground">— supports {'{{title}}'}, {'{{project_name}}'}, {'{{task_type}}'}, {'{{description}}'}, {'{{priority}}'}, {'{{status}}'}</span></span>
                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{draft.content.length.toLocaleString()} chars</span>
                </label>
                <textarea
                  id="tpl-content"
                  value={draft.content}
                  onChange={(e) => setDrafts((d) => ({ ...d, [current.id]: { ...draft, content: e.target.value.slice(0, 20000) } }))}
                  rows={16}
                  spellCheck={false}
                  className="input min-h-[380px] resize-y py-3 font-mono text-[13px] leading-relaxed"
                />
              </div>
              {(byType[active] ?? []).length > 1 && (
                <p className="text-[11px] font-medium text-muted-foreground">
                  {byType[active].length} {TYPE_LABEL[active]} templates — editing “{current.name}”
                  {current.is_default ? ' (default)' : ''}. Task creation lists all of them.
                </p>
              )}
              <div className="flex justify-end">
                <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-primary gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
              No {TYPE_LABEL[active]} template yet.
            </p>
          )}
        </>
      )}
    </div>
  )
}
