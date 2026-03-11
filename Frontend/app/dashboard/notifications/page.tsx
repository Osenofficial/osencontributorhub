'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCheck, ClipboardList, Star, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

type NotifType = 'task_assigned' | 'task_approved' | 'points_awarded' | 'admin_comment' | 'general'

const NOTIF_ICONS: Record<NotifType, React.ComponentType<{ className?: string }>> = {
  task_assigned: ClipboardList,
  task_approved: CheckCircle2,
  points_awarded: Star,
  admin_comment: MessageSquare,
  general: Bell,
}

const NOTIF_COLORS: Record<NotifType, string> = {
  task_assigned: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  task_approved: 'text-green-400 bg-green-400/10 border-green-400/20',
  points_awarded: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  admin_comment: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  general: 'text-muted-foreground bg-muted/50 border-border/50',
}

function getNotifType(title: string): NotifType {
  const t = title.toLowerCase()
  if (t.includes('assigned') || t.includes('task')) return 'task_assigned'
  if (t.includes('approved') || t.includes('completed')) return 'task_approved'
  if (t.includes('point')) return 'points_awarded'
  if (t.includes('comment')) return 'admin_comment'
  return 'general'
}

interface ApiNotification {
  _id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  type?: NotifType
}

export default function NotificationsPage() {
  const { currentUser } = useApp()
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch<ApiNotification[]>('/dashboard/notifications')
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false))
  }, [currentUser?.id])

  const unread = notifications.filter((n) => !n.read)

  async function markAllRead() {
    try {
      const updated = await apiFetch<ApiNotification[]>('/dashboard/notifications/read-all', {
        method: 'POST',
      })
      setNotifications(updated)
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  function markRead(id: string) {
    apiFetch(`/dashboard/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    )
  }

  function formatDate(createdAt: string) {
    const d = new Date(createdAt)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isYesterday =
      new Date(now.getTime() - 864e5).toDateString() === d.toDateString()
    if (isToday) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
    if (isYesterday) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Notifications" />

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {loading
                ? 'Loading...'
                : unread.length > 0
                  ? `${unread.length} unread · ${notifications.length} total`
                  : notifications.length === 0
                    ? 'No notifications yet'
                    : `All caught up · ${notifications.length} total`}
            </p>
          </div>
          {!loading && unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="glass rounded-2xl border p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass rounded-2xl border p-12 text-center space-y-3">
            <Bell className="size-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-sm">No notifications yet.</p>
            <p className="text-xs text-muted-foreground/80">
              When you get new tasks or updates, they’ll show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const type = notif.type ?? getNotifType(notif.title)
              const Icon = NOTIF_ICONS[type]
              const colorClass = NOTIF_COLORS[type]
              return (
                <div
                  key={notif._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => markRead(notif._id)}
                  onKeyDown={(e) => e.key === 'Enter' && markRead(notif._id)}
                  className={cn(
                    'glass rounded-xl border p-4 flex items-start gap-4 transition-all cursor-pointer hover:border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/30',
                    !notif.read ? 'border-primary/20 bg-primary/5' : 'border-border/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-xl border',
                      colorClass,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          !notif.read && 'text-foreground',
                        )}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    {!notif.read && (
                      <span className="inline-block mt-2 text-[10px] text-primary font-medium">
                        Click to mark as read
                      </span>
                    )}
                  </div>
                  {!notif.read && (
                    <span className="shrink-0 flex size-2.5 rounded-full bg-primary mt-1.5 animate-pulse" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
