import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function Users() {
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState({ full_name:'', email:'', github_url:'' })
  const [editing, setEditing] = useState<string|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [error, setError] = useState('')

  async function load(){
    const data = await api.get('/users')
    setItems(data.items)
  }
  useEffect(()=>{ load() }, [])

  async function create(){
    try{
      await api.post('/users', form)
      setForm({ full_name:'', email:'', github_url:''}); load()
    }catch(e:any){ setError(e.message)}
  }
  async function saveEdit(id:string){
    try{
      await api.put(`/users/${id}`, editForm)
      setEditing(null); load()
    }catch(e:any){ setError(e.message)}
  }
  async function del(id:string){
    if(!confirm('Remove user?')) return
    await api.delete(`/users/${id}`); load()
  }

  return (
    <div className="page">
      <h1>Users</h1>
      <p className="muted">Internal task-assignment users — cannot log in</p>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <h3>Create User</h3>
        <label>Full name<input value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} /></label>
        <label>Email<input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></label>
        <label>GitHub URL<input value={form.github_url} onChange={e=>setForm({...form, github_url:e.target.value})} placeholder="https://github.com/octocat" /></label>
        <button className="btn btn-primary" onClick={create}>Create</button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>GitHub</th><th>Username</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(u=> (
              <tr key={u.id}>
                <td>{editing===u.id ? <input value={editForm.full_name} onChange={e=>setEditForm({...editForm, full_name:e.target.value})} /> : u.full_name}</td>
                <td>{editing===u.id ? <input value={editForm.email||''} onChange={e=>setEditForm({...editForm, email:e.target.value})} /> : u.email||'—'}</td>
                <td>{editing===u.id ? <input value={editForm.github_url} onChange={e=>setEditForm({...editForm, github_url:e.target.value})} /> : <a href={u.github_url} target="_blank" rel="noopener">{u.github_url}</a>}</td>
                <td>{u.github_username}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  {editing===u.id ? (
                    <><button className="btn btn-sm" onClick={()=>saveEdit(u.id)}>Save</button><button className="btn btn-sm" onClick={()=>setEditing(null)}>Cancel</button></>
                  ) : (
                    <><button className="btn btn-sm" onClick={()=>{setEditing(u.id); setEditForm({full_name:u.full_name,email:u.email,github_url:u.github_url})}}>Edit</button><button className="btn btn-sm" onClick={()=>del(u.id)}>Remove</button></>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
