'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User } from '@/lib/data'
import { USERS } from '@/lib/data'
import { loginApi, meApi, registerApi, type AuthUser } from '@/lib/api'

interface AppContextValue {
  currentUser: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<string>
  logout: () => void
  allUsers: User[]
}

const AppContext = createContext<AppContextValue | null>(null)

function mapAuthUserToUser(auth: AuthUser): User {
  // Fallback to first mock user shape, but override dynamic fields from backend
  const base = USERS[0]
  return {
    ...base,
    id: auth.id,
    name: auth.name,
    email: auth.email,
    role: auth.role as any,
    avatar: auth.avatar || base.avatar,
    points: auth.points ?? base.points,
    tasksCompleted: auth.tasksCompleted ?? base.tasksCompleted,
    rank: auth.rank ?? base.rank,
    joinedAt: auth.joinedAt ?? base.joinedAt,
    bio: auth.bio ?? base.bio,
    badges: base.badges,
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
        allUsers: USERS,
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
