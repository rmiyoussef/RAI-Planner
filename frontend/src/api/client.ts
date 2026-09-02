const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('rai_token')
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

export const api = {
  get: (p: string) => apiFetch(p),
  post: (p: string, body: any) => apiFetch(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p: string, body: any) => apiFetch(p, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (p: string) => apiFetch(p, { method: 'DELETE' }),
}
