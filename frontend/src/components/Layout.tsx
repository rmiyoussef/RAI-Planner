import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useState, useEffect } from 'react'
import { getStoredTheme, setStoredTheme } from '../utils/theme'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'

export function Layout() {
  const { owner, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => getStoredTheme())
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setStoredTheme(theme) }, [theme])

  const items = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  const initials = owner?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'RA'

  return (
    <div className="min-h-screen bg-background dark:bg-slate-950 flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 z-50 flex flex-col h-screen w-[280px] lg:w-[280px]
        bg-white dark:bg-slate-900 border-r border-border
        transition-transform duration-300 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-bold tracking-tight text-foreground">RAI Planner</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">Smart Engineering</p>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-muted cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-light border border-primary/10 px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-semibold text-primary tracking-wide">BUSINESS EDITION</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Workspace</p>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all cursor-pointer
                 ${isActive
                   ? 'bg-primary text-white shadow-sm shadow-primary/20'
                   : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                 }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}`} />
                  <span className="flex-1 min-w-0 text-left leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-3 bg-muted/20">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
            <span className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors ${theme === 'dark' ? 'bg-primary justify-end' : 'bg-border justify-start'}`}>
              <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </span>
          </button>

          <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none truncate">{owner?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{owner?.email}</p>
            </div>
          </div>

          <button
            onClick={() => { logout(); navigate('/login') }}
            className="w-full btn btn-outline justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl hover:bg-muted cursor-pointer">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm">RAI Planner</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary text-white grid place-items-center text-xs font-bold">
            {initials}
          </div>
        </header>

        <main className="flex-1 bg-background dark:bg-slate-950">
          <div className="w-[95%] mx-auto py-6 lg:py-8">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-card/50 px-6 py-3 text-center text-xs text-muted-foreground">
          © 2026 Squadify Lab · RAI Planner · Rami Youssef · v0.1
        </footer>
      </div>
    </div>
  )
}
