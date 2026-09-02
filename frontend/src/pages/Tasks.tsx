import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { MarkdownPreview } from '../components/Markdown'
import { useSearchParams } from 'react-router-dom'

export function Tasks() {
  const [searchParams] = useSearchParams()
  const initialProject = searchParams.get('project_id') || ''
  const [items, setItems] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [filterProject, setFilterProject] = useState(initialProject)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ project_id:'', title:'', description:'', priority:'medium', status:'todo', assigned_to:'', tags:'' })
  const [selected, setSelected] = useState<any|null>(null)
  const [drawerTab, setDrawerTab] = useState<'edit'|'preview'>('edit')
  const [versions, setVersions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  async function load() {
    const q = new URLSearchParams()
    if (filterProject) q.set('project_id', filterProject)
    const data = await api.get(`/tasks?${q.toString()}`)
    setItems(data.items)
  }
  async function loadMeta(){
    try{
      const p = await api.get('/projects?limit=100')
      setProjects(p.items)
      const u = await api.get('/users')
      setUsers(u.items)
      if (!form.project_id && p.items[0]) setForm(f=>({...f, project_id: initialProject || p.items[0].id}))
    }catch{}
  }
  useEffect(()=>{ load(); loadMeta() }, [filterProject])
  useEffect(()=>{ if(initialProject) setFilterProject(initialProject)}, [initialProject])

  async function create(){
    try{
      await api.post('/tasks', {
        project_id: form.project_id, title: form.title, description: form.description,
        priority: form.priority, status: form.status, assigned_to: form.assigned_to||null,
        tags: form.tags.split(',').map(s=>s.trim()).filter(Boolean)
      })
      setShowCreate(false); setForm(f=>({...f, title:'', description:'', tags:''})); load()
    }catch(e:any){ setError(e.message)}
  }

  async function openTask(id:string){
    const t = await api.get(`/tasks/${id}`)
    setSelected(t); setEditForm(t); setIsEditing(false); setDrawerTab('edit')
    const vs = await api.get(`/tasks/${id}/versions`)
    setVersions(vs)
    const acts = await api.get(`/tasks/${id}/activities`)
    setActivities(acts)
  }

  async function saveEdit(){
    try{
      const updated = await api.put(`/tasks/${selected.id}`, {
        title: editForm.title, description: editForm.description, priority: editForm.priority,
        status: editForm.status, assigned_to: editForm.assigned_to||null,
        tags: typeof editForm.tags === 'string' ? editForm.tags.split(',').map((s:string)=>s.trim()).filter(Boolean) : editForm.tags
      })
      setSelected(updated)
      const vs = await api.get(`/tasks/${selected.id}/versions`)
      setVersions(vs)
      const acts = await api.get(`/tasks/${selected.id}/activities`)
      setActivities(acts)
      load()
      setIsEditing(false)
    }catch(e:any){ setError(e.message)}
  }

  async function generate(){
    if(selected?.ai_generated) return
    setGenerating(true)
    setError('')
    try{
      const res = await api.post(`/tasks/${selected.id}/generate`, {})
      setSelected(res.task)
      setEditForm(res.task)
      // reload versions/activities
      setVersions(await api.get(`/tasks/${selected.id}/versions`))
      setActivities(await api.get(`/tasks/${selected.id}/activities`))
      load()
    }catch(e:any){ setError(e.message)}
    finally{ setGenerating(false)}
  }

  function copy(){
    navigator.clipboard.writeText(selected?.description||'')
  }
  function download(){
    const blob = new Blob([selected?.description||''], {type:'text/markdown'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download=`${selected?.title||'task'}.md`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tasks</h1>
        <button className="btn btn-primary" onClick={()=>setShowCreate(!showCreate)}>Create New Task</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="filters">
        <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {showCreate && (
        <div className="card">
          <h3>Create Task</h3>
          <label>Project<select value={form.project_id} onChange={e=>setForm({...form, project_id:e.target.value})}>{projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Title<input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} /></label>
          <label>Description (Markdown)<textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} rows={4} /></label>
          <div className="grid-2">
            <label>Priority<select value={form.priority} onChange={e=>setForm({...form, priority:e.target.value})}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></label>
            <label>Status<select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}><option value="todo">todo</option><option value="in_progress">in_progress</option><option value="in_review">in_review</option><option value="done">done</option><option value="archived">archived</option></select></label>
          </div>
          <label>Assigned To<select value={form.assigned_to} onChange={e=>setForm({...form, assigned_to:e.target.value})}><option value="">Unassigned</option>{users.map(u=> <option key={u.id} value={u.id}>{u.full_name} ({u.github_username})</option>)}</select></label>
          <label>Tags<input value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} placeholder="comma separated" /></label>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Project</th><th>Priority</th><th>Assigned To</th><th>Created At</th><th>Status</th></tr></thead>
          <tbody>
            {items.map(t=> (
              <tr key={t.id} onClick={()=>openTask(t.id)} style={{cursor:'pointer'}}>
                <td>{t.title}</td>
                <td>{t.project_name||t.project_id}</td>
                <td><span className={`badge priority-${t.priority}`}>{t.priority}</span></td>
                <td>{t.assigned_user_name || '—'}</td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td><span className={`badge status-${t.status}`}>{t.status}</span>{t.ai_generated && ' 🤖'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="muted">No tasks yet.</p>}
      </div>

      {selected && (
        <div className="drawer-overlay" onClick={()=>setSelected(null)}>
          <div className="drawer" onClick={e=>e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2>{selected.title}</h2>
                <div className="pill-list">
                  <span className={`badge status-${selected.status}`}>{selected.status}</span>
                  <span className={`badge priority-${selected.priority}`}>{selected.priority}</span>
                  {selected.ai_generated && <span className="badge">AI Generated</span>}
                </div>
              </div>
              <button className="btn" onClick={()=>setSelected(null)}>✕ Close</button>
            </div>

            <div className="drawer-content">
              {/* Metadata */}
              <div className="card">
                <h3>Metadata</h3>
                <p>Project: {selected.project_name}</p>
                <p>Assigned: {selected.assigned_user_name || 'Unassigned'} {selected.assigned_to && <span className="muted">{selected.assigned_to}</span>}</p>
                <p>Tags: {selected.tags.join(', ') || '—'}</p>
                <p>Created: {new Date(selected.created_at).toLocaleString()} | Updated: {new Date(selected.updated_at).toLocaleString()}</p>
                <p>Version: {selected.version}</p>
                {!isEditing ? <button className="btn" onClick={()=>setIsEditing(true)}>Edit Task</button> : null}
                {isEditing && (
                  <>
                    <label>Title<input value={editForm.title} onChange={e=>setEditForm({...editForm, title:e.target.value})} /></label>
                    <label>Priority<select value={editForm.priority} onChange={e=>setEditForm({...editForm, priority:e.target.value})}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></label>
                    <label>Status<select value={editForm.status} onChange={e=>setEditForm({...editForm, status:e.target.value})}><option value="todo">todo</option><option value="in_progress">in_progress</option><option value="in_review">in_review</option><option value="done">done</option><option value="archived">archived</option></select></label>
                    <label>Assigned<select value={editForm.assigned_to||''} onChange={e=>setEditForm({...editForm, assigned_to:e.target.value})}><option value="">Unassigned</option>{users.map(u=> <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
                    <label>Tags<input value={Array.isArray(editForm.tags)? editForm.tags.join(', '):editForm.tags} onChange={e=>setEditForm({...editForm, tags:e.target.value})} /></label>
                  </>
                )}
              </div>

              {/* Markdown editor */}
              <div className="card">
                <div className="tabs">
                  <button className={drawerTab==='edit'?'active':''} onClick={()=>setDrawerTab('edit')}>Markdown Editor</button>
                  <button className={drawerTab==='preview'?'active':''} onClick={()=>setDrawerTab('preview')}>Preview</button>
                </div>
                {drawerTab==='edit' ? (
                  <>
                    <textarea rows={12} value={isEditing ? editForm.description : selected.description} onChange={e=> isEditing ? setEditForm({...editForm, description:e.target.value}) : null} readOnly={!isEditing} placeholder="Markdown description" />
                    {isEditing && <button className="btn btn-primary" onClick={saveEdit}>Save</button>}
                  </>
                ) : (
                  <MarkdownPreview content={isEditing ? editForm.description : selected.description} />
                )}
                <div className="btn-row">
                  <button className="btn" onClick={copy}>Copy</button>
                  <button className="btn" onClick={download}>Download</button>
                </div>
              </div>

              {/* AI Generation */}
              <div className="card">
                <h3>Smart Engineering Agent</h3>
                {generating && <div className="progress"><p>Reading project → Reading .brain → Building context → Analyzing task → Generating task → Saving version</p><div className="spinner" /></div>}
                <button className="btn btn-primary" disabled={!!selected.ai_generated || generating} onClick={generate}>
                  Generate task With AI
                </button>
                {selected.ai_generated && <p className="muted">AI generation has already been performed for this task.</p>}
                {!selected.ai_generated && <p className="muted">AI will inspect project and .brain to rewrite task.</p>}
              </div>

              {/* Activity */}
              <div className="card">
                <h3>Activity</h3>
                {activities.map(a=> (
                  <div key={a.id} className="activity">
                    <span className="mono">{new Date(a.timestamp).toLocaleString()}</span> — <strong>{a.action}</strong> v{a.version}
                    {a.changes?.length ? <ul>{a.changes.map((c:any,i:number)=> <li key={i}>{c.field}: {String(c.old_value)} → {String(c.new_value)}</li>)}</ul> : null}
                  </div>
                ))}
                {!activities.length && <p className="muted">No activity</p>}
              </div>

              {/* Timeline */}
              <div className="card">
                <h3>Timeline — Versions</h3>
                {versions.map(v=> (
                  <div key={v.id} className="version">
                    <strong>v{v.version}</strong> — {v.title} <span className="muted">{new Date(v.created_at).toLocaleString()}</span>
                    <details><summary>View description</summary><pre>{v.description.slice(0,1000)}</pre></details>
                    {v.version !== selected.version && <span className="muted">Read-only (only latest can be edited)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
