const TOKEN_KEY = 'auth_token'
const TOKEN_EXPIRES_KEY = 'auth_token_expires'
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000 // match JWT (30d default)

export function setAuthToken(token: string, ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === 'undefined') return
  const expiresAt = Date.now() + ttlMs
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt))
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = window.localStorage.getItem(TOKEN_KEY)
  const expiresRaw = window.localStorage.getItem(TOKEN_EXPIRES_KEY)
  if (!token) return null
  if (expiresRaw) {
    const expiresAt = Number(expiresRaw)
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      clearAuthToken()
      return null
    }
  }
  return token
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(TOKEN_EXPIRES_KEY)
}
