import { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, ArrowRight, Sparkles, Loader2, ShieldCheck } from 'lucide-react'

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
    if (!email || !password) { setError('Email and password are required'); return }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - brand */}
      <div className="hidden lg:flex w-[48%] bg-gradient-to-br from-primary via-primary to-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.15),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(234,88,12,0.15),_transparent_60%)]" />
        <div className="relative flex flex-col justify-between p-12 text-white w-full">
          <div className="inline-flex items-center gap-2 text-white/80 text-sm">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            RAI Planner • Business Edition
          </div>
          <div className="space-y-6">
            <h1 className="text-[40px] font-bold leading-[0.95] tracking-tight">
              Turn rough ideas<br />
              into <span className="text-white/90 underline decoration-white/30 underline-offset-8">shippable</span><br />
              engineering tasks
            </h1>
            <p className="text-white/80 text-[15px] leading-relaxed max-w-[420px]">
              Your Smart Engineering Agent reads your repo + <code className="bg-white/15 px-1.5 py-0.5 rounded text-white">.brain</code> and transforms vague tasks into actionable, versioned work.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/20 backdrop-blur" />
                <div className="w-8 h-8 rounded-full bg-white/30 border-2 border-white/20 backdrop-blur" />
                <div className="w-8 h-8 rounded-full bg-white/40 border-2 border-white/20 backdrop-blur grid place-items-center text-xs font-bold">+2k</div>
              </div>
              <span className="text-sm text-white/70">Trusted by engineering teams</span>
            </div>
          </div>
          <p className="text-xs text-white/50">© {new Date().getFullYear()} RAI Planner • Secure • Versioned • Auditable</p>
        </div>
      </div>

      {/* Right - form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <form onSubmit={submit} className="w-full max-w-[420px] space-y-6">
          <div className="space-y-2">
            <div className="lg:hidden inline-flex items-center gap-2 rounded-full bg-primary-light border border-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5" /> RAI Planner
            </div>
            <h1 className="text-[28px] font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Sign in to your business workspace</p>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive flex gap-2">
              <span className="shrink-0">⚠</span> <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  required
                  className="input pl-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <span className="text-xs text-muted-foreground">Min 8 characters</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 text-[15px] shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign in to workspace'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Encrypted • Auditable • Your data stays in your projects
          </div>

          <p className="text-center text-sm text-muted-foreground">
            No account? <Link to="/signup" className="font-semibold text-primary hover:underline cursor-pointer">Create business account</Link>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to our Terms and DPA. Light mode is default — toggle in sidebar.
          </p>
        </form>
      </div>
    </div>
  )
}
