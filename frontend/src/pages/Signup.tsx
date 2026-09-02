import { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

export function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 chars'); return }
    setLoading(true)
    try {
      await signup(fullName, email, password, confirm)
      navigate('/')
    } catch (err:any) { setError(err.message) }
    finally { setLoading(false) }
  }
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create account</h1>
        <p className="muted">RAI Planner — one owner account</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} required /></label>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <label>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required /></label>
        <button className="btn btn-primary" disabled={loading}>{loading?'Creating...':'Create account'}</button>
        <p className="muted">Have account? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  )
}
