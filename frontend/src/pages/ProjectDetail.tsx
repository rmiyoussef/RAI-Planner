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
} from 'lucide-react'

export function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<any>(null)
  const [brain, setBrain] = useState<any>(null)
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState<any>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  if (!project) return (
    <div className="max-w-3xl mx-auto py-12">
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
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> This project is disabled — tasks are preserved but no new work should be assigned.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {edit ? (
        <div className="card space-y-4">
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
        <div className="grid gap-4">
          <div className="card">
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

      <div className="card border-2">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary" /> AI Project Brain
          {brain?.exists && <span className="badge badge-success ml-auto"><CheckCircle2 className="w-3 h-3 mr-1" /> Available</span>}
        </h3>
        {brain?.exists ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI project brain is available</p>
                <p className="text-xs opacity-80 mt-0.5">The Smart Engineering Agent will use this context to generate high-quality tasks.</p>
              </div>
            </div>
            {brain.files && (
              <div className="rounded-xl bg-muted/50 border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Hash className="w-3 h-3" /> Files in .brain ({brain.file_count})</p>
                <ul className="grid gap-1.5 max-h-40 overflow-auto">
                  {brain.files.map((f:string)=> <li key={f} className="font-mono text-xs bg-card border border-border rounded-lg px-2.5 py-1.5">{f}</li>)}
                </ul>
              </div>
            )}
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
    </div>
  )
}
