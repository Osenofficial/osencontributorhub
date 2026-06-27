'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  ClipboardList,
  Star,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Megaphone,
  Receipt,
} from 'lucide-react'
import { DashboardPageShell, PageCard } from '@/components/dashboard-page-shell'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

type NotifType =
  | 'task_assigned'
  | 'task_approved'
  | 'points_awarded'
  | 'admin_comment'
  | 'announcement'
  | 'invoice'
  | 'general'

const NOTIF_ICONS: Record<NotifType, React.ComponentType<{ className?: string }>> = {
  task_assigned: ClipboardList,
  task_approved: CheckCircle2,
  points_awarded: Star,
  admin_comment: MessageSquare,
  announcement: Megaphone,
  invoice: Receipt,
  general: Bell,
}

const NOTIF_COLORS: Record<NotifType, string> = {
  task_assigned: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  task_approved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  points_awarded: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  admin_comment: 'text-violet-400 bg-violet-400/10 border-violet-400/25',
  announcement: 'text-primary bg-primary/10 border-primary/25',
  invoice: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25',
  general: 'text-muted-foreground bg-muted/40 border-border/50',
}

function getNotifType(title: string): NotifType {
  const t = title.toLowerCase()
  if (t.includes('announcement')) return 'announcement'
  if (t.includes('reimbursement') || t.includes('invoice') || t.includes('payout')) return 'invoice'
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
  taskId?: string | { _id?: string } | null
}

function getTaskId(notif: ApiNotification): string | null {
  const raw = notif.taskId
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && raw._id) return String(raw._id)
  return null
}

export default function NotificationsPage() {
  const { currentUser } = useApp()
  const router = useRouter()
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
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
  }

  function handleNotificationClick(notif: ApiNotification) {
    markRead(notif._id)
    const taskId = getTaskId(notif)
    if (taskId) {
      router.push(`/dashboard/my-tasks?task=${encodeURIComponent(taskId)}`)
      return
    }
    const type = getNotifType(notif.title)
    if (type === 'task_assigned' || type === 'task_approved') {
      router.push('/dashboard/my-tasks')
    }
  }

  function formatDate(createdAt: string) {
    const d = new Date(createdAt)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }
    const yesterday = new Date(now.getTime() - 864e5)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const statusLine = loading
    ? 'Loading your updates…'
    : unread.length > 0
      ? `${unread.length} unread · ${notifications.length} total`
      : notifications.length === 0
        ? 'Nothing here yet'
        : 'All caught up'

  return (
    <DashboardPageShell
      title="Notifications"
      description={statusLine}
      width="md"
      actions={
        !loading && unread.length > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <PageCard className="flex flex-col items-center justify-center gap-3 p-16">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Fetching notifications…</p>
        </PageCard>
      ) : notifications.length === 0 ? (
        <PageCard className="flex flex-col items-center justify-center gap-4 p-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
            <Bell className="size-7 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-medium">You&apos;re all clear</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Task updates, announcements, and invoice replies will show up here.
            </p>
          </div>
        </PageCard>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const type = getNotifType(notif.title)
            const Icon = NOTIF_ICONS[type]
            return (
              <button
                key={notif._id}
                type="button"
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  'surface-card flex w-full items-start gap-4 p-4 text-left transition-all hover:border-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  !notif.read && 'border-primary/25 bg-primary/[0.04]',
                )}
              >
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl border',
                    NOTIF_COLORS[type],
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn('text-sm font-semibold leading-snug', !notif.read && 'text-foreground')}>
                      {notif.title}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(notif.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {notif.message}
                  </p>
                  {getTaskId(notif) && (
                    <p className="mt-2 text-xs font-medium text-primary">Open task →</p>
                  )}
                </div>
                {!notif.read && (
                  <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </DashboardPageShell>
  )
}
