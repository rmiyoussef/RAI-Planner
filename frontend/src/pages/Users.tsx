import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
  Users as UsersIcon,
  Link2,
  Mail,
  UserPlus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  ExternalLink,
  CalendarDays,
  AtSign,
  Save,
  ShieldCheck,
  Search,
  Hash,
  CheckCircle2,
  Briefcase,
} from 'lucide-react'

function isValidGithubUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return false
    if (u.hostname.toLowerCase() !== 'github.com') return false
    const parts = u.pathname.split('/').filter(Boolean)
    return parts.length >= 1 && /^[A-Za-z0-9_.-]+$/.test(parts[0])
  } catch {
    return false
  }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Users() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', github_url: '', job_title: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const githubValid = form.github_url ? isValidGithubUrl(form.github_url) : true
  const editGithubValid = editForm.github_url ? isValidGithubUrl(editForm.github_url) : true

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/users')
      setItems(data.items ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    setError('')
    setSuccess('')
    if (!form.full_name.trim()) {
      setError('Full name is required.')
      return
    }
    if (!form.github_url.trim()) {
      setError('GitHub URL is required.')
      return
    }
    if (!isValidGithubUrl(form.github_url)) {
      setError('GitHub URL must be a valid https://github.com/username link.')
      return
    }
    try {
      await api.post('/users', {
        full_name: form.full_name.trim(),
        email: form.email.trim() || undefined,
        github_url: form.github_url.trim(),
        job_title: form.job_title.trim() || undefined,
      })
      setForm({ full_name: '', email: '', github_url: '', job_title: '' })
      setShowCreate(false)
      setSuccess('User created successfully.')
      load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function saveEdit(id: string) {
    setError('')
    setSuccess('')
    if (!editForm.full_name?.trim()) {
      setError('Full name is required.')
      return
    }
    if (!editForm.github_url?.trim() || !isValidGithubUrl(editForm.github_url)) {
      setError('Provide a valid GitHub URL (https://github.com/username).')
      return
    }
    try {
      await api.put(`/users/${id}`, {
        full_name: editForm.full_name.trim(),
        email: editForm.email?.trim() || null,
        github_url: editForm.github_url.trim(),
        job_title: editForm.job_title?.trim() || null,
      })
      setEditing(null)
      setSuccess('User updated.')
      load()
      setTimeout(() => setSuccess(''), 2500)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function del(id: string) {
    if (!confirm('Remove this user? This action cannot be undone.')) return
    try {
      setError('')
      await api.delete(`/users/${id}`)
      setSuccess('User removed.')
      load()
      setTimeout(() => setSuccess(''), 2500)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8 animate-in motion-reduce:animate-none">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm"
              aria-hidden="true"
            >
              <UsersIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Users</h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary-light px-2.5 py-1 text-xs font-bold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Internal only
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Internal team members for task assignment — secure, private, and never exposed as login accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="btn btn-primary shrink-0 cursor-pointer shadow-sm"
          aria-expanded={showCreate}
          aria-controls="create-user-card"
        >
          {showCreate ? <X className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          {showCreate ? 'Close' : 'New User'}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-medium flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto shrink-0 cursor-pointer rounded-lg p-1 text-red-600 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-900/40"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-medium flex-1">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="ml-auto shrink-0 cursor-pointer rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            aria-label="Dismiss success"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create card */}
      {showCreate && (
        <div
          id="create-user-card"
          className="card space-y-5 border-primary/10 shadow-glass animate-in motion-reduce:animate-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-primary-light text-primary">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Create User</h3>
                <p className="text-xs font-medium text-muted-foreground">Add an internal member — linked to GitHub for assignment.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn btn-ghost btn-sm cursor-pointer"
              aria-label="Close create form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="user-fullname" className="text-xs font-semibold tracking-wide text-foreground">
                Full name <span className="font-normal text-destructive">*</span>
              </label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="user-fullname"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Alex Morgan"
                  className="input cursor-text pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="user-email" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Email
                <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="alex@company.com"
                className="input cursor-text"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="user-jobtitle" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Job title <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="user-jobtitle"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="e.g. Senior Engineer"
                className="input cursor-text"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="user-github" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                GitHub URL <span className="font-normal text-destructive">*</span>
              </label>
              <input
                id="user-github"
                value={form.github_url}
                onChange={(e) => setForm({ ...form, github_url: e.target.value })}
                placeholder="https://github.com/octocat"
                className={`input cursor-text font-mono text-[13px] ${form.github_url && !githubValid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-invalid={!!form.github_url && !githubValid}
                aria-describedby="github-help"
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p id="github-help" className={`text-[11px] font-medium ${form.github_url && !githubValid ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                  {form.github_url && !githubValid ? 'Must be a valid https://github.com/username URL' : 'Public GitHub profile — we extract username automatically.'}
                </p>
                {form.github_url && githubValid && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Valid
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={create}
              disabled={!!form.github_url && !githubValid}
              className="btn btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create user
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="card overflow-hidden p-0">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Team directory
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold tabular-nums text-muted-foreground shadow-sm">
              <Hash className="h-3.5 w-3.5" aria-hidden="true" />
              {items.length} {items.length === 1 ? 'member' : 'members'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              Managed
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-12 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading users...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                      Full name
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      Email
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                      Job title
                    </span>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      GitHub
                    </span>
                  </th>
                  <th>Username</th>
                  <th className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      Created
                    </span>
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="group transition-colors hover:bg-muted/40">
                    <td className="min-w-[180px]">
                      {editing === u.id ? (
                        <input
                          value={editForm.full_name ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                          placeholder="Full name"
                          className="input h-9 cursor-text py-1.5 text-sm"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-[11px] font-bold text-white shadow-sm">
                            {initials(u.full_name || '??')}
                          </div>
                          <span className="font-semibold text-foreground">{u.full_name}</span>
                        </div>
                      )}
                    </td>

                    <td className="min-w-[180px]">
                      {editing === u.id ? (
                        <input
                          value={editForm.email ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          placeholder="email@company.com"
                          className="input h-9 cursor-text py-1.5 text-sm"
                        />
                      ) : u.email ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[200px]">{u.email}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="min-w-[160px]">
                      {editing === u.id ? (
                        <input
                          value={editForm.job_title ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                          placeholder="e.g. Senior Engineer"
                          className="input h-9 cursor-text py-1.5 text-sm"
                          maxLength={100}
                        />
                      ) : u.job_title ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate max-w-[180px]">{u.job_title}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="min-w-[220px] max-w-[280px]">
                      {editing === u.id ? (
                        <div className="space-y-1">
                          <input
                            value={editForm.github_url ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                            placeholder="https://github.com/username"
                            className={`input h-9 cursor-text py-1.5 font-mono text-xs ${editForm.github_url && !editGithubValid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                            aria-invalid={!!editForm.github_url && !editGithubValid}
                          />
                          {editForm.github_url && !editGithubValid && (
                            <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Invalid GitHub URL</p>
                          )}
                        </div>
                      ) : (
                        <a
                          href={u.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 font-mono text-xs font-medium text-primary underline-offset-2 hover:bg-primary-light hover:border-primary/20 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                          title={u.github_url}
                        >
                          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{u.github_url?.replace('https://github.com/', '') || u.github_url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </a>
                      )}
                    </td>

                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
                        <AtSign className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        {u.github_username || '—'}
                      </span>
                    </td>

                    <td className="whitespace-nowrap text-sm font-medium tabular-nums text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>

                    <td className="whitespace-nowrap text-right">
                      {editing === u.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(u.id)}
                            disabled={!!editForm.github_url && !editGithubValid}
                            className="btn btn-primary btn-sm cursor-pointer gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                            Save
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost btn-sm cursor-pointer">
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(u.id)
                              setEditForm({ full_name: u.full_name, email: u.email || '', github_url: u.github_url, job_title: u.job_title || '' })
                              setError('')
                            }}
                            className="btn btn-outline btn-sm cursor-pointer gap-1.5 hover:border-primary/30 hover:bg-primary-light hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => del(u.id)}
                            className="btn btn-outline btn-sm cursor-pointer gap-1.5 text-destructive hover:bg-red-50 hover:text-destructive hover:border-red-200 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && !items.length && (
          <div className="flex flex-col items-center justify-center gap-3 border-t border-border bg-muted/20 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
              <UsersIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No team members yet</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Add internal users to assign tasks and track ownership. They won&apos;t receive login credentials.
              </p>
            </div>
            {!showCreate && (
              <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary mt-1 cursor-pointer">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add first user
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
          <span className="tabular-nums">
            Showing <span className="font-semibold text-foreground">{items.length}</span> {items.length === 1 ? 'user' : 'users'}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Synced
          </span>
        </div>
      </div>

      {/* Trust note */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary border border-primary/10">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Privacy &amp; security</p>
          <p className="text-xs leading-relaxed font-medium text-muted-foreground">
            Internal users are stored securely and used only for task assignment. No passwords or login access are created.
            GitHub links help your business verify ownership and keep delivery accountable.
          </p>
        </div>
      </div>
    </div>
  )
}
