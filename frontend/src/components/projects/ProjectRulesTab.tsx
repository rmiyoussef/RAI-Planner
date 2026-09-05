import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Plus, Pencil, Trash2, Save, X, Loader2, ListChecks, AlertCircle } from 'lucide-react'

type Rule = { id: string; content: string; enabled: boolean; position: number }

export function ProjectRulesTab({ projectId }: { projectId: string }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setRules(await api.get(`/projects/${projectId}/rules`))
    } catch (e: any) {
      setError(e.message || 'Could not load rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function add() {
    const content = draft.trim()
    if (!content) return
    setBusyId('new')
    try {
      const created = await api.post(`/projects/${projectId}/rules`, { content })
      setRules((r) => [...r, created])
      setDraft('')
      setAdding(false)
    } catch (e: any) {
      setError(e.message || 'Could not add rule.')
    } finally {
      setBusyId(null)
    }
  }

  async function saveEdit(id: string) {
    const content = editDraft.trim()
    if (!content) return
    setBusyId(id)
    try {
      const updated = await api.patch(`/projects/${projectId}/rules/${id}`, { content })
      setRules((rs) => rs.map((r) => (r.id === id ? updated : r)))
      setEditingId(null)
    } catch (e: any) {
      setError(e.message || 'Could not save rule.')
    } finally {
      setBusyId(null)
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setBusyId(id)
    try {
      const updated = await api.patch(`/projects/${projectId}/rules/${id}`, { enabled: !enabled })
      setRules((rs) => rs.map((r) => (r.id === id ? updated : r)))
    } catch (e: any) {
      setError(e.message || 'Could not update rule.')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this rule? The AI will no longer consider it.')) return
    setBusyId(id)
    try {
      await api.delete(`/projects/${projectId}/rules/${id}`)
      setRules((rs) => rs.filter((r) => r.id !== id))
    } catch (e: any) {
      setError(e.message || 'Could not delete rule.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card shrink-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary border border-primary/10 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight">Project Rules</h3>
          <p className="text-xs text-muted-foreground">Mandatory constraints the AI must satisfy when generating tasks.</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
          {rules.filter((r) => r.enabled).length}/{rules.length} on
        </span>
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading rules…
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className={`rounded-2xl border p-4 transition-colors ${rule.enabled ? 'border-border bg-card' : 'border-dashed bg-muted/20 opacity-75'}`}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>Rule #{idx + 1}</span>
                <span className={`rounded-full px-2 py-0.5 ${rule.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' : 'bg-muted text-muted-foreground border border-border'}`}>
                  {rule.enabled ? 'On' : 'Off'}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={`Toggle rule ${idx + 1}`}
                    disabled={busyId === rule.id}
                    onClick={() => toggle(rule.id, rule.enabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${rule.enabled ? 'bg-primary' : 'bg-border'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </span>
              </div>
              {editingId === rule.id ? (
                <div className="mt-2.5 space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value.slice(0, 5000))}
                    rows={4}
                    autoFocus
                    className="input min-h-[110px] resize-y py-2.5 text-sm leading-relaxed"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button type="button" onClick={() => saveEdit(rule.id)} disabled={busyId === rule.id || !editDraft.trim()} className="btn btn-primary btn-sm disabled:opacity-50">
                      {busyId === rule.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed">{rule.content}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditingId(rule.id); setEditDraft(rule.content) }}
                      className="btn btn-outline btn-sm gap-1"
                      aria-label={`Edit rule ${idx + 1}`}
                    >
                      <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(rule.id)}
                      className="btn btn-outline btn-sm gap-1 text-destructive hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-950/40"
                      aria-label={`Delete rule ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Del</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!rules.length && (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
              No rules yet — add the first engineering constraint below.
            </p>
          )}
        </div>
      )}

      {adding ? (
        <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary-light/20 dark:bg-primary/5 p-4">
          <label htmlFor="new-rule" className="text-xs font-semibold">New rule (plain language, no special syntax)</label>
          <textarea
            id="new-rule"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 5000))}
            rows={4}
            autoFocus
            placeholder="e.g. Every Feature task must include API tests."
            className="input min-h-[110px] resize-y bg-card py-2.5 text-sm leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setDraft('') }} className="btn btn-ghost btn-sm">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button type="button" onClick={add} disabled={busyId === 'new' || !draft.trim()} className="btn btn-primary btn-sm disabled:opacity-50">
              {busyId === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Rule
            </button>
          </div>
        </div>
      ) : (
        !loading && (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-outline w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        )
      )}
    </div>
  )
}
