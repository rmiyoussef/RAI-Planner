const API_BASE = import.meta.env.VITE_API_URL as string
if (!API_BASE) throw new Error("VITE_API_URL is not set in .env — no hard-coded fallback")

function getToken() {
  return localStorage.getItem('rai_token')
}

export class ApiError extends Error {
  status: number
  headers: Headers
  detail: string
  constructor(message: string, status: number, headers: Headers, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.headers = headers
    this.detail = detail || message
  }
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
    const detail = typeof msg === 'string' ? msg : JSON.stringify(msg)
    throw new ApiError(detail, res.status, res.headers, detail)
  }
  return data
}

export const api = {
  get: (p: string) => apiFetch(p),
  post: (p: string, body: any) => apiFetch(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p: string, body: any) => apiFetch(p, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (p: string, body: any) => apiFetch(p, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (p: string) => apiFetch(p, { method: 'DELETE' }),
}
