'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  LogOut,
  Zap,
  Shield,
  User,
  Trophy,
  LayoutGrid,
  Receipt,
} from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { AvatarCircle } from '@/components/avatar-circle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'

export function DashboardTopbar({ title }: { title: string }) {
  const pathname = usePathname()
  const { currentUser, logout } = useApp()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!currentUser?.id) return
    apiFetch<any[]>('/dashboard/notifications')
      .then((items) => setUnreadCount(items.filter((n) => !n.read).length))
      .catch(() => setUnreadCount(0))
  }, [currentUser?.id, pathname])

  if (!currentUser) return null

  const showPoints = !['accounts', 'admin'].includes(currentUser.role)

  return (
    <header className="sticky top-0 z-40 flex h-[4.25rem] shrink-0 items-center justify-between border-b border-border/40 bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {showPoints && (
          <div className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary sm:flex">
            <Zap className="size-3.5" />
            <span className="tabular-nums">{currentUser.points}</span>
            <span className="text-xs font-normal text-primary/80">pts</span>
          </div>
        )}

        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="relative size-10 rounded-xl">
            <Bell className="size-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition-colors hover:border-border/60 hover:bg-muted/30">
              <AvatarCircle initials={currentUser.avatar} src={currentUser.avatarSrc} size="sm" />
              <div className="hidden text-left sm:block">
                <div className="max-w-[8rem] truncate text-sm font-medium leading-none">
                  {currentUser.name}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground capitalize">
                  {currentUser.role === 'admin' && <Shield className="size-3" />}
                  {currentUser.role}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-border/60 bg-popover/95 backdrop-blur-xl">
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium text-foreground">{currentUser.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="flex cursor-pointer items-center gap-2">
                <User className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            {currentUser.role !== 'accounts' && currentUser.role !== 'evangelist' && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/all-tasks" className="flex cursor-pointer items-center gap-2">
                    <LayoutGrid className="size-4" /> All tasks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/leaderboard" className="flex cursor-pointer items-center gap-2">
                    <Trophy className="size-4" /> Leaderboard
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard/invoices" className="flex cursor-pointer items-center gap-2">
                <Receipt className="size-4" /> Invoices
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
