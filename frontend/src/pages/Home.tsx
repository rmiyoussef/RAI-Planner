import { useEffect, useState } from 'react'
import { api } from '../api/client'

function SimpleBar({ data, color }: { data: {date:string,count:number}[], color:string }) {
  if (!data.length) return <div className="muted">No data</div>
  const max = Math.max(...data.map(d=>d.count),1)
  return (
    <div className="bar-chart">
      {data.map(d=> (
        <div key={d.date} className="bar-row">
          <span className="bar-label">{d.date}</span>
          <div className="bar-track"><div className="bar-fill" style={{width: `${(d.count/max)*100}%`, background: color}} /></div>
          <span className="bar-count">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

export function Home() {
  const [data, setData] = useState<any>(null)
  const [gran, setGran] = useState<'daily'|'weekly'|'monthly'>('daily')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=> {
    setLoading(true)
    api.get(`/dashboard?granularity=${gran}`).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false))
  }, [gran])

  if (loading) return <div className="page"><p>Loading dashboard...</p></div>
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!data) return null
  return (
    <div className="page">
      <div className="page-header">
        <h1>Home Dashboard</h1>
        <select value={gran} onChange={e=>setGran(e.target.value as any)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{data.projects_total}</div><div className="stat-label">Total Projects</div></div>
        <div className="stat-card"><div className="stat-value">{data.projects_active}</div><div className="stat-label">Active</div></div>
        <div className="stat-card"><div className="stat-value">{data.projects_disabled}</div><div className="stat-label">Disabled</div></div>
        <div className="stat-card"><div className="stat-value">{data.tasks_total}</div><div className="stat-label">Total Tasks</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Tasks by Status</h3>
          <div className="pill-list">
            {Object.entries(data.tasks_by_status as Record<string,number>).map(([k,v])=> <span key={k} className="pill">{k}: {v as number}</span>)}
            {!Object.keys(data.tasks_by_status).length && <span className="muted">No tasks</span>}
          </div>
        </div>
        <div className="card">
          <h3>Tasks by Priority</h3>
          <div className="pill-list">
            {Object.entries(data.tasks_by_priority as Record<string,number>).map(([k,v])=> <span key={k} className="pill priority">{k}: {v as number}</span>)}
            {!Object.keys(data.tasks_by_priority).length && <span className="muted">No tasks</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Projects Created Over Time ({gran})</h3>
        <SimpleBar data={data.projects_created_over_time} color="#6366f1" />
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Tasks Created Over Time</h3>
          <SimpleBar data={data.tasks_created_over_time} color="#10b981" />
        </div>
        <div className="card">
          <h3>Tasks Completed Over Time</h3>
          <SimpleBar data={data.tasks_completed_over_time} color="#f59e0b" />
        </div>
      </div>
    </div>
  )
}
