import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  Building2,
  Briefcase,
  Layers,
  Rocket,
  Crown,
  Zap,
  Shield,
  Gem,
} from 'lucide-react'
import { api } from '../api/client'
// @ts-ignore - package.json is outside src but vite bundles it
import pkg from '../../package.json'

const RANDOM_ICONS = [Building2, Briefcase, Layers, Rocket, Crown, Zap, Shield, Gem, Sparkles] as const

function pickRandomIcon(name: string) {
  if (!name) return Sparkles
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return RANDOM_ICONS[hash % RANDOM_ICONS.length]
}

export function Layout() {
  const { owner, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  function doLogout() {
    setConfirmLogout(false)
    setMobileOpen(false)
    logout()
    navigate('/login')
  }
  const [company, setCompany] = useState<{ company_name: string; company_logo: string | null } | null>(null)

  useEffect(() => {
    // force light mode — dark toggle removed per request
    try {
      localStorage.setItem('rai-theme', 'light')
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCompany() {
      try {
        const data = await api.get('/settings/company')
        if (!cancelled) setCompany({ company_name: data.company_name, company_logo: data.company_logo })
      } catch {
        try {
          const pub = await api.get('/settings/company/public')
          if (!cancelled && pub?.company_name) setCompany({ company_name: pub.company_name, company_logo: pub.company_logo })
        } catch {}
      }
    }
    if (owner) loadCompany()
    const onUpdate = () => loadCompany()
    window.addEventListener('rai_company_updated', onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      cancelled = true
      window.removeEventListener('rai_company_updated', onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [owner?.id])

  const items = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  const initials = owner?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'RA'

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — #404040 per request, light text for contrast */}
      <aside className={`
        fixed lg:sticky top-0 z-50 flex flex-col h-screen w-[280px] lg:w-[280px]
        bg-[#404040] border-r border-white/10
        transition-transform duration-300 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand — company name & logo (from .env) */}
        {(() => {
          const envName = import.meta.env.VITE_APP_NAME as string
          if (!envName) throw new Error("VITE_APP_NAME not set in .env")
          const companyName = company?.company_name || envName
          const logo = company?.company_logo || null
          const FallbackIcon = pickRandomIcon(companyName)
          return (
            <div className="px-6 py-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                {logo ? (
                  <img src={logo} alt={`${companyName} logo`} className="h-10 w-10 rounded-xl object-contain bg-transparent shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                    <FallbackIcon className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-[15px] font-bold tracking-tight text-white truncate" title={companyName}>{companyName}</h1>
                  <p className="text-xs text-slate-300 -mt-0.5 truncate">Workspace</p>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-white tracking-wide">BUSINESS EDITION</span>
              </div>
            </div>
          )
        })()}

        {/* Nav — light text on #404040 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">Workspace</p>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer border
                 ${isActive
                    ? 'bg-transparent border-white/40 text-white'
                    : 'border-transparent text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/10'
                  }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span className="flex-1 min-w-0 text-left leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — on #404040 */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-white/[0.03]">

          <div className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/10 p-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none truncate text-white">{owner?.full_name}</p>
              <p className="text-xs text-slate-300 truncate">{owner?.email}</p>
            </div>
          </div>

          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar — from .env */}
        {(() => {
          const envName = import.meta.env.VITE_APP_NAME as string
          if (!envName) throw new Error("VITE_APP_NAME not set")
          const companyName = company?.company_name || envName
          const logo = company?.company_logo || null
          const FallbackIcon = pickRandomIcon(companyName)
          return (
            <header className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl hover:bg-muted cursor-pointer shrink-0">
                  <Menu className="w-5 h-5" />
                </button>
                {logo ? (
                  <img src={logo} alt="logo" className="h-7 w-7 rounded-lg object-contain bg-transparent shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden shrink-0">
                    <FallbackIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="font-bold text-sm truncate max-w-[160px]" title={companyName}>{companyName}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary text-white grid place-items-center text-xs font-bold shrink-0">
                {initials}
              </div>
            </header>
          )
        })()}

        <main className="flex-1 bg-background">
          <div className="w-[95%] mx-auto py-6 lg:py-8">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-card/50 px-6 py-3 text-center text-xs text-muted-foreground dark:bg-slate-900/50">
          © 2026 Squadify Lab · {import.meta.env.VITE_APP_NAME} · Rami Youssef · v{(pkg as any).version}
        </footer>
      </div>

      {/* Logout confirmation */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} aria-hidden="true" />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in">
            <div className="px-6 py-5 space-y-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 id="logout-title" className="text-base font-bold tracking-tight">Sign out?</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">You will be signed out of your owner account on this device.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
              <button type="button" onClick={() => setConfirmLogout(false)} className="btn btn-ghost h-10 px-5">Stay signed in</button>
              <button type="button" onClick={doLogout} className="btn btn-primary h-10 px-5 gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
