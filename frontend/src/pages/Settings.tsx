import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Cpu,
  Bot,
  Key,
  Mail,
  Lock,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  FileText,
  Wrench,
  Trash2,
  Plus,
  Power,
  Activity,
  Clock3,
  AlertTriangle,
  Globe,
  Server,
  ToggleLeft,
  ToggleRight,
  Hash,
  Building2,
  Image as ImageIcon,
  Upload,
} from 'lucide-react'

type Tab = 'profile' | 'company' | 'ai' | 'agent'

export function Settings() {
  const { owner, refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState({ full_name: owner?.full_name || '', email: owner?.email || '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '' })
  const [ai, setAi] = useState({ provider_url: '', model_name: '', api_key: '', masked: '', has_key: false })
  const [showKey, setShowKey] = useState(false)
  const [agentStatus, setAgentStatus] = useState<any>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [skills, setSkills] = useState<any[]>([])
  const [skillForm, setSkillForm] = useState({ name: '', description: '', instructions: '', enabled: true })
  const [company, setCompany] = useState<{ company_name: string; company_logo: string | null }>({ company_name: '', company_logo: null })
  const [companyPreview, setCompanyPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingAgent, setLoadingAgent] = useState(false)

  async function loadAI() {
    try {
      const data = await api.get('/settings/ai-config')
      setAi({ provider_url: data.provider_url || '', model_name: data.model_name || '', api_key: '', masked: data.api_key_masked || '', has_key: !!data.has_key })
    } catch (e: any) {
      setError(e.message)
    }
  }
  async function loadAgent() {
    setLoadingAgent(true)
    try {
      const data = await api.get('/settings/agent')
      setAgentStatus(data)
      setSystemPrompt(data.system_prompt || '')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingAgent(false)
    }
  }
  async function loadSkills() {
    try {
      const data = await api.get('/settings/skills')
      setSkills(Array.isArray(data) ? data : (data.items ?? []))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function loadCompany() {
    try {
      const data = await api.get('/settings/company')
      setCompany({ company_name: data.company_name || '', company_logo: data.company_logo || null })
      setCompanyPreview(data.company_logo || null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  function onCompanyLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { setError('Logo must be under 1MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setCompany((c) => ({ ...c, company_logo: dataUrl }))
      setCompanyPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function saveCompany() {
    if (!company.company_name.trim()) { setError('Company name is required'); return }
    setSaving(true)
    try {
      const data = await api.put('/settings/company', { company_name: company.company_name.trim(), company_logo: company.company_logo || '' })
      setCompany({ company_name: data.company_name, company_logo: data.company_logo })
      setCompanyPreview(data.company_logo)
      flashSuccess('Company branding updated')
      // notify layout to refresh — via storage event
      try { localStorage.setItem('rai_company_updated', Date.now().toString()) } catch {}
      window.dispatchEvent(new Event('rai_company_updated'))
    } catch (e: any) { flashError(e) } finally { setSaving(false) }
  }

  useEffect(() => {
    loadAI()
    loadAgent()
    loadSkills()
    loadCompany()
  }, [])
  useEffect(() => {
    if (owner) setProfile({ full_name: owner.full_name, email: owner.email })
  }, [owner])

  function flashSuccess(text: string) {
    setMsg(text)
    setError('')
    setTimeout(() => setMsg(''), 3500)
  }
  function flashError(e: any) {
    setError(e.message || String(e))
    setMsg('')
  }

  async function saveProfile() {
    if (!profile.full_name.trim()) {
      setError('Full name is required.')
      return
    }
    setSaving(true)
    try {
      await api.put('/auth/profile', { full_name: profile.full_name.trim(), email: profile.email.trim() })
      flashSuccess('Profile updated successfully.')
      refresh()
    } catch (e: any) {
      flashError(e)
    } finally {
      setSaving(false)
    }
  }

  async function changePwd() {
    if (!pwd.current_password || !pwd.new_password) {
      setError('Both password fields are required.')
      return
    }
    if (pwd.new_password.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/change-password', pwd)
      setPwd({ current_password: '', new_password: '' })
      flashSuccess('Password changed successfully.')
    } catch (e: any) {
      flashError(e)
    } finally {
      setSaving(false)
    }
  }

  async function saveAI() {
    if (!ai.provider_url.trim() || !ai.model_name.trim()) {
      setError('Provider URL and Model name are required.')
      return
    }
    try {
      new URL(ai.provider_url)
    } catch {
      setError('Provider URL must be a valid URL (e.g. https://api.openai.com/v1).')
      return
    }
    setSaving(true)
    try {
      const data = await api.put('/settings/ai-config', {
        provider_url: ai.provider_url.trim(),
        model_name: ai.model_name.trim(),
        api_key: ai.api_key || undefined,
      })
      setAi({ ...ai, masked: data.api_key_masked || ai.masked, has_key: !!data.has_key, api_key: '' })
      setShowKey(false)
      flashSuccess('AI configuration saved — agent restarted.')
      loadAgent()
    } catch (e: any) {
      flashError(e)
    } finally {
      setSaving(false)
    }
  }

  async function savePrompt() {
    setSaving(true)
    try {
      await api.put('/settings/agent/prompt', { system_prompt: systemPrompt })
      flashSuccess('System prompt updated.')
    } catch (e: any) {
      flashError(e)
    } finally {
      setSaving(false)
    }
  }

  async function createSkill() {
    if (!skillForm.name.trim()) {
      setError('Skill name is required.')
      return
    }
    if (!skillForm.instructions.trim()) {
      setError('Instructions are required.')
      return
    }
    try {
      await api.post('/settings/skills', {
        name: skillForm.name.trim(),
        description: skillForm.description.trim(),
        instructions: skillForm.instructions.trim(),
        enabled: skillForm.enabled,
      })
      setSkillForm({ name: '', description: '', instructions: '', enabled: true })
      flashSuccess('Skill added.')
      loadSkills()
    } catch (e: any) {
      flashError(e)
    }
  }

  async function toggleSkill(s: any) {
    try {
      await api.put(`/settings/skills/${s.id}`, { enabled: !s.enabled })
      loadSkills()
    } catch (e: any) {
      flashError(e)
    }
  }

  async function deleteSkill(id: string) {
    if (!confirm('Delete this skill?')) return
    try {
      await api.delete(`/settings/skills/${id}`)
      flashSuccess('Skill removed.')
      loadSkills()
    } catch (e: any) {
      flashError(e)
    }
  }

  async function restartAgent() {
    setLoadingAgent(true)
    try {
      const data = await api.post('/settings/agent/restart', {})
      setAgentStatus(data)
      flashSuccess('Agent restarted successfully.')
    } catch (e: any) {
      flashError(e)
    } finally {
      setLoadingAgent(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: any; desc: string }[] = [
    { id: 'profile', label: 'Profile', icon: User, desc: 'Account & security' },
    { id: 'company', label: 'Company', icon: Building2, desc: 'Branding & logo' },
    { id: 'ai', label: 'AI Configuration', icon: Cpu, desc: 'Model & provider' },
    { id: 'agent', label: 'Agent', icon: Bot, desc: 'Prompt & skills' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm" aria-hidden="true">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Settings</h1>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary-light px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
            <Shield className="h-3 w-3" aria-hidden="true" />
            OWNER ONLY
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Manage your owner account, AI provider, and the engineering agent that powers delivery.
        </p>
      </div>

      {/* Tabs - active underline */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-1 border-b border-border bg-muted/20 px-2 sm:px-4 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex shrink-0 items-center gap-2.5 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
                aria-selected={active}
                role="tab"
              >
                <t.icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
                <span>{t.label}</span>
                <span className={`hidden sm:inline text-xs font-medium ${active ? 'text-primary/70' : 'text-muted-foreground'}`}>{t.desc}</span>
              </button>
            )
          })}
        </div>

        {/* Alerts inside card header */}
        {(msg || error) && (
          <div className="space-y-3 border-b border-border bg-card px-4 py-4 sm:px-6">
            {msg && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="font-medium flex-1">{msg}</p>
                <button type="button" onClick={() => setMsg('')} className="shrink-0 cursor-pointer rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="font-medium flex-1">{error}</p>
                <button type="button" onClick={() => setError('')} className="shrink-0 cursor-pointer rounded-lg p-1 hover:bg-red-100 dark:hover:bg-red-900/40" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="p-4 sm:p-6 bg-background">
          {/* Profile tab */}
          {tab === 'profile' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary border border-primary/10 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Owner Profile</h3>
                    <p className="text-xs font-medium text-muted-foreground">Your business owner identity.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="profile-fullname" className="text-xs font-semibold tracking-wide text-foreground">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <input
                        id="profile-fullname"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        placeholder="Your full name"
                        className="input cursor-text pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="profile-email" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      placeholder="owner@company.com"
                      className="input cursor-text"
                    />
                    <p className="text-[11px] font-medium text-muted-foreground">Used for sign-in and notifications.</p>
                  </div>
                </div>

                <button type="button" onClick={saveProfile} disabled={saving} className="btn btn-primary w-full sm:w-auto cursor-pointer disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  Save profile
                </button>
              </div>

              <div className="card space-y-5 border-amber-200/40 dark:border-amber-900/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                    <Lock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Change Password</h3>
                    <p className="text-xs font-medium text-muted-foreground">Keep your owner account secure.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="pwd-current" className="text-xs font-semibold tracking-wide text-foreground">
                      Current password
                    </label>
                    <input
                      id="pwd-current"
                      type="password"
                      value={pwd.current_password}
                      onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                      placeholder="••••••••"
                      className="input cursor-text"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="pwd-new" className="text-xs font-semibold tracking-wide text-foreground">
                      New password
                    </label>
                    <input
                      id="pwd-new"
                      type="password"
                      value={pwd.new_password}
                      onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                      placeholder="At least 8 characters"
                      className="input cursor-text"
                    />
                    <p className="text-[11px] font-medium text-muted-foreground">Minimum 8 characters. Use a strong, unique password.</p>
                  </div>
                </div>

                <button type="button" onClick={changePwd} disabled={saving} className="btn btn-outline w-full sm:w-auto cursor-pointer disabled:opacity-50">
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  Change password
                </button>
              </div>
            </div>
          )}

          {/* Company / Branding — smart inputs, no card, full width */}
          {tab === 'company' && (
            <div className="w-full">
              <div className="flex items-start gap-4 pb-6 border-b border-border">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#404040] text-white shadow-sm shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-bold tracking-tight">Company Branding</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">This name and logo appear in the top-left menu. Logo is optional — we’ll show a sleek random icon if empty.</p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Live preview</span>
              </div>

              <div className="py-7 space-y-7">
                {/* Company name — smart input */}
                <div className="space-y-2">
                  <label htmlFor="company-name" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-3.5 w-3.5" /></span>
                    Company name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative group">
                    <input
                      id="company-name"
                      value={company.company_name}
                      onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                      placeholder="Acme Inc."
                      maxLength={150}
                      className="input h-11 pr-10 text-[15px] font-medium bg-card border-border group-hover:border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground tabular-nums">{company.company_name.length}/150</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Used in sidebar, browser tab and invoices.</p>
                </div>

                {/* Logo — smart upload */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><ImageIcon className="h-3.5 w-3.5" /></span>
                    Company logo <span className="text-xs font-normal text-muted-foreground">— optional, ≤1MB</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-5">
                    <div className="relative h-24 w-24 rounded-2xl border-2 border-dashed border-border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 hover:border-primary/30 hover:bg-muted/30 transition-colors group/logo">
                      {companyPreview ? (
                        <img src={companyPreview} alt="Company logo" className="h-full w-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                          <Building2 className="w-8 h-8 opacity-50 group-hover/logo:opacity-100 transition-opacity" />
                          <span className="text-[11px] font-medium">No logo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="btn btn-outline cursor-pointer gap-2 h-10 px-4 hover:border-primary/30 hover:text-primary">
                          <Upload className="w-4 h-4" /> Upload image
                          <input type="file" accept="image/*" className="hidden" onChange={onCompanyLogoFile} />
                        </label>
                        {companyPreview ? (
                          <button type="button" onClick={() => { setCompany({ ...company, company_logo: null }); setCompanyPreview(null) }} className="btn btn-ghost gap-2 h-10">
                            <X className="w-4 h-4" /> Remove
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">PNG, JPG, SVG — stored as data URL</span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="company-logo-url"
                          value={company.company_logo || ''}
                          onChange={(e) => { const v = e.target.value; setCompany({ ...company, company_logo: v || null }); setCompanyPreview(v || null) }}
                          placeholder="https://example.com/logo.png  or  data:image/..."
                          className="input h-10 font-mono text-xs pr-9 bg-card"
                        />
                        <ImageIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">No external hosting needed. If empty, a random icon appears in the menu — same logic as top-left fallback.</p>
                    </div>
                  </div>
                </div>

                {/* Live preview — inline, not card */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
                  <div className="h-11 w-11 rounded-xl bg-[#404040] flex items-center justify-center overflow-hidden shrink-0">
                    {companyPreview ? <img src={companyPreview} alt="preview" className="h-full w-full object-contain p-1.5" /> : <Building2 className="w-5 h-5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{company.company_name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">Preview • top-left menu • Workspace</p>
                  </div>
                  <span className="hidden sm:inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground hidden sm:block">Changes apply instantly across the app.</p>
                <button type="button" onClick={saveCompany} disabled={saving || !company.company_name.trim()} className="btn btn-primary gap-2 h-11 px-6 shadow-sm disabled:opacity-50 ml-auto">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save branding
                </button>
              </div>
            </div>
          )}

          {/* AI Configuration — smart inputs, no card, full width */}
          {tab === 'ai' && (
            <div className="w-full">
              <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm shrink-0">
                    <Cpu className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold tracking-tight">AI Configuration</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">OpenAI-compatible API — encrypted at rest.</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  Encrypted
                </span>
              </div>

              <div className="py-7 space-y-7">
                <div className="flex gap-3 rounded-xl bg-primary-light/30 dark:bg-blue-950/20 border border-primary/10 dark:border-blue-900/30 px-4 py-3">
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-primary dark:text-blue-300">
                    Connect any OpenAI-compatible provider. Saving automatically restarts the agent.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ai-url" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    Provider URL <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="ai-url"
                    value={ai.provider_url}
                    onChange={(e) => setAi({ ...ai, provider_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="input h-11 font-mono text-[13px] bg-card border-border hover:border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  <p className="text-xs text-muted-foreground">Must be a valid <span className="font-mono">https://</span> URL.</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ai-model" className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Server className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    Model Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="ai-model"
                    value={ai.model_name}
                      onChange={(e) => setAi({ ...ai, model_name: e.target.value })}
                      placeholder="gpt-4o-mini"
                      className="input cursor-text font-mono text-[13px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="ai-key" className="flex items-center gap-2 text-sm font-semibold">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Key className="h-3.5 w-3.5" aria-hidden="true" /></span>
                      API Key
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground border border-border">SECRET</span>
                    </label>
                    <div className="relative group">
                      <input
                        id="ai-key"
                        type={showKey ? 'text' : 'password'}
                        value={ai.api_key}
                        onChange={(e) => setAi({ ...ai, api_key: e.target.value })}
                        placeholder={ai.masked || '••••••••••••'}
                        className="input h-11 pr-10 font-mono text-[13px] bg-card border-border group-hover:border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {ai.masked && (
                      <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-mono font-medium text-muted-foreground">
                        <Shield className="w-3 h-3" aria-hidden="true" />
                        Current: {ai.masked}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Stored encrypted — never exposed raw.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-6 border-t border-border">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    Encrypted at rest • restarts agent on save
                  </p>
                  <button type="button" onClick={saveAI} disabled={saving} className="btn btn-primary gap-2 h-11 px-6 shadow-sm shrink-0 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    Save & Restart Agent
                  </button>
                </div>
              </div>
          )}

          {/* Agent */}
          {tab === 'agent' && (
            <div className="space-y-6">
              {/* Status */}
              <div className="card space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <Activity className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Agent Status</h3>
                      <p className="text-xs font-medium text-muted-foreground">Live runtime health &amp; configuration.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={restartAgent}
                    disabled={loadingAgent}
                    className="btn btn-outline cursor-pointer gap-2 shrink-0 disabled:opacity-50"
                  >
                    {loadingAgent ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    Restart Agent
                  </button>
                </div>

                {loadingAgent && !agentStatus ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading agent...
                  </div>
                ) : agentStatus ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Power className="h-3 w-3" aria-hidden="true" /> State
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-primary capitalize">{agentStatus.state || 'unknown'}</span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                            agentStatus.is_running
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${agentStatus.is_running ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} aria-hidden="true" />
                          {agentStatus.is_running ? 'Running' : 'Stopped'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3" aria-hidden="true" /> Last activity
                      </p>
                      <p className="text-sm font-medium text-foreground truncate" title={agentStatus.last_activity || ''}>
                        {agentStatus.last_activity ? new Date(agentStatus.last_activity).toLocaleString() : '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Last success
                      </p>
                      <p className="text-sm font-medium text-foreground truncate" title={agentStatus.last_success || ''}>
                        {agentStatus.last_success ? new Date(agentStatus.last_success).toLocaleString() : '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-1 sm:col-span-2 lg:col-span-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Last error
                      </p>
                      <p className="text-sm font-medium text-destructive truncate" title={agentStatus.last_error || ''}>
                        {agentStatus.last_error || '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Globe className="h-3 w-3" aria-hidden="true" /> Provider
                      </p>
                      <p className="text-sm font-mono font-medium text-foreground truncate" title={agentStatus.provider_url || ''}>
                        {agentStatus.provider_url || '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Server className="h-3 w-3" aria-hidden="true" /> Model
                      </p>
                      <p className="text-sm font-mono font-medium text-foreground truncate" title={agentStatus.model_name || ''}>
                        {agentStatus.model_name || '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm font-medium text-muted-foreground">
                    No agent status available.
                  </p>
                )}
              </div>

              {/* System prompt */}
              <div className="card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary border border-primary/10 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">System Prompt</h3>
                    <p className="text-xs font-medium text-muted-foreground">Define how the agent behaves across all tasks.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="system-prompt" className="sr-only">
                    System prompt
                  </label>
                  <textarea
                    id="system-prompt"
                    rows={8}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="You are a senior engineering agent. Be concise, secure, and delivery-focused..."
                    className="input min-h-[180px] cursor-text resize-y py-3 font-mono text-[13px] leading-relaxed"
                  />
                  <p className="text-[11px] font-medium text-muted-foreground">{systemPrompt.length} characters</p>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={savePrompt} disabled={saving} className="btn btn-primary cursor-pointer disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                    Save prompt
                  </button>
                </div>
              </div>

              {/* Skills */}
              <div className="card space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                    <Wrench className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Skills</h3>
                    <p className="text-xs font-medium text-muted-foreground">Reusable capabilities the agent can invoke.</p>
                  </div>
                  <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                    {skills.length}
                  </span>
                </div>

                {/* Create form */}
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
                  <p className="text-xs font-bold tracking-wide text-foreground flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Add Skill
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="skill-name" className="text-xs font-semibold tracking-wide text-foreground">
                        Name <span className="font-normal text-destructive">*</span>
                      </label>
                      <input
                        id="skill-name"
                        value={skillForm.name}
                        onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                        placeholder="e.g. code-review"
                        className="input cursor-text bg-card"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="skill-desc" className="text-xs font-semibold tracking-wide text-foreground">
                        Description
                      </label>
                      <input
                        id="skill-desc"
                        value={skillForm.description}
                        onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                        placeholder="Brief purpose"
                        className="input cursor-text bg-card"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="skill-instructions" className="text-xs font-semibold tracking-wide text-foreground">
                        Instructions <span className="font-normal text-destructive">*</span>
                      </label>
                      <textarea
                        id="skill-instructions"
                        value={skillForm.instructions}
                        onChange={(e) => setSkillForm({ ...skillForm, instructions: e.target.value })}
                        placeholder="Detailed steps the agent should follow..."
                        rows={3}
                        className="input min-h-[96px] cursor-text resize-y py-3 bg-card"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={skillForm.enabled}
                        onClick={() => setSkillForm({ ...skillForm, enabled: !skillForm.enabled })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${skillForm.enabled ? 'bg-primary' : 'bg-border'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${skillForm.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        {skillForm.enabled ? <ToggleRight className="h-4 w-4 text-primary" aria-hidden="true" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                        {skillForm.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>

                    <button type="button" onClick={createSkill} className="btn btn-primary cursor-pointer w-full sm:w-auto">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add Skill
                    </button>
                  </div>
                </div>

                {/* List */}
                {skills.length ? (
                  <div className="grid grid-cols-1 gap-3">
                    {skills.map((s) => (
                      <div
                        key={s.id}
                        className={`group relative flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${s.enabled ? 'border-border bg-card hover:border-primary/20 hover:shadow-soft' : 'border-dashed bg-muted/20 opacity-80'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-semibold tracking-tight text-foreground">{s.name}</h4>
                              <span className={`badge text-[11px] ${s.enabled ? 'badge-success' : 'badge-muted'}`}>{s.enabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            {s.description && <p className="text-xs font-medium leading-relaxed text-muted-foreground">{s.description}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleSkill(s)}
                              className={`btn btn-sm cursor-pointer gap-1.5 ${s.enabled ? 'btn-outline hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200' : 'btn-primary'}`}
                            >
                              {s.enabled ? <ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" /> : <ToggleRight className="h-3.5 w-3.5" aria-hidden="true" />}
                              {s.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSkill(s.id)}
                              className="btn btn-outline btn-sm cursor-pointer gap-1 text-destructive hover:bg-red-50 hover:text-destructive hover:border-red-200 dark:hover:bg-red-950/40"
                              aria-label={`Delete skill ${s.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" aria-hidden="true" /> Instructions
                          </p>
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
                            {s.instructions?.slice(0, 800) || '—'}
                            {s.instructions?.length > 800 ? '…' : ''}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
                      <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">No skills yet</p>
                      <p className="max-w-sm text-xs leading-relaxed font-medium text-muted-foreground">
                        Create reusable instructions to extend the agent — e.g. code review, architecture, compliance checks.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer trust */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary border border-primary/10 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Enterprise-grade security</p>
          <p className="text-xs leading-relaxed font-medium text-muted-foreground">
            All secrets are encrypted, never logged, and only decrypted in memory for the agent. Audit every change in activity logs.
          </p>
        </div>
      </div>
    </div>
  )
}
