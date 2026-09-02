import { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { User, Mail, Lock, ArrowRight, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'

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
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await signup(fullName, email, password, confirm)
      navigate('/')
    } catch (err:any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-[48%] bg-gradient-to-br from-primary via-secondary to-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.15),_transparent_60%)]" />
        <div className="relative flex flex-col justify-between p-12 text-white w-full">
          <div className="inline-flex items-center gap-2 text-white/80 text-sm">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
            RAI Planner • Business Edition
          </div>
          <div className="space-y-6">
            <h1 className="text-[40px] font-bold leading-[0.95] tracking-tight">
              One owner.<br />Full control.<br />
              <span className="text-white/90">Zero chaos.</span>
            </h1>
            <ul className="space-y-2.5 text-white/80 text-sm">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-white" /> Projects stay disabled, never deleted — full history</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-white" /> Every task is versioned & auditable</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-white" /> AI understands your repo + <code className="bg-white/15 px-1 py-0.5 rounded">.brain</code></li>
            </ul>
          </div>
          <p className="text-xs text-white/50">Used by owners who ship — not just plan.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-[440px] space-y-6">
          <div className="space-y-2">
            <h1 className="text-[28px] font-bold tracking-tight">Create business account</h1>
            <p className="text-sm text-muted-foreground">One owner account — you manage projects, tasks, team and AI.</p>
          </div>

          {error && <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="Alex Morgan" className="input pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" placeholder="you@company.com" className="input pl-10" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••" className="input pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm</label>
                <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required placeholder="••••••••" className="input" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 text-[15px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Creating...' : 'Create account'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="font-semibold text-primary hover:underline cursor-pointer">Sign in</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">Secure by design — passwords are hashed, never stored in plain text.</p>
        </form>
      </div>
    </div>
  )
}
