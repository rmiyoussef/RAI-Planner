import { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Sign in to RAI Planner</h1>
        <p className="muted">Welcome back</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        <p className="muted">No account? <Link to="/signup">Sign up</Link></p>
      </form>
    </div>
  )
}
