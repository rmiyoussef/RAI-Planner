import { useEffect, useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { User, Mail, Lock, ArrowRight, Sparkles, Loader2, CheckCircle2, Building2, Image as ImageIcon, Upload } from 'lucide-react'

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Checking workspace status...
        </div>
      </div>
    )
  }

  if (!allowed) {
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
              <h1 className="text-[40px] font-bold leading-[0.95] tracking-tight">Workspace<br />already<br /><span className="text-white/90">initialized.</span></h1>
              <p className="text-white/80 text-sm max-w-[420px] leading-relaxed">Signup is available only at first setup. Your workspace owner already exists — please sign in.</p>
            </div>
            <p className="text-xs text-white/50">Secure • Single-owner • First-time setup only</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-[440px] space-y-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="space-y-2">
              <h1 className="text-[26px] font-bold tracking-tight">Signup disabled</h1>
              <p className="text-sm text-muted-foreground">{statusMsg || 'Workspace already initialized — only one owner account is allowed.'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              This instance is configured for <strong>first-time setup only</strong>. Please use the owner account to sign in.
            </div>
            <Link to="/login" className="btn btn-primary w-full h-11 justify-center gap-2">
              <ArrowRight className="w-4 h-4" /> Go to sign in
            </Link>
            <p className="text-xs text-muted-foreground">If you need to reset, contact your administrator or clear the workspace database.</p>
          </div>
        </div>
      </div>
    )
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
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-white" /> First-time setup only — single workspace</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-white" /> Company name & logo saved for branding</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-white" /> AI understands your repo + <code className="bg-white/15 px-1 py-0.5 rounded">.brain</code></li>
            </ul>
          </div>
          <p className="text-xs text-white/50">Used by owners who ship — not just plan.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <form onSubmit={submit} className="w-full max-w-[480px] space-y-6 py-6">
          <div className="space-y-2">
            <h1 className="text-[28px] font-bold tracking-tight">Create business account</h1>
            <p className="text-sm text-muted-foreground">First-time setup only — you define the workspace and company branding.</p>
          </div>

          {error && <div className="rounded-xl border border-destructive/20 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="rounded-xl border border-primary/10 bg-primary-light/30 dark:bg-blue-950/20 px-3.5 py-3 flex gap-2.5">
            <Building2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <p className="text-xs leading-relaxed text-primary dark:text-blue-300"><strong>Company branding:</strong> Company name is required. Logo is optional — if skipped, a random icon will be used in the menu. You can change both later in Settings.</p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Company name <span className="text-destructive">*</span></label>
              <input value={companyName} onChange={e=>setCompanyName(e.target.value)} required placeholder="Acme Inc." className="input" maxLength={150} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-muted-foreground" /> Company logo <span className="text-xs font-normal text-muted-foreground">(optional, max 1MB)</span></label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-xl border border-border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="btn btn-outline btn-sm cursor-pointer gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Upload logo
                    <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
                  </label>
                  {logoPreview && (
                    <button type="button" onClick={()=>{setCompanyLogo(null); setLogoPreview(null)}} className="ml-2 text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, SVG — stored as data URL. If empty, a random icon is shown.</p>
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

          <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 text-[15px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Creating...' : 'Create workspace'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="font-semibold text-primary hover:underline cursor-pointer">Sign in</Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">Secure by design — passwords are hashed, never stored in plain text. Signup works only on first setup.</p>
        </form>
      </div>
    </div>
  )
}
