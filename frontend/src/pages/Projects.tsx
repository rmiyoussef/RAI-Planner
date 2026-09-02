import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Link } from 'react-router-dom'

export function Projects() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name:'', description:'', project_path:'', tags:'', status:'active' })
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      if (status) q.set('status', status)
      const data = await api.get(`/projects?${q.toString()}`)
      setItems(data.items); setTotal(data.total)
    } catch(e:any){ setError(e.message)} finally { setLoading(false)}
  }
  useEffect(()=>{ load() }, [search, status])

  async function create() {
    try {
      await api.post('/projects', {
        name: form.name, description: form.description, project_path: form.project_path,
        tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean), status: form.status
      })
      setShowCreate(false); setForm({ name:'', description:'', project_path:'', tags:'', status:'active' })
      load()
    } catch(e:any){ setError(e.message)}
  }

  async function disable(id:string){
    if(!confirm('Disable project?')) return
    await api.post(`/projects/${id}/disable`, {})
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={()=>setShowCreate(!showCreate)}>Create Project</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="filters">
        <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {showCreate && (
        <div className="card">
          <h3>Create Project</h3>
          <label>Name<input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></label>
          <label>Description<textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} /></label>
          <label>Project Path<input value={form.project_path} onChange={e=>setForm({...form, project_path:e.target.value})} placeholder="/path/to/repo" /></label>
          <label>Tags (comma separated)<input value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} /></label>
          <label>Status<select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
          <button className="btn btn-primary" onClick={create}>Save</button>
        </div>
      )}

      {loading ? <p>Loading...</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Status</th><th>Tags</th><th>Path</th><th>Tasks</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(p=> (
                <tr key={p.id} className={p.status==='disabled'?'row-disabled':''}>
                  <td><Link to={`/projects/${p.id}`}>{p.name}</Link></td>
                  <td><span className={`badge status-${p.status}`}>{p.status}</span></td>
                  <td>{p.tags.join(', ')}</td>
                  <td className="mono">{p.project_path}</td>
                  <td>{p.task_count}</td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    {p.status!=='disabled' && <button className="btn btn-sm" onClick={()=>disable(p.id)}>Disable</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Total: {total}</p>
          {!items.length && <p className="muted">No projects yet. Create your first project.</p>}
        </div>
      )}
    </div>
  )
}
