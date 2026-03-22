const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api'

function getToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('token')
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed with status ${res.status}`)
  }

  return res.json()
}

/** Plain text / CSV (not JSON). Use for file downloads. */
export async function apiFetchText(path: string, options: RequestInit = {}): Promise<string> {
  const token = getToken()
  const headers: HeadersInit = {
    ...(options.headers || {}),
  }
  if (token) {
    ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed with status ${res.status}`)
  }

  return res.text()
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'lead' | 'associate' | 'intern' | 'accounts' | 'evangelist'
  status?: 'pending' | 'active' | 'rejected' | 'suspended'
  avatar?: string
  points?: number
  tasksCompleted?: number
  rank?: number
  joinedAt?: string
  bio?: string
  position?: string
  interests?: string[]
  badges?: string[]
}

export async function loginApi(email: string, password: string) {
  return apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function registerApi(name: string, email: string, password: string) {
  return apiFetch<{ message: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export async function meApi() {
  return apiFetch<AuthUser>('/auth/me')
}

