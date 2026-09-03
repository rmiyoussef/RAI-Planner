import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { ApiError } from '../api/client'
import { Mail, Lock, ArrowRight, Sparkles, Loader2, ShieldCheck, AlertCircle, Clock } from 'lucide-react'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorDetail, setErrorDetail] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupAllowed, setSignupAllowed] = useState<boolean | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const retryTimerRef = useRef<number | null>(null)

  useEffect(() => {
    api.get('/auth/signup-status').then((d:any)=> setSignupAllowed(!!d.allowed)).catch(()=> setSignupAllowed(false))
  }, [])

  // countdown for rate limit
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return
    retryTimerRef.current = window.setTimeout(() => setRetryAfter((prev) => (prev !== null ? prev - 1 : null)), 1000)
    return () => { if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current) }
  }, [retryAfter])

  useEffect(() => {
    if (retryAfter !== null && retryAfter <= 0) setRetryAfter(null)
  }, [retryAfter])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setErrorDetail('')
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) { setError('Email and password are required'); return }
    if (retryAfter !== null && retryAfter > 0) {
      setError(`Too many attempts. Please try again in ${retryAfter}s.`)
      return
    }
    setLoading(true)
    try {
      await login(trimmedEmail, password)
      navigate('/')
    } catch (err: any) {
      // Handle ApiError with status
      const status = err instanceof ApiError ? err.status : err?.status
      const detail = err instanceof ApiError ? err.detail : err?.message || String(err)
      if (status === 429) {
        const retry = err instanceof ApiError ? parseInt(err.headers.get('Retry-After') || '60', 10) : 60
        const secs = isNaN(retry) ? 60 : retry
        setRetryAfter(secs)
        setError('Too many login attempts')
        setErrorDetail(detail || `Please wait ${secs} seconds before trying again.`)
      } else if (status === 401) {
        setError('Invalid email or password')
        setErrorDetail('Please check your credentials and try again. Passwords are case-sensitive.')
        // keep email, clear password for security and focus
        setPassword('')
      } else {
        setError(detail || 'Sign in failed. Please try again.')
        setErrorDetail('')
      }
    } finally { setLoading(false) }
  }

  const isRateLimited = retryAfter !== null && retryAfter > 0

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[440px]">
        <form onSubmit={submit} className="card p-6 sm:p-8 space-y-6 shadow-medium" noValidate>
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-[26px] font-bold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">Sign in to your business workspace</p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className={`rounded-xl border px-4 py-3 text-sm flex gap-3 ${isRateLimited ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'border-destructive/20 bg-red-50 dark:bg-red-950/30 text-destructive'}`}
            >
              <span className="shrink-0 mt-0.5">
                {isRateLimited ? <Clock className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-semibold">{error}</p>
                {errorDetail && <p className="text-xs opacity-90 leading-relaxed">{errorDetail}</p>}
                {isRateLimited && retryAfter !== null && (
                  <p className="text-xs font-medium tabular-nums">Try again in {retryAfter}s</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="login-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  className="input pl-10"
                  aria-invalid={!!error && error.includes('Invalid')}
                  disabled={isRateLimited}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium">Password</label>
                <span className="text-xs text-muted-foreground">Min 8 characters</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input pl-10"
                  aria-invalid={!!error && error.includes('Invalid')}
                  disabled={isRateLimited}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isRateLimited}
            className="btn btn-primary w-full h-11 text-[15px] shadow-sm disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in...' : isRateLimited ? `Wait ${retryAfter}s` : 'Sign in to workspace'}
            {!loading && !isRateLimited && <ArrowRight className="w-4 h-4" />}
            {isRateLimited && <Clock className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Encrypted • Auditable • Your data stays in your projects
          </div>

          {signupAllowed === true && (
            <p className="text-center text-sm text-muted-foreground">
              No account? <Link to="/signup" className="font-semibold text-primary hover:underline cursor-pointer">Create business account</Link>
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to our Terms and DPA. Light mode is default — toggle in sidebar.
          </p>
        </form>
      </div>
    </div>
  )
}
