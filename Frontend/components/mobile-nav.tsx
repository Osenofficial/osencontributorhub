'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LayoutGrid,
  Send,
  Receipt,
  Bell,
  Shield,
  MoreHorizontal,
  ListTodo,
  PlusSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Trophy } from 'lucide-react'

/** Primary mobile tabs — matches sidebar labels where possible */
const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/my-tasks', label: 'My tasks', icon: ListTodo },
  { href: '/dashboard/all-tasks', label: 'All tasks', icon: LayoutGrid },
  { href: '/dashboard/submit-task', label: 'Submit', icon: Send, accent: true },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: true },
]

const LIMITED_NAV = [
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/submit-task', label: 'Submit', icon: Send, accent: true },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: true },
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
  }, [currentUser?.id, pathname])

  if (!currentUser) return null

  const role = currentUser.role
  const isLimited = role === 'accounts' || role === 'evangelist'
  const navItems = isLimited ? LIMITED_NAV : PRIMARY_NAV
  const showAdmin = role === 'admin' || role === 'lead'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-sidebar/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {navItems.map((item) => {
          const active = pathname === item.href
          const isAccent = 'accent' in item && item.accent
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl transition-all',
                  isAccent && active && 'bg-primary text-primary-foreground shadow-md shadow-primary/25',
                  isAccent && !active && 'bg-primary/10 text-primary',
                  !isAccent && active && 'bg-primary/15',
                )}
              >
                <item.icon className="size-[18px] shrink-0" />
              </span>
              <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
              {'badge' in item && item.badge && unread > 0 && (
                <span className="absolute right-2 top-1 flex size-2 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-muted-foreground',
                (pathname === '/dashboard/profile' ||
                  pathname === '/dashboard/leaderboard' ||
                  pathname === '/dashboard/admin' ||
                  pathname === '/dashboard/invoices') &&
                  'text-primary',
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-xl">
                <MoreHorizontal className="size-[18px]" />
              </span>
              <span className="text-[10px] font-medium">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-48 border-border/60 bg-popover/95">
            {!isLimited && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/invoices" className="flex items-center gap-2">
                    <Receipt className="size-4" /> Invoices
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/leaderboard" className="flex items-center gap-2">
                    <Trophy className="size-4" /> Leaderboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="flex items-center gap-2">
                    <User className="size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            {isLimited && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="flex items-center gap-2">
                  <User className="size-4" /> Profile
                </Link>
              </DropdownMenuItem>
            )}
            {showAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/admin" className="flex items-center gap-2">
                  {role === 'admin' ? <PlusSquare className="size-4" /> : <Shield className="size-4" />}{' '}
                  {role === 'admin' ? 'Create task' : 'Program'}
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
