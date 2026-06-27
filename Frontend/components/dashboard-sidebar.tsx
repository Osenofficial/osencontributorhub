'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LayoutGrid,
  Trophy,
  User,
  Bell,
  Zap,
  Shield,
  Star,
  Receipt,
  Users,
  Send,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { AvatarCircle } from '@/components/avatar-circle'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

const MAIN_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/my-tasks', label: 'My tasks', icon: UserCircle, actionBadge: true },
  { href: '/dashboard/all-tasks', label: 'All tasks', icon: LayoutGrid },
  { href: '/dashboard/submit-task', label: 'Submit task', icon: Send },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
]

const ACCOUNT_NAV = [
  { href: '/dashboard/invoices', label: 'Invoices / Billing', icon: Receipt },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: true },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
]

const NAV_ITEMS_INVOICES = [
  { href: '/dashboard/invoices', label: 'Invoices / Billing', icon: Receipt },
  { href: '/dashboard/submit-task', label: 'Submit task', icon: Send },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: true },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
]

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  unread,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  unread?: number
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-primary/12 text-primary'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
      )}
    >
      {active && <span className="nav-active-indicator" aria-hidden />}
      <Icon
        className={cn(
          'size-[18px] shrink-0 transition-colors',
          active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      <span className="flex-1">{label}</span>
      {unread != null && unread > 0 && (
        <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const { currentUser } = useApp()
  const [unread, setUnread] = useState(0)
  const [myTasksActionCount, setMyTasksActionCount] = useState(0)

  useEffect(() => {
    if (!currentUser?.id) return
    apiFetch<any[]>('/dashboard/notifications')
      .then((items) => setUnread(items.filter((n: any) => !n.read).length))
      .catch(() => setUnread(0))
    apiFetch<{ count: number }>('/dashboard/my-tasks-badge')
      .then((data) => setMyTasksActionCount(data.count ?? 0))
      .catch(() => setMyTasksActionCount(0))
  }, [currentUser?.id, pathname])

  if (!currentUser) return null

  const role = currentUser.role
  const isLimited = role === 'accounts' || role === 'evangelist'
  const mainNav = isLimited ? [] : MAIN_NAV
  const accountNav = isLimited ? NAV_ITEMS_INVOICES : ACCOUNT_NAV

  return (
    <aside className="flex h-screen w-[17.5rem] flex-col border-r border-border/40 bg-sidebar/95 py-6 px-3">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 shadow-md shadow-primary/10">
          <Zap className="size-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold leading-none tracking-tight">Contributor Hub</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
            OSEN
          </div>
        </div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {mainNav.length > 0 && (
          <div className="space-y-1">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Work
            </p>
            {mainNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={pathname === item.href}
                unread={
                  'badge' in item && item.badge
                    ? unread
                    : 'actionBadge' in item && item.actionBadge
                      ? myTasksActionCount
                      : undefined
                }
              />
            ))}
          </div>
        )}

        <div className="space-y-1">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {isLimited ? 'Menu' : 'Account'}
          </p>
          {accountNav.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href}
              unread={item.badge ? unread : undefined}
            />
          ))}
        </div>

        {(role === 'admin' || role === 'lead') && (
          <div className="space-y-1">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {role === 'admin' ? 'Admin' : 'Program'}
            </p>
            <NavLink
              href="/dashboard/admin"
              label={role === 'admin' ? 'Admin panel' : 'Program'}
              icon={Shield}
              active={pathname === '/dashboard/admin'}
            />
          </div>
        )}
      </nav>

      <div className="mt-4 rounded-2xl border border-border/50 bg-card/40 p-3.5">
        <div className="flex items-center gap-3">
          <AvatarCircle initials={currentUser.avatar} src={currentUser.avatarSrc} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{currentUser.name}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {role === 'admin' ? (
                <>
                  <Shield className="size-3 text-primary" /> Admin
                </>
              ) : role === 'lead' ? (
                <>
                  <Users className="size-3 text-accent" /> Lead
                </>
              ) : role === 'accounts' ? (
                <>
                  <Receipt className="size-3 text-primary" /> Accounts
                </>
              ) : role === 'evangelist' ? (
                <>
                  <Star className="size-3 text-yellow-400" /> Evangelist
                </>
              ) : (
                <>
                  <Zap className="size-3 text-primary" /> {currentUser.points} pts
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
