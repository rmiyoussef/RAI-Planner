import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'

export function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<any>(null)
  const [brain, setBrain] = useState<any>(null)
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState<any>({})
  const [error, setError] = useState('')

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
    try {
      await api.put(`/projects/${id}`, {
        name: form.name, description: form.description, project_path: form.project_path, tags: form.tags, status: form.status
      })
      setEdit(false); load()
    } catch(e:any){ setError(e.message)}
  }

  if (!project) return <div className="page">{error ? <div className="alert alert-error">{error}</div> : 'Loading...'}</div>

  return (
    <div className="page">
      <Link to="/projects" className="muted">← Back to Projects</Link>
      <div className="page-header"><h1>{project.name}</h1><button className="btn" onClick={()=>setEdit(!edit)}>{edit?'Cancel':'Edit'}</button></div>
      {project.status==='disabled' && <div className="alert alert-warn">Project is disabled</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {edit ? (
        <div className="card">
          <label>Name<input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></label>
          <label>Description<textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} /></label>
          <label>Path<input value={form.project_path} onChange={e=>setForm({...form, project_path:e.target.value})} /></label>
          <label>Tags<input value={(form.tags||[]).join(', ')} onChange={e=>setForm({...form, tags:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} /></label>
          <label>Status<select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      ) : (
        <div className="card">
          <p><strong>Description:</strong> {project.description || <span className="muted">—</span>}</p>
          <p><strong>Path:</strong> <span className="mono">{project.project_path}</span></p>
          <p><strong>Tags:</strong> {project.tags.join(', ') || '—'}</p>
          <p><strong>Status:</strong> <span className={`badge status-${project.status}`}>{project.status}</span></p>
          <p><strong>Created:</strong> {new Date(project.created_at).toLocaleString()}</p>
          <p><strong>Updated:</strong> {new Date(project.updated_at).toLocaleString()}</p>
          <p><strong>Tasks:</strong> {project.task_count} <Link to={`/tasks?project_id=${project.id}`} className="btn btn-sm">View tasks</Link></p>
        </div>
      )}

      <div className="card">
        <h3>AI Project Brain</h3>
        {brain?.exists ? (
          <>
            <div className="alert alert-success">AI project brain is available ✓</div>
            {brain.files && <div><p className="muted">Files in .brain ({brain.file_count})</p><ul>{brain.files.map((f:string)=><li key={f} className="mono">{f}</li>)}</ul></div>}
          </>
        ) : (
          <div className="alert alert-warn" style={{fontWeight:600, fontSize:'1.05em'}}>the ai tool need to instal on this project</div>
        )}
        <p className="muted mono">{brain?.path}</p>
      </div>
    </div>
  )
}
