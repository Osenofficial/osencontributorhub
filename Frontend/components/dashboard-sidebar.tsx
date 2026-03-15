'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Trophy,
  User,
  Bell,
  Zap,
  Shield,
  Star,
  CalendarRange,
  Send,
  Receipt,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { AvatarCircle } from '@/components/avatar-circle'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/report', label: 'Contribution Report', icon: CalendarRange },
  { href: '/dashboard/invoices', label: 'Submit Invoices', icon: Receipt },
]

const NAV_ITEMS_FINANCE = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/invoices', label: 'Submit Invoices', icon: Receipt },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
]

const ADMIN_NAV_ITEMS = [
  { href: '/dashboard/admin', label: 'Admin Panel', icon: Shield },
]

export function DashboardSidebar() {
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
    <aside className="flex h-screen w-64 flex-col border-r border-border/50 bg-sidebar py-5 px-3">
      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2 px-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/40 neon-glow-purple">
          <Zap className="size-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold neon-text-purple leading-none">OSEN</div>
          <div className="text-[10px] text-muted-foreground leading-none mt-0.5">Contributor Hub</div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {(currentUser?.role === 'finance' ? NAV_ITEMS_FINANCE : NAV_ITEMS).map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <item.icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Notifications' && unread > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          )
        })}

        {currentUser?.role !== 'admin' && currentUser?.role !== 'lead' && currentUser?.role !== 'finance' && (
          <Link
            href="/dashboard/submit-task"
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              pathname === '/dashboard/submit-task'
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Send className={cn('size-4 shrink-0', pathname === '/dashboard/submit-task' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
            <span className="flex-1">Submit Task</span>
          </Link>
        )}

        {(currentUser?.role === 'admin' || currentUser?.role === 'lead') && currentUser?.role !== 'finance' && (
          <>
            <div className="mt-4 mb-2 px-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Admin</div>
            </div>
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <item.icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User card */}
      <div className="mt-4 glass rounded-xl border border-border/50 p-3">
        <div className="flex items-center gap-3">
          <AvatarCircle initials={currentUser.avatar} src={currentUser.avatarSrc} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{currentUser.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {currentUser.role === 'admin' ? (
                <><Shield className="size-3 text-primary" /> Admin</>
              ) : currentUser.role === 'finance' ? (
                <><Receipt className="size-3 text-primary" /> Finance</>
              ) : (
                <><Star className="size-3 text-yellow-400" /> {currentUser.points} pts</>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
