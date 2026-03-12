'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Trophy, User, Bell, Shield, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/dashboard/leaderboard', label: 'Board', icon: Trophy },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
]

const SUBMIT_TASK_NAV = { href: '/dashboard/submit-task', label: 'Submit', icon: Send }

export function MobileNav() {
  const pathname = usePathname()
  const { currentUser } = useApp()
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!currentUser?.id) return
    apiFetch<any[]>('/dashboard/notifications')
      .then((items) => setUnread(items.filter((n: any) => !n.read).length))
      .catch(() => setUnread(0))
  }, [currentUser?.id])

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-sidebar/95 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all relative',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.label === 'Alerts' && unread > 0 && (
                <span className="absolute top-1 right-1.5 flex size-2 rounded-full bg-primary animate-pulse-glow" />
              )}
            </Link>
          )
        })}
        {currentUser?.role !== 'admin' && currentUser?.role !== 'lead' && (
          <Link
            href={SUBMIT_TASK_NAV.href}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all',
              pathname === SUBMIT_TASK_NAV.href ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <SUBMIT_TASK_NAV.icon className="size-5" />
            <span className="text-[10px] font-medium">{SUBMIT_TASK_NAV.label}</span>
          </Link>
        )}
        {(currentUser?.role === 'admin' || currentUser?.role === 'lead') && (
          <Link
            href="/dashboard/admin"
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all',
              pathname === '/dashboard/admin' ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Shield className="size-5" />
            <span className="text-[10px] font-medium">Admin</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
