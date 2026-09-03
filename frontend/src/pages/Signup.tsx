import { useEffect, useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { User, Mail, Lock, ArrowRight, Sparkles, Loader2, Building2, Image as ImageIcon, Upload, ShieldCheck } from 'lucide-react'

export function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(true)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    api.get('/auth/signup-status')
      .then((d: any) => {
        setAllowed(!!d.allowed)
        setStatusMsg(d.reason || '')
      })
      .catch(() => setAllowed(true))
      .finally(() => setChecking(false))
  }, [])

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      setError('Logo must be under 1MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setCompanyLogo(dataUrl)
      setLogoPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!allowed) { setError(statusMsg || 'Signup is disabled — workspace already initialized'); return }
    if (!companyName.trim()) { setError('Company name is required'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await signup(fullName, email, password, confirm, companyName.trim(), companyLogo)
      navigate('/')
    } catch (err:any) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground card px-6 py-4">
          <Loader2 className="w-5 h-5 animate-spin" /> Checking workspace status...
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[440px]">
          <div className="card p-6 sm:p-8 space-y-6 shadow-medium text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/40">
              <Building2 className="w-6 h-6 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="space-y-2">
              <h1 className="text-[22px] font-bold tracking-tight">Signup disabled</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{statusMsg || 'Workspace already initialized — only one owner account is allowed.'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 text-left">
              This instance is configured for <strong>first-time setup only</strong>. Please use the owner account to sign in.
            </div>
            <Link to="/login" className="btn btn-primary w-full h-11 justify-center gap-2">
              <ArrowRight className="w-4 h-4" /> Go to sign in
            </Link>
            <p className="text-xs text-muted-foreground">If you need to reset, contact your administrator.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[480px]">
        <form onSubmit={submit} className="card p-6 sm:p-8 space-y-6 shadow-medium">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-[26px] font-bold tracking-tight">Create business account</h1>
              <p className="text-sm text-muted-foreground">First-time setup only — you define the workspace</p>
            </div>
          </div>

          {error && <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Company name <span className="text-destructive">*</span></label>
              <input value={companyName} onChange={e=>setCompanyName(e.target.value)} required placeholder="Acme Inc." className="input" maxLength={150} />
              <p className="text-xs text-muted-foreground">Shown in top-left menu. You can change it later in Settings.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-muted-foreground" /> Company logo <span className="text-xs font-normal text-muted-foreground">(optional, max 1MB)</span></label>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <div className="h-12 w-12 rounded-xl border border-border bg-card flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <label className="btn btn-outline btn-sm cursor-pointer gap-1.5 shrink-0">
                      <Upload className="w-3.5 h-3.5" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
                    </label>
                    {logoPreview && (
                      <button type="button" onClick={()=>{setCompanyLogo(null); setLogoPreview(null)}} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">PNG, JPG, SVG — if empty, random icon is shown.</p>
                </div>
              </div>
            </div>

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

          <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 text-[15px] shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Creating...' : 'Create workspace'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground justify-center">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure • Hashed • First-time only
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="font-semibold text-primary hover:underline cursor-pointer">Sign in</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">Passwords are hashed, never stored in plain text.</p>
        </form>
      </div>
    </div>
  )
}
