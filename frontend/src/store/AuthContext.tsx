import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

type Owner = { id: string; full_name: string; email: string }

type AuthState = {
  owner: Owner | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (full_name: string, email: string, password: string, confirm_password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthState>(null as any)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [owner, setOwner] = useState<Owner | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rai_token'))
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!localStorage.getItem('rai_token')) { setLoading(false); return }
    try {
      const data = await api.get('/auth/me')
      setOwner(data)
    } catch {
      localStorage.removeItem('rai_token')
      setToken(null)
      setOwner(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  async function login(email: string, password: string) {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('rai_token', data.access_token)
    setToken(data.access_token)
    setOwner(data.owner)
  }
  async function signup(full_name: string, email: string, password: string, confirm_password: string) {
    const data = await api.post('/auth/signup', { full_name, email, password, confirm_password })
    localStorage.setItem('rai_token', data.access_token)
    setToken(data.access_token)
    setOwner(data.owner)
  }
  function logout() {
    localStorage.removeItem('rai_token')
    setToken(null)
    setOwner(null)
  }

  return <Ctx.Provider value={{ owner, token, loading, login, signup, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }
