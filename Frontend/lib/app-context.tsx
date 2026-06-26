'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@/lib/data'
import { loginApi, meApi, registerApi, type AuthUser, saveAuthToken, removeAuthToken } from '@/lib/api'
import { getAuthToken } from '@/lib/auth-token'

interface AppContextValue {
  currentUser: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<string>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function mapAuthUserToUser(auth: AuthUser): User {
  const initials =
    auth.name
      ?.trim()
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  const avatarInitials =
    auth.avatar && !auth.avatar.includes('dicebear.com') && !auth.avatar.startsWith('http')
      ? auth.avatar
      : (auth as any).initials ?? initials
  return {
    id: auth.id,
    name: auth.name,
    email: auth.email,
    role: auth.role as User['role'],
    avatar: avatarInitials,
    avatarSrc: undefined,
    points: auth.points ?? 0,
    tasksCompleted: auth.tasksCompleted ?? 0,
    rank: auth.rank ?? 0,
    joinedAt: auth.joinedAt ? new Date(auth.joinedAt).toISOString() : new Date().toISOString(),
    bio: auth.bio ?? '',
    position: (auth as any).position ?? '',
    interests: (auth as any).interests ?? [],
    badges: (auth.badges as any) ?? [],
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    meApi()
      .then((u) => setCurrentUser(mapAuthUserToUser(u)))
      .catch(() => {
        if (!getAuthToken()) {
          setCurrentUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogin(email: string, password: string) {
    const { token, user } = await loginApi(email, password)
    saveAuthToken(token)
    setCurrentUser(mapAuthUserToUser(user))
  }

  async function handleRegister(name: string, email: string, password: string) {
    const { message } = await registerApi(name, email, password)
    return message
  }

  async function refreshUser() {
    const token = getAuthToken()
    if (!token) return
    try {
      const u = await meApi()
      setCurrentUser(mapAuthUserToUser(u))
    } catch {
      if (!getAuthToken()) setCurrentUser(null)
    }
  }

  function handleLogout() {
    removeAuthToken()
    setCurrentUser(null)
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        loading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        refreshUser,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
