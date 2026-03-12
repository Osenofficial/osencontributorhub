'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@/lib/data'
import { loginApi, meApi, registerApi, type AuthUser } from '@/lib/api'

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
      .join("")
      .toUpperCase() || "?"
  return {
    id: auth.id,
    name: auth.name,
    email: auth.email,
    role: auth.role as User['role'],
    avatar: (auth as any).initials ?? auth.avatar ?? initials,
    avatarSrc: auth.avatar?.startsWith('http') ? auth.avatar : undefined,
    points: auth.points ?? 0,
    tasksCompleted: auth.tasksCompleted ?? 0,
    rank: auth.rank ?? 0,
    joinedAt: auth.joinedAt ? new Date(auth.joinedAt).toISOString() : new Date().toISOString(),
    bio: auth.bio ?? '',
    badges: (auth.badges as any) ?? [],
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = window.localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    meApi()
      .then((u) => setCurrentUser(mapAuthUserToUser(u)))
      .catch(() => {
        window.localStorage.removeItem('token')
        setCurrentUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleLogin(email: string, password: string) {
    const { token, user } = await loginApi(email, password)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('token', token)
    }
    setCurrentUser(mapAuthUserToUser(user))
  }

  async function handleRegister(name: string, email: string, password: string) {
    const { message } = await registerApi(name, email, password)
    return message
  }

  async function refreshUser() {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null
    if (!token) return
    try {
      const u = await meApi()
      setCurrentUser(mapAuthUserToUser(u))
    } catch {
      setCurrentUser(null)
    }
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('token')
    }
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
