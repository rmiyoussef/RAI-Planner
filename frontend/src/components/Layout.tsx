import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useState, useEffect } from 'react'
import { getStoredTheme, setStoredTheme } from '../utils/theme'

export function Layout() {
  const { owner, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => getStoredTheme())
  useEffect(()=> { setStoredTheme(theme) }, [theme])

  const items = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/projects', label: 'Projects', icon: '📁' },
    { to: '/tasks', label: 'Tasks', icon: '✅' },
    { to: '/users', label: 'Users', icon: '👥' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ]
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">RAI</div>
          <span className="brand-text">RAI Planner</span>
        </div>
        <nav className="nav">
          {items.map(i => (
            <NavLink key={i.to} to={i.to} className={({isActive})=> isActive ? 'nav-item active' : 'nav-item'} end={i.to==='/'}>
              <span>{i.icon}</span> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-ghost" onClick={()=> setTheme(theme==='dark'?'light':'dark')}>
            {theme==='dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <div className="owner">
            <div className="owner-name">{owner?.full_name}</div>
            <div className="owner-email">{owner?.email}</div>
          </div>
          <button className="btn btn-outline" onClick={()=> { logout(); navigate('/login')}}>Logout</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
