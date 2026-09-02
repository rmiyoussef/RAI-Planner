import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

export function Settings() {
  const { owner, refresh } = useAuth()
  const [tab, setTab] = useState<'profile'|'ai'|'agent'>('profile')
  const [profile, setProfile] = useState({ full_name: owner?.full_name||'', email: owner?.email||'' })
  const [pwd, setPwd] = useState({ current_password:'', new_password:'' })
  const [ai, setAi] = useState({ provider_url:'', model_name:'', api_key:'', masked:'', has_key:false })
  const [agentStatus, setAgentStatus] = useState<any>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [skills, setSkills] = useState<any[]>([])
  const [skillForm, setSkillForm] = useState({ name:'', description:'', instructions:'', enabled:true })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function loadAI(){
    const data = await api.get('/settings/ai-config')
    setAi({ provider_url: data.provider_url, model_name: data.model_name, api_key:'', masked: data.api_key_masked, has_key: data.has_key })
  }
  async function loadAgent(){
    const data = await api.get('/settings/agent')
    setAgentStatus(data)
    setSystemPrompt(data.system_prompt||'')
  }
  async function loadSkills(){
    const data = await api.get('/settings/skills')
    setSkills(data)
  }
  useEffect(()=>{ loadAI(); loadAgent(); loadSkills() }, [])
  useEffect(()=>{ if(owner) setProfile({full_name:owner.full_name,email:owner.email}) }, [owner])

  async function saveProfile(){
    try{
      await api.put('/auth/profile', profile)
      setMsg('Profile updated'); refresh()
    }catch(e:any){ setError(e.message)}
  }
  async function changePwd(){
    try{
      await api.post('/auth/change-password', pwd)
      setMsg('Password changed')
    }catch(e:any){ setError(e.message)}
  }
  async function saveAI(){
    try{
      const data = await api.put('/settings/ai-config', { provider_url: ai.provider_url, model_name: ai.model_name, api_key: ai.api_key })
      setAi({ ...ai, masked: data.api_key_masked, has_key: data.has_key, api_key:'' })
      setMsg('AI config saved and agent restarted')
      loadAgent()
    }catch(e:any){ setError(e.message)}
  }
  async function savePrompt(){
    await api.put('/settings/agent/prompt', { system_prompt: systemPrompt })
    setMsg('System prompt updated')
  }
  async function createSkill(){
    await api.post('/settings/skills', skillForm)
    setSkillForm({ name:'', description:'', instructions:'', enabled:true }); loadSkills()
  }
  async function toggleSkill(s:any){
    await api.put(`/settings/skills/${s.id}`, { enabled: !s.enabled }); loadSkills()
  }
  async function deleteSkill(id:string){
    await api.delete(`/settings/skills/${id}`); loadSkills()
  }
  async function restartAgent(){
    const data = await api.post('/settings/agent/restart', {})
    setAgentStatus(data); setMsg('Agent restarted')
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      <div className="tabs">
        <button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}>Profile</button>
        <button className={tab==='ai'?'active':''} onClick={()=>setTab('ai')}>AI Configuration</button>
        <button className={tab==='agent'?'active':''} onClick={()=>setTab('agent')}>Agent</button>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {tab==='profile' && (
        <div className="card">
          <h3>Profile</h3>
          <label>Full name<input value={profile.full_name} onChange={e=>setProfile({...profile, full_name:e.target.value})} /></label>
          <label>Email<input value={profile.email} onChange={e=>setProfile({...profile, email:e.target.value})} /></label>
          <button className="btn btn-primary" onClick={saveProfile}>Save profile</button>

          <h3>Change password</h3>
          <label>Current<input type="password" value={pwd.current_password} onChange={e=>setPwd({...pwd, current_password:e.target.value})} /></label>
          <label>New<input type="password" value={pwd.new_password} onChange={e=>setPwd({...pwd, new_password:e.target.value})} /></label>
          <button className="btn" onClick={changePwd}>Change password</button>
        </div>
      )}

      {tab==='ai' && (
        <div className="card">
          <h3>AI Configuration</h3>
          <p className="muted">Supports OpenAI-compatible APIs</p>
          <label>Provider URL<input value={ai.provider_url} onChange={e=>setAi({...ai, provider_url:e.target.value})} placeholder="https://api.openai.com/v1" /></label>
          <label>Model Name<input value={ai.model_name} onChange={e=>setAi({...ai, model_name:e.target.value})} placeholder="gpt-4o-mini" /></label>
          <label>API Key<input type="password" value={ai.api_key} onChange={e=>setAi({...ai, api_key:e.target.value})} placeholder={ai.masked||'••••••••••••'} /></label>
          {ai.masked && <p className="muted">Current: {ai.masked}</p>}
          <button className="btn btn-primary" onClick={saveAI}>Save & Restart Agent</button>
          <p className="muted">API key is encrypted and never exposed raw.</p>
        </div>
      )}

      {tab==='agent' && (
        <>
          <div className="card">
            <h3>Agent Status</h3>
            {agentStatus ? (
              <>
                <p>State: <span className="badge">{agentStatus.state}</span> {agentStatus.is_running ? '🟢 Running' : '🔴 Stopped'}</p>
                <p>Last activity: {agentStatus.last_activity||'—'}</p>
                <p>Last success: {agentStatus.last_success||'—'}</p>
                <p>Last error: {agentStatus.last_error||'—'}</p>
                <p>Provider: {agentStatus.provider_url||'—'} | Model: {agentStatus.model_name||'—'}</p>
                <button className="btn" onClick={restartAgent}>Restart Agent</button>
              </>
            ) : 'Loading...'}
          </div>

          <div className="card">
            <h3>System Prompt</h3>
            <textarea rows={8} value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)} />
            <button className="btn btn-primary" onClick={savePrompt}>Save prompt</button>
          </div>

          <div className="card">
            <h3>Skills</h3>
            <label>Name<input value={skillForm.name} onChange={e=>setSkillForm({...skillForm, name:e.target.value})} /></label>
            <label>Description<input value={skillForm.description} onChange={e=>setSkillForm({...skillForm, description:e.target.value})} /></label>
            <label>Instructions<textarea value={skillForm.instructions} onChange={e=>setSkillForm({...skillForm, instructions:e.target.value})} /></label>
            <label><input type="checkbox" checked={skillForm.enabled} onChange={e=>setSkillForm({...skillForm, enabled:e.target.checked})} /> Enabled</label>
            <button className="btn btn-primary" onClick={createSkill}>Add Skill</button>

            <div className="skill-list">
              {skills.map(s=> (
                <div key={s.id} className="skill">
                  <strong>{s.name}</strong> — {s.enabled?'Enabled':'Disabled'}<br/>
                  <span className="muted">{s.description}</span><br/>
                  <pre>{s.instructions.slice(0,300)}</pre>
                  <button className="btn btn-sm" onClick={()=>toggleSkill(s)}>{s.enabled?'Disable':'Enable'}</button>
                  <button className="btn btn-sm" onClick={()=>deleteSkill(s.id)}>Remove</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
