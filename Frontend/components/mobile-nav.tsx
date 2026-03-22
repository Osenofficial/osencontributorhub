'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LayoutGrid,
  Trophy,
  User,
  Bell,
  Shield,
  Receipt,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/all-tasks', label: 'Tasks', icon: LayoutGrid },
  { href: '/dashboard/submit-task', label: 'Submit', icon: Send },
  { href: '/dashboard/leaderboard', label: 'Board', icon: Trophy },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
]

const NAV_INVOICES = [
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/submit-task', label: 'Submit', icon: Send },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
]

const NAV_ACCOUNTS = [
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/submit-task', label: 'Submit', icon: Send },
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

  const role = currentUser?.role
  const navItems =
    role === 'accounts' ? NAV_ACCOUNTS : role === 'evangelist' ? NAV_INVOICES : NAV
  const showProgramLink =
    (currentUser?.role === 'admin' || currentUser?.role === 'lead') &&
    currentUser?.role !== 'accounts' &&
    currentUser?.role !== 'evangelist'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-sidebar/95 pb-[env(safe-area-inset-bottom,0px)] pt-1 backdrop-blur-sm md:hidden">
      {/* Horizontal scroll keeps one row so bar height stays stable; content above gets consistent pb in layout */}
      <div className="flex max-h-[4.25rem] items-stretch justify-start gap-0 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5 px-2 py-1.5 transition-all relative',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="max-w-[3.5rem] truncate text-center text-[9px] font-medium leading-tight sm:text-[10px]">
                {item.label}
              </span>
              {item.label === 'Alerts' && unread > 0 && (
                <span className="absolute top-0.5 right-1 flex size-2 rounded-full bg-primary animate-pulse-glow" />
              )}
            </Link>
          )
        })}
        {showProgramLink && (
          <Link
            href="/dashboard/admin"
            className={cn(
              'flex min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5 px-2 py-1.5 transition-all',
              pathname === '/dashboard/admin' ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Shield className="size-5 shrink-0" />
            <span className="max-w-[3.5rem] truncate text-center text-[9px] font-medium leading-tight sm:text-[10px]">
              {currentUser?.role === 'admin' ? 'Admin' : 'Program'}
            </span>
          </Link>
        )}
      </div>
    </nav>
  )
}
