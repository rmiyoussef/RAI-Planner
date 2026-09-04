import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  FolderKanban,
  Tag,
  Calendar,
  FileText,
  Brain,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Hash,
  Clock,
  MapPin,
  Eye,
  Copy,
  Download,
  Loader2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { MarkdownPreview } from '../components/Markdown'

export function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<any>(null)
  const [brain, setBrain] = useState<any>(null)
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState<any>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // brain file modal
  const [brainFile, setBrainFile] = useState<{ path: string; content: string; size?: number } | null>(null)
  const [brainFileLoading, setBrainFileLoading] = useState(false)
  const [brainFileError, setBrainFileError] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['/']))

  type TreeNode = { name: string; path: string; isFolder: boolean; children: Map<string, TreeNode>; files: string[] }
  function buildFileTree(files: string[]): TreeNode {
    const root: TreeNode = { name: '', path: '/', isFolder: true, children: new Map(), files: [] }
    for (const f of [...files].sort()) {
      const parts = f.split('/')
      let cur = root
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        const isFile = isLast && part.includes('.')
        // treat last part with dot as file, otherwise folder + file
        if (isLast) {
          // file at current folder
          cur.files.push(f)
        } else {
          const folderPath = parts.slice(0, i + 1).join('/')
          if (!cur.children.has(part)) {
            cur.children.set(part, { name: part, path: folderPath, isFolder: true, children: new Map(), files: [] })
          }
          cur = cur.children.get(part)!
        }
      }
      // handle root files that were pushed as files but also need to handle single-part files
      // The above pushes every file to its parent's files, but for root files (no folder) we already did at root
      // For nested files, the above incorrectly also pushes to root; so we need cleaner logic:
    }
    // Rebuild properly to avoid duplicate root push
    const cleanRoot: TreeNode = { name: '', path: '/', isFolder: true, children: new Map(), files: [] }
    for (const f of [...files].sort()) {
      const parts = f.split('/')
      if (parts.length === 1) {
        cleanRoot.files.push(f)
      } else {
        let cur2 = cleanRoot
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          const folderPath = parts.slice(0, i + 1).join('/')
          if (!cur2.children.has(part)) {
            cur2.children.set(part, { name: part, path: folderPath, isFolder: true, children: new Map(), files: [] })
          }
          cur2 = cur2.children.get(part)!
        }
        cur2.files.push(f)
      }
    }
    return cleanRoot
  }

  function toggleFolder(path: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  async function load() {
    try {
      const p = await api.get(`/projects/${id}`)
      setProject(p); setForm(p)
      const b = await api.get(`/projects/${id}/brain`)
      setBrain(b)
    } catch(e:any){ setError(e.message)}
  }
  useEffect(()=>{ load() }, [id])

  async function save() {
    setSaving(true)
    try {
      await api.put(`/projects/${id}`, {
        name: form.name, description: form.description, project_path: form.project_path, tags: form.tags, status: form.status
      })
      setEdit(false); load()
    } catch(e:any){ setError(e.message)}
    finally{ setSaving(false) }
  }

  async function openBrainFile(relPath: string) {
    setBrainFile(null)
    setBrainFileError('')
    setBrainFileLoading(true)
    try {
      const data = await api.get(`/projects/${id}/brain/file?path=${encodeURIComponent(relPath)}`)
      setBrainFile({ path: data.path || relPath, content: data.content || '', size: data.size })
    } catch (e: any) {
      setBrainFileError(e.message || 'Failed to load file')
    } finally {
      setBrainFileLoading(false)
    }
  }

  function copyBrainFile() {
    if (brainFile?.content) navigator.clipboard.writeText(brainFile.content)
  }

  function downloadBrainFile() {
    if (!brainFile) return
    const blob = new Blob([brainFile.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = brainFile.path.split('/').pop() || 'brain.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!project) return (
    <div className="w-[95%] mx-auto py-12">
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading project...
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6 h-[calc(100dvh-120px)] overflow-hidden">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm shrink-0">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight leading-none">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">{project.project_path}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`badge ${project.status==='active' ? 'badge-success' : 'badge-danger'}`}>
                {project.status === 'active' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                {project.status}
              </span>
              <span className="badge badge-muted">
                <Hash className="w-3 h-3 mr-1" /> {project.task_count} tasks
              </span>
              <span className="badge badge-muted">
                <Clock className="w-3 h-3 mr-1" /> {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/tasks?project_id=${project.id}`} className="btn btn-outline gap-2">
            <ExternalLink className="w-4 h-4" /> View tasks
          </Link>
          <button onClick={()=>setEdit(!edit)} className={`btn ${edit ? 'btn-outline' : 'btn-primary'} gap-2`}>
            {edit ? <><X className="w-4 h-4" /> Cancel</> : <><Edit3 className="w-4 h-4" /> Edit</>}
          </button>
        </div>
      </div>

      {project.status==='disabled' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /> This project is disabled — tasks are preserved but no new work should be assigned.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {edit ? (
        <div className="card space-y-4 shrink-0 max-h-[45vh] overflow-auto">
          <h3 className="font-semibold flex items-center gap-2"><Edit3 className="w-4 h-4 text-primary" /> Edit project</h3>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project name</label>
              <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="input" placeholder="My Awesome Project" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} rows={3} className="input resize-none" placeholder="What does this project do?" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Project path</label>
              <input value={form.project_path} onChange={e=>setForm({...form, project_path:e.target.value})} className="input font-mono text-sm" placeholder="/opt/projects/my-project" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags (comma separated)</label>
                <input value={(form.tags||[]).join(', ')} onChange={e=>setForm({...form, tags:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} className="input" placeholder="web, api, v2" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Status</label>
                <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="input cursor-pointer">
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={()=>setEdit(false)} className="btn btn-ghost">Cancel</button>
            <button onClick={save} disabled={saving} className="btn btn-primary gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 shrink-0">
          <div className="card shrink-0">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Project overview</h3>
            <dl className="grid gap-4">
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0">Description</dt>
                <dd className="text-sm flex-1">{project.description || <span className="text-muted-foreground">— No description</span>}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="text-sm font-medium text-muted-foreground sm:w-32 shrink-0 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Tags</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {project.tags.length ? project.tags.map((t:string)=> <span key={t} className="badge badge-muted">{t}</span>) : <span className="text-sm text-muted-foreground">—</span>}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Created</p>
                  <p className="text-sm font-medium">{new Date(project.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Updated</p>
                  <p className="text-sm font-medium">{new Date(project.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </dl>
          </div>
        </div>
      )}

      <div className="card border-2 flex-1 min-h-0 flex flex-col overflow-hidden">
        <h3 className="font-semibold flex items-center gap-2 mb-4 shrink-0">
          <Brain className="w-5 h-5 text-primary" /> AI Project Brain
          {brain?.exists && <span className="badge badge-success ml-auto"><CheckCircle2 className="w-3 h-3 mr-1" /> Available</span>}
        </h3>
        {brain?.exists ? (
          <div className="space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI project brain is available</p>
                <p className="text-xs opacity-80 mt-0.5">The Smart Engineering Agent will use this context to generate high-quality tasks.</p>
              </div>
            </div>
            {brain.files && (() => {
              const tree = buildFileTree(brain.files)
              const countFiles = (n: TreeNode): number => n.files.length + Array.from(n.children.values()).reduce((a, c) => a + countFiles(c), 0)
              const renderNode = (node: TreeNode, depth: number): React.ReactNode => (
                <div key={node.path} className="space-y-1">
                  {Array.from(node.children.values())
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((child) => {
                    const isOpen = expandedFolders.has(child.path)
                    const fileCount = countFiles(child)
                    return (
                      <div key={child.path} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleFolder(child.path)}
                          className="w-full flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-left hover:bg-card hover:border-border hover:shadow-sm transition-colors group"
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          {isOpen ? <FolderOpen className="w-4 h-4 text-amber-500" /> : <Folder className="w-4 h-4 text-amber-500" />}
                          <span className="text-xs font-semibold truncate">{child.name}</span>
                          <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{fileCount}</span>
                        </button>
                        {isOpen && (
                          <div className="ml-2 pl-3 border-l border-border/60 space-y-1">
                            {renderNode(child, depth + 1)}
                            {child.files
                              .sort()
                              .map((f: string) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => openBrainFile(f)}
                                className="group/file w-full text-left font-mono text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 hover:border-primary/30 hover:bg-primary-light/30 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-colors cursor-pointer ml-1"
                                title={`Open ${f}`}
                              >
                                <span className="truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground group-hover/file:text-primary" />{f.split('/').pop()}</span>
                                <Eye className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/file:opacity-100 group-hover/file:text-primary" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {depth === 0 && node.files
                    .sort()
                    .map((f: string) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => openBrainFile(f)}
                      className="group w-full text-left font-mono text-xs bg-card border border-border rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 hover:border-primary/30 hover:bg-primary-light/30 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-colors cursor-pointer"
                      title={`Open ${f}`}
                    >
                      <span className="truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />{f}</span>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              )
              return (
                <div className="rounded-xl bg-muted/50 border border-border p-4 flex-1 flex flex-col min-h-0">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 shrink-0"><Hash className="w-3 h-3" /> .brain file manager — {brain.file_count} files in {tree.children.size + (tree.files.length ? 1 : 0)} folders — click file to preview</p>
                  <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-1 bg-background/50 rounded-lg border border-border/50 p-2">
                    {renderNode(tree, 0)}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Folder className="w-3 h-3" /> Folder
                    <span className="h-3 w-px bg-border" />
                    <FileText className="w-3 h-3" /> File — opens formatted markdown
                  </div>
                </div>
              )
            })()}
            <p className="font-mono text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg border inline-flex">{brain?.path}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-800 px-4 py-4 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="font-bold text-amber-900 dark:text-amber-200">the ai tool need to instal on this project</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Add a <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono">.brain/</code> directory to unlock AI task generation.</p>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{brain?.path}</p>
          </div>
        )}
      </div>

      {/* Brain file modal — formatted markdown — no top white gap */}
      {(brainFile || brainFileLoading || brainFileError) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 sm:pt-8 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="brain-modal-title">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setBrainFile(null); setBrainFileError('') }} aria-hidden="true" />
          <div className="relative flex max-h-[85vh] w-[95vw] max-w-7xl flex-col rounded-2xl bg-card shadow-xl overflow-hidden animate-in my-4 border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="brain-modal-title" className="truncate text-sm font-semibold" title={brainFile?.path || ''}>{brainFile?.path || 'Loading...'}</h3>
                  {brainFile?.size !== undefined && <p className="text-xs text-muted-foreground">{brainFile.size} bytes • .brain</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={copyBrainFile}
                  disabled={!brainFile?.content}
                  className="btn btn-outline btn-sm gap-1.5 disabled:opacity-50"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={downloadBrainFile}
                  disabled={!brainFile?.content}
                  className="btn btn-outline btn-sm gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => { setBrainFile(null); setBrainFileError('') }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-background p-6">
              {brainFileLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading file...
                </div>
              ) : brainFileError ? (
                <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {brainFileError}
                </div>
              ) : brainFile?.content ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <MarkdownPreview content={brainFile.content} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No content</p>
              )}
            </div>

            <div className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
              <span>Formatted markdown preview • read-only</span>
              <span className="font-mono hidden sm:inline truncate max-w-[200px]" title={brain?.path}>{brain?.path}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
