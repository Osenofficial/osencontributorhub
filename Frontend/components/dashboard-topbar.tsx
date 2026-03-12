'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, LogOut, Zap, Shield, Star } from 'lucide-react'
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
  const { currentUser, logout } = useApp()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    apiFetch<any[]>('/dashboard/notifications')
      .then((items) => setUnreadCount(items.filter((n) => !n.read).length))
      .catch(() => setUnreadCount(0))
  }, [])

  if (!currentUser) return null

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm px-6">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Points badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
          <Zap className="size-3.5" />
          <span>{currentUser.points} pts</span>
        </div>

        {/* Notifications */}
        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-primary animate-pulse-glow" />
            )}
          </Button>
        </Link>

        {/* Account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-muted/50 transition-colors">
              <AvatarCircle initials={currentUser.avatar} src={currentUser.avatarSrc} size="sm" />
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium leading-none">{currentUser.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  {currentUser.role === 'admin' ? (
                    <>
                      <Shield className="size-3" /> Admin
                    </>
                  ) : (
                    <>
                      <Star className="size-3" /> Member
                    </>
                  )}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 glass border-border/60">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Signed in as
              <br />
              <span className="font-medium text-foreground">{currentUser.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive flex items-center gap-2"
            >
              <LogOut className="size-3.5" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
