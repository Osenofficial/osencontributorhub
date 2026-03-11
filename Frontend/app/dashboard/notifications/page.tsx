'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCheck, ClipboardList, Star, MessageSquare, CheckCircle2 } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import type { Notification } from '@/lib/data'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

const NOTIF_ICONS: Record<Notification['type'], React.ComponentType<{ className?: string }>> = {
  task_assigned: ClipboardList,
  task_approved: CheckCircle2,
  points_awarded: Star,
  admin_comment: MessageSquare,
}

const NOTIF_COLORS: Record<Notification['type'], string> = {
  task_assigned: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  task_approved: 'text-green-400 bg-green-400/10 border-green-400/20',
  points_awarded: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  admin_comment: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
}

export default function NotificationsPage() {
  const { currentUser } = useApp()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    apiFetch<Notification[]>('/dashboard/notifications')
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }, [currentUser?.id])

  const unread = notifications.filter((n) => !n.read)

  function markAllRead() {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id)
    ids.forEach((id) => {
      apiFetch(`/dashboard/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    apiFetch(`/dashboard/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Notifications" />

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {unread.length > 0 ? `${unread.length} unread notification${unread.length > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {/* Notifications list */}
        {notifications.length === 0 ? (
          <div className="glass rounded-2xl border p-12 text-center space-y-3">
            <Bell className="size-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const Icon = NOTIF_ICONS[notif.type]
              const colorClass = NOTIF_COLORS[notif.type]
              return (
                <div
                  key={notif.id}
                  className={cn(
                    'glass rounded-xl border p-4 flex items-start gap-4 transition-all cursor-pointer hover:-translate-y-0.5',
                    !notif.read ? 'border-primary/20 bg-primary/5' : 'border-border/50',
                  )}
                  onClick={() => markRead(notif.id)}
                >
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl border', colorClass)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-medium', !notif.read && 'text-foreground')}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="shrink-0 flex size-2 rounded-full bg-primary mt-1.5 animate-pulse-glow" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">
                      {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state for no user notifications */}
        {notifications.length > 0 && unread.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">You are all caught up.</p>
          </div>
        )}
      </div>
    </div>
  )
}
