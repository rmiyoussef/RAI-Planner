import { useEffect, useMemo, useState } from 'react'
import { Mail, Plus, RefreshCw, Loader2, AlertCircle, X, ChevronDown, Package, Folder } from 'lucide-react'
import { emailApi, isLaravelProject, type GeneralEmailTemplate, type ProjectEmailTemplate } from '../api/emailTemplates'
import { GeneralEmailTemplateBadge, ProjectEmailTemplateBadge } from '../components/email/TemplateBadges'
import { EmailTemplateEditor } from '../components/email/EmailTemplateEditor'

type TypeFilter = 'all' | 'general' | 'project'

export function EmailTemplates() {
  const [general, setGeneral] = useState<GeneralEmailTemplate[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string; framework: string }[]>([])
  const [projectId, setProjectId] = useState('')
  const [projectTemplates, setProjectTemplates] = useState<ProjectEmailTemplate[]>([])
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createKind, setCreateKind] = useState<'general' | 'project'>('general')
  const [form, setForm] = useState({ name: '', description: '', content: '<html>\n  <body>\n    <h1>Welcome {company_name}</h1>\n    <p>Hello {employee_name}</p>\n    <a href="{login_url}">Login</a>\n  </body>\n</html>' })
  const [editingGeneral, setEditingGeneral] = useState<GeneralEmailTemplate | null>(null)
  const [editingProject, setEditingProject] = useState<{ tpl: ProjectEmailTemplate; pid: string } | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  async function loadGeneral() {
    try {
      setGeneral(await emailApi.listGeneral())
    } catch (e: any) {
      setError(e.message || 'Could not load general templates.')
    }
  }

  async function loadProjects() {
    try {
      const list = await emailApi.listProjects()
      // Email scanning supports Laravel backends only — filter the dropdown.
      // Fall back to all projects when none report Laravel (e.g. older backend).
      const laravel = list.filter((p) => isLaravelProject(p.framework))
      const visible = laravel.length ? laravel : list
      setProjects(visible)
      setProjectId((cur) => (visible.some((p) => p.id === cur) ? cur : visible[0]?.id || ''))
    } catch {}
  }

  async function loadProjectTemplates(pid: string, rescan = false) {
    if (!pid) {
      setProjectTemplates([])
      return
    }
    if (rescan) setScanning(true)
    try {
      const list = rescan ? await emailApi.scanProjectTemplates(pid) : await emailApi.listProjectTemplates(pid)
      // keep project name
      const pname = projects.find((p) => p.id === pid)?.name || ''
      setProjectTemplates(list.map((t) => ({ ...t, projectName: t.projectName || pname })))
    } catch (e: any) {
      setError(e.message || 'Could not scan project templates.')
      setProjectTemplates([])
    } finally {
      if (rescan) setScanning(false)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadGeneral(), loadProjects()])
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (projectId) loadProjectTemplates(projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  type SubGroup = {
    key: string
    title: string
    general: GeneralEmailTemplate[]
    project: ProjectEmailTemplate[]
  }
  type Group = {
    key: string
    title: string
    sub: string
    badge: 'general' | 'module'
    folders: SubGroup[]
  }

  /** Folder inside the emails dir, from the relative path ('' = top level). */
  function folderOf(t: ProjectEmailTemplate): string {
    const rel = t.relativePath || ''
    const idx = rel.lastIndexOf('/emails/')
    const after = idx === -1 ? rel : rel.slice(idx + '/emails/'.length)
    const slash = after.lastIndexOf('/')
    return slash === -1 ? '' : after.slice(0, slash)
  }

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = []
    if (typeFilter !== 'project' && general.length) {
      out.push({
        key: 'general', title: 'General Templates', sub: 'Stored in the database', badge: 'general',
        folders: [{ key: 'general/all', title: '', general, project: [] }],
      })
    }
    if (typeFilter !== 'general' && projectTemplates.length) {
      const byModule = new Map<string, ProjectEmailTemplate[]>()
      for (const t of projectTemplates) {
        const m = t.moduleName || ''
        if (!byModule.has(m)) byModule.set(m, [])
        byModule.get(m)!.push(t)
      }
      const mods = [...byModule.keys()].sort((a, b) => {
        if (!a) return -1
        if (!b) return 1
        return a.localeCompare(b)
      })
      const pname = projectTemplates[0]?.projectName || ''
      for (const m of mods) {
        const byFolder = new Map<string, ProjectEmailTemplate[]>()
        for (const t of byModule.get(m)!) {
          const f = folderOf(t)
          if (!byFolder.has(f)) byFolder.set(f, [])
          byFolder.get(f)!.push(t)
        }
        const folders = [...byFolder.keys()]
          .sort((a, b) => {
            if (!a) return -1
            if (!b) return 1
            return a.localeCompare(b)
          })
          .map((f) => ({
            key: `module:${m || '__none__'}/folder:${f || '__root__'}`,
            title: f ? `Folder: ${f}/` : 'Top level files',
            general: [] as GeneralEmailTemplate[],
            project: byFolder.get(f)!.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
          }))
        out.push({
          key: `module:${m || '__none__'}`,
          title: m ? `Module: ${m}` : 'No module',
          sub: pname ? `${pname} · resources/views/emails` : 'resources/views/emails',
          badge: 'module',
          folders,
        })
      }
    }
    return out
  }, [general, projectTemplates, typeFilter])

  const totalRows = groups.reduce(
    (n, g) => n + g.folders.reduce((m, f) => m + f.general.length + f.project.length, 0),
    0,
  )

  function renderGeneralRow(t: GeneralEmailTemplate) {
    return (
      <tr key={`g-${t.id}`}>
        <td>
          <button
            type="button"
            onClick={() => setEditingGeneral(t)}
            className="cursor-pointer font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            {t.name}
          </button>
        </td>
        <td><GeneralEmailTemplateBadge /></td>
        <td className="text-center tabular-nums">{t.variables?.length ?? 0}</td>
        <td className="whitespace-nowrap text-xs text-muted-foreground">{t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}</td>
      </tr>
    )
  }

  function renderProjectRow(t: ProjectEmailTemplate) {
    return (
      <tr key={`p-${t.id}`}>
        <td>
          <button
            type="button"
            onClick={() => setEditingProject({ tpl: t, pid: t.projectId })}
            className="cursor-pointer text-left font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            {t.name}
            <span className="block font-mono text-[11px] font-normal text-muted-foreground">{t.fileName}</span>
          </button>
        </td>
        <td><ProjectEmailTemplateBadge /></td>
        <td>{t.projectName}</td>
        <td><span className="badge badge-muted">{t.framework}</span></td>
        <td className="max-w-[260px]"><span title={t.relativePath} className="inline-block max-w-full truncate rounded-lg border border-border bg-muted/50 px-2 py-1 font-mono text-xs">{t.relativePath}</span></td>
        <td className="text-center tabular-nums">{t.variablesCount ?? t.variables.length}</td>
        <td className="whitespace-nowrap text-xs text-muted-foreground">{t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '—'}</td>
      </tr>
    )
  }

  async function createGeneral() {
    try {
      const t = await emailApi.createGeneral({ name: form.name.trim(), description: form.description.trim(), content: form.content })
      setGeneral((arr) => [t, ...arr])
      setShowCreate(false)
      setForm({ name: '', description: '', content: '' })
      setEditingGeneral(t)
    } catch (e: any) {
      setError(e.message || 'Could not create template.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm" aria-hidden="true">
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Email Templates</h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage reusable email templates and templates discovered from backend projects.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate((v) => !v)} className="btn btn-primary shrink-0 cursor-pointer shadow-sm" aria-expanded={showCreate}>
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? 'Close' : 'Add Template'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="font-medium flex-1">{error}</p>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X className="h-4 w-4" /></button>
        </div>
      )}

      {showCreate && (
        <div className="card space-y-4">
          <div className="flex gap-2" role="tablist" aria-label="Template type">
            {(['general', 'project'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={createKind === k}
                onClick={() => setCreateKind(k)}
                className={`btn btn-sm cursor-pointer ${createKind === k ? 'btn-primary' : 'btn-outline'}`}
              >
                {k === 'general' ? 'General Template' : 'Project Backend Template'}
              </button>
            ))}
          </div>
          {createKind === 'general' ? (
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 200) })} placeholder="Template name *" aria-label="Template name" className="input cursor-text" />
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 5000) })} placeholder="Description (optional)" aria-label="Description" className="input cursor-text" />
              </div>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value.slice(0, 200000) })} rows={8} spellCheck={false} aria-label="HTML content" className="input min-h-[180px] resize-y py-3 font-mono text-[13px]" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost">Cancel</button>
                <button type="button" onClick={createGeneral} disabled={!form.name.trim()} className="btn btn-primary disabled:opacity-50">Create Template</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Prefer selecting an existing discovered backend template.</p>
              <p className="mt-1">Select a project below to scan <span className="font-mono">resources/views/emails</span> and <span className="font-mono">Modules/*/resources/views/emails</span>. New source files are not created here.</p>
            </div>
          )}
        </div>
      )}

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5" role="tablist" aria-label="Type filter">
          {([['all', 'All'], ['general', 'General Templates'], ['project', 'Project Backend Templates']] as [typeof typeFilter, string][]).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={typeFilter === v}
              onClick={() => setTypeFilter(v)}
              className={`btn btn-sm cursor-pointer ${typeFilter === v ? 'btn-primary' : 'btn-outline'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <label htmlFor="et-project" className="text-xs font-semibold text-muted-foreground">Project:</label>
          <select id="et-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input h-[38px] cursor-pointer !w-auto pr-8">
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {projectId && (
            <button type="button" onClick={() => loadProjectTemplates(projectId, true)} disabled={scanning} className="btn btn-outline btn-sm cursor-pointer" title="Refresh/Rescan">
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {scanning ? 'Scanning…' : 'Refresh'}
            </button>
          )}
          {!loading && !projects.length && (
            <span className="text-xs font-medium text-muted-foreground">Laravel projects only — none found.</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center gap-2.5 py-12 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading email templates…
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          {groups.map((gr) => {
            const isCollapsed = !!collapsed[gr.key]
            const n = gr.folders.reduce((m, f) => m + f.general.length + f.project.length, 0)
            return (
              <div key={gr.key} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setCollapsed((m) => ({ ...m, [gr.key]: !m[gr.key] }))}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-2 bg-muted/50 px-4 py-2.5 text-left hover:bg-muted dark:bg-slate-800/50"
                >
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                  {gr.badge === 'general' ? (
                    <GeneralEmailTemplateBadge />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                      <Package className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  )}
                  <span className="text-sm font-semibold text-foreground">{gr.title}</span>
                  <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {n}
                  </span>
                  <span className="hidden max-w-[420px] truncate text-xs text-muted-foreground sm:inline">— {gr.sub}</span>
                </button>
                {!isCollapsed && gr.folders.map((fo) => {
                  const foCollapsed = !!collapsed[fo.key]
                  const foCount = fo.general.length + fo.project.length
                  const showFolderHeader = gr.badge === 'module' && (gr.folders.length > 1 || fo.title !== '')
                  return (
                    <div key={fo.key} className="border-t border-border/50 first:border-t-0">
                      {showFolderHeader ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setCollapsed((m) => ({ ...m, [fo.key]: !m[fo.key] }))}
                            aria-expanded={!foCollapsed}
                            className="flex w-full items-center gap-2 bg-card px-8 py-2 text-left hover:bg-muted/50"
                          >
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${foCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="font-mono text-[13px] font-semibold text-foreground">{fo.title}</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {foCount}
                            </span>
                          </button>
                          {!foCollapsed && (
                            <div className="overflow-x-auto border-t border-border/50">
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Template name</th><th>Type</th><th>Project</th><th>Framework</th>
                                    <th>Relative file path</th><th className="text-center">Variables</th><th>Updated</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fo.general.map(renderGeneralRow)}
                                  {fo.project.map(renderProjectRow)}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="overflow-x-auto border-t border-border/50 first:border-t-0">
                          <table className="table">
                            <thead>
                              {gr.badge === 'general' ? (
                                <tr>
                                  <th>Template name</th><th>Type</th><th className="text-center">Variables</th><th>Updated</th>
                                </tr>
                              ) : (
                                <tr>
                                  <th>Template name</th><th>Type</th><th>Project</th><th>Framework</th>
                                  <th>Relative file path</th><th className="text-center">Variables</th><th>Updated</th>
                                </tr>
                              )}
                            </thead>
                            <tbody>
                              {fo.general.map(renderGeneralRow)}
                              {fo.project.map(renderProjectRow)}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {!groups.length && (
            <div className="flex flex-col items-center gap-2 border-t border-border bg-muted/20 px-6 py-12 text-center">
              <Mail className="h-6 w-6 text-muted-foreground" />
              {typeFilter === 'general' ? (
                <><p className="text-sm font-semibold">No general email templates yet.</p><p className="text-sm text-muted-foreground">Create your first reusable email template.</p></>
              ) : typeFilter === 'project' ? (
                <><p className="text-sm font-semibold">No backend email templates found.</p><p className="text-sm text-muted-foreground">RAI Planner scans supported project email directories.</p></>
              ) : (
                <><p className="text-sm font-semibold">No email templates yet.</p><p className="text-sm text-muted-foreground">Create a general template or scan a Laravel project.</p></>
              )}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
            <span className="tabular-nums">Showing <span className="font-semibold text-foreground">{totalRows}</span> templates</span>
            <span className="hidden sm:inline">DATABASE-OWNED vs PROJECT-SOURCE-OWNED</span>
          </div>
        </div>
      )}

      {editingGeneral && (
        <EmailTemplateEditor
          kind="general"
          template={editingGeneral}
          onSaved={(t) => {
            setEditingGeneral(t)
            setGeneral((arr) => arr.map((x) => (x.id === t.id ? t : x)))
          }}
          onClose={() => setEditingGeneral(null)}
        />
      )}
      {editingProject && (
        <EmailTemplateEditor
          kind="project"
          template={editingProject.tpl}
          projectId={editingProject.pid}
          onSaved={(t) => {
            setEditingProject({ tpl: t, pid: editingProject.pid })
            setProjectTemplates((arr) => arr.map((x) => (x.id === t.id ? t : x)))
          }}
          onClose={() => setEditingProject(null)}
        />
      )}
    </div>
  )
}
