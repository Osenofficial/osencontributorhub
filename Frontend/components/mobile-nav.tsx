'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  User,
  Bell,
  Shield,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/tasks', label: 'My tasks', icon: ClipboardList },
  { href: '/dashboard/leaderboard', label: 'Board', icon: Trophy },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
]

const NAV_INVOICES = [
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
]

const NAV_ACCOUNTS = [
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
]

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
        {(() => {
          const role = currentUser?.role
          if (role === 'accounts') return NAV_ACCOUNTS
          if (role === 'evangelist') return NAV_INVOICES
          return NAV
        })().map((item) => {
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
        {(currentUser?.role === 'admin' || currentUser?.role === 'lead') &&
          currentUser?.role !== 'accounts' &&
          currentUser?.role !== 'evangelist' && (
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
