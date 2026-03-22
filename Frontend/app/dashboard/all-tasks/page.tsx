'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Eye,
  Filter,
  ClipboardList,
  Sparkles,
  UserCircle,
  CalendarRange,
} from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TaskComments } from '@/components/task-comments'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { apiFetch } from '@/lib/api'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'

function formatDateLabel(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function toIsoLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function userHasPendingAssignment(task: any, userId: string | undefined) {
  if (!userId || !task?.pendingAssignmentRequests?.length) return false
  return task.pendingAssignmentRequests.some(
    (p: any) => String(p.user?._id ?? p.user) === String(userId),
  )
}

export default function AllTasksPage() {
  const { currentUser } = useApp()
  const [taskFeed, setTaskFeed] = useState<any[]>([])
  const [taskFeedFilter, setTaskFeedFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [viewTask, setViewTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'lead'

  useEffect(() => {
    setLoading(true)
    apiFetch<any>('/dashboard/overview')
      .then((data) => setTaskFeed(data.taskFeed || []))
      .catch(() => setTaskFeed([]))
      .finally(() => setLoading(false))
  }, [currentUser?.id])

  function refreshFeed() {
    apiFetch<any>('/dashboard/overview')
      .then((data) => setTaskFeed(data.taskFeed || []))
      .catch(() => undefined)
  }

  const filteredTaskFeed = useMemo(() => {
    const uid = currentUser?.id
    return taskFeed.filter((task: any) => {
      if (taskFeedFilter !== 'all') {
        const isPool = task.status === 'todo' && !task.assignedTo
        const aid = task.assignedTo?._id ?? task.assignedTo
        const assigneeStr = aid != null ? String(aid) : ''
        const mine = uid != null && assigneeStr === String(uid)

        let statusOk = true
        switch (taskFeedFilter) {
          case 'unassigned':
            statusOk = isPool
            break
          case 'assigned':
            statusOk = !!task.assignedTo
            break
          case 'assigned_to_me':
            statusOk = mine
            break
          case 'todo':
            statusOk = task.status === 'todo'
            break
          case 'in_progress':
            statusOk = task.status === 'in_progress'
            break
          case 'submitted':
            statusOk = task.status === 'submitted'
            break
          case 'completed':
            statusOk = task.status === 'completed'
            break
          default:
            statusOk = true
        }
        if (!statusOk) return false
      }

      if (dateFrom || dateTo) {
        let from = dateFrom
        let to = dateTo
        if (from && to && from > to) {
          ;[from, to] = [to, from]
        }
        const raw = task.createdAt
        if (!raw) return false
        const t = new Date(raw).getTime()
        if (Number.isNaN(t)) return false
        if (from) {
          const [y, m, d] = from.split('-').map(Number)
          const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
          if (t < start) return false
        }
        if (to) {
          const [y, m, d] = to.split('-').map(Number)
          const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
          if (t > end) return false
        }
      }

      return true
    })
  }, [taskFeed, taskFeedFilter, currentUser?.id, dateFrom, dateTo])

  function handleClaimTask(taskId: string, onSuccess?: () => void) {
    setClaimingId(taskId)
    apiFetch<any>(`/dashboard/tasks/${taskId}/claim`, { method: 'POST' })
      .then(() => {
        refreshFeed()
        onSuccess?.()
      })
      .catch(() => undefined)
      .finally(() => setClaimingId(null))
  }

  function handleRequestAssignment(taskId: string, onDone?: () => void) {
    setRequestingId(taskId)
    apiFetch<any>(`/dashboard/tasks/${taskId}/request-assignment`, { method: 'POST' })
      .then(() => {
        refreshFeed()
        onDone?.()
      })
      .catch(() => undefined)
      .finally(() => setRequestingId(null))
  }

  function renderTaskBox(task: any) {
    const tid = task._id ?? task.id
    const createdBy = task.createdBy
    const assignee = task.assignedTo
    const isPool = task.status === 'todo' && !task.assignedTo
    const canClaimPool = isPool && Boolean(currentUser?.id) && isManager
    const canRequest =
      isPool && Boolean(currentUser?.id) && !isManager && !userHasPendingAssignment(task, currentUser?.id)
    const pendingMine = isPool && userHasPendingAssignment(task, currentUser?.id)
    const dateStr = task.createdAt
      ? new Date(task.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

    return (
      <Card
        className={cn(
          'flex h-full flex-col gap-0 overflow-hidden border-2 py-0 shadow-md transition-all hover:shadow-lg',
          isPool
            ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/[0.06] to-card'
            : 'border-border/80 bg-card',
        )}
      >
        <CardHeader className="space-y-2 border-b border-border/50 bg-muted/20 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-left text-base font-semibold leading-snug">{task.title}</CardTitle>
            <span className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-xs font-bold tabular-nums text-primary">
              {task.points} pts
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={task.category} type="category" />
            <StatusBadge value={task.status} type="status" />
            {isPool && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                <UserCircle className="size-3" />
                Pool
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid flex-1 gap-2 px-4 py-4 text-xs">
          <div className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 rounded-lg border border-border/40 bg-background/50 p-2.5">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium text-foreground">{createdBy?.name ?? '—'}</span>
            <span className="text-muted-foreground">{isPool ? 'Type' : 'Assignee'}</span>
            <span className={cn('font-medium', isPool ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {isPool ? 'Open pool' : assignee?.name ?? '—'}
            </span>
            <span className="text-muted-foreground">Created</span>
            <span className="text-foreground/90">{dateStr}</span>
          </div>
        </CardContent>

        <CardFooter className="mt-auto flex flex-col gap-2 border-t border-border/50 bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewTask(task)}
            >
              <Eye className="size-3.5" />
              View
            </Button>
            {canClaimPool && (
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-100"
                disabled={claimingId === tid}
                onClick={() => handleClaimTask(tid)}
              >
                {claimingId === tid ? 'Claiming…' : 'Claim'}
              </Button>
            )}
            {canRequest && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 border border-amber-500/30"
                disabled={requestingId === tid}
                onClick={() => handleRequestAssignment(tid)}
              >
                {requestingId === tid ? 'Sending…' : 'Request'}
              </Button>
            )}
          </div>
          {pendingMine && (
            <span className="w-full rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-center text-[10px] font-medium text-primary sm:w-auto sm:text-left">
              Awaiting admin approval
            </span>
          )}
        </CardFooter>
      </Card>
    )
  }

  const vt = viewTask
  const vtId = vt?._id ?? vt?.id
  const vtPool = vt?.status === 'todo' && !vt?.assignedTo

  return (
    <div className="flex min-h-full flex-col">
      <DashboardTopbar title="All tasks" />

      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/[0.07] to-transparent" />
        <div className="relative mx-auto max-w-7xl space-y-6 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-border/60 bg-card/30 p-4 shadow-sm sm:p-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </div>

          <section className="overflow-hidden rounded-2xl border-2 border-border/60 bg-card/50 shadow-md">
            <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15 shadow-inner">
                  <ClipboardList className="size-6 text-primary" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" aria-hidden />
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Program task list</h1>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Boxes show each task. Open pool: use{' '}
                    <strong className="font-medium text-foreground">Request</strong> (admin approves) or{' '}
                    <strong className="font-medium text-foreground">Claim</strong> if you&apos;re an admin or lead.
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[min(100%,20rem)] sm:shrink-0">
                <div className="space-y-1.5 rounded-xl border border-border/50 bg-background/80 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Filter className="mr-1 inline size-3 align-text-bottom" />
                    Filter
                  </span>
                  <Select value={taskFeedFilter} onValueChange={setTaskFeedFilter}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Show…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tasks</SelectItem>
                      <SelectItem value="unassigned">Unassigned (open pool)</SelectItem>
                      <SelectItem value="assigned">Assigned (to someone)</SelectItem>
                      <SelectItem value="assigned_to_me">Assigned to me</SelectItem>
                      <SelectItem value="todo">To do</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 rounded-xl border border-border/50 bg-background/80 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <CalendarRange className="mr-1 inline size-3 align-text-bottom" />
                    Created date
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 min-w-[7.5rem] justify-start font-normal"
                        >
                          From
                          {dateFrom ? (
                            <span className="ml-1 text-foreground">· {formatDateLabel(dateFrom)}</span>
                          ) : (
                            <span className="ml-1 text-muted-foreground">…</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            dateFrom
                              ? (() => {
                                  const [y, m, d] = dateFrom.split('-').map(Number)
                                  return new Date(y, m - 1, d)
                                })()
                              : undefined
                          }
                          onSelect={(d) => {
                            if (!d) return
                            setDateFrom(toIsoLocalDate(d))
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 min-w-[7.5rem] justify-start font-normal"
                        >
                          To
                          {dateTo ? (
                            <span className="ml-1 text-foreground">· {formatDateLabel(dateTo)}</span>
                          ) : (
                            <span className="ml-1 text-muted-foreground">…</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={
                            dateTo
                              ? (() => {
                                  const [y, m, d] = dateTo.split('-').map(Number)
                                  return new Date(y, m - 1, d)
                                })()
                              : undefined
                          }
                          onSelect={(d) => {
                            if (!d) return
                            setDateTo(toIsoLocalDate(d))
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    {(dateFrom || dateTo) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2 text-muted-foreground"
                        onClick={() => {
                          setDateFrom('')
                          setDateTo('')
                        }}
                      >
                        Clear dates
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="max-h-[min(75vh,52rem)] overflow-y-auto p-4 sm:p-5">
              {loading ? (
                <p className="py-20 text-center text-sm text-muted-foreground">Loading tasks…</p>
              ) : taskFeed.length === 0 ? (
                <p className="py-20 text-center text-sm text-muted-foreground">No tasks in the program yet.</p>
              ) : filteredTaskFeed.length === 0 ? (
                <p className="py-20 text-center text-sm text-muted-foreground">
                  {dateFrom || dateTo
                    ? 'No tasks in this date range — adjust From/To or clear dates.'
                    : taskFeedFilter !== 'all'
                      ? 'No tasks match this filter — try "All tasks".'
                      : 'No tasks match this filter.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredTaskFeed.map((task: any) => (
                    <div key={task._id ?? task.id} className="flex min-h-[260px]">
                      {renderTaskBox(task)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Dialog open={!!viewTask} onOpenChange={(o) => !o && setViewTask(null)}>
        <DialogContent className="max-w-lg border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{vt?.title}</DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {vt?.description?.trim() ? vt.description : 'No description provided.'}
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground/80">Created by:</span>{' '}
                {vt?.createdBy?.name ?? '—'}
              </p>
              <p>
                <span className="font-medium text-foreground/80">Assigned:</span>{' '}
                {vt?.assignedTo?.name ?? (
                  <span className="text-amber-600 dark:text-amber-400">Open pool — not assigned yet</span>
                )}
              </p>
              {vt?.deadline && (
                <p>
                  <span className="font-medium text-foreground/80">Deadline:</span>{' '}
                  {new Date(vt.deadline).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={vt?.category} type="category" />
              <StatusBadge value={vt?.status} type="status" />
              <span className="text-sm font-mono text-primary font-semibold">{vt?.points} pts</span>
            </div>
            {vt?.submission && (
              <div className="rounded-lg border border-border/50 p-3 text-xs space-y-1">
                <div className="font-semibold">Submission</div>
                {vt.submission.githubLink && (
                  <a
                    href={vt.submission.githubLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-primary hover:underline"
                  >
                    {vt.submission.githubLink}
                  </a>
                )}
                {vt.submission.notionLink && (
                  <a
                    href={vt.submission.notionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-primary hover:underline"
                  >
                    {vt.submission.notionLink}
                  </a>
                )}
                {vt.submission.comments && (
                  <p className="whitespace-pre-wrap text-muted-foreground">{vt.submission.comments}</p>
                )}
              </div>
            )}
            <div className="border-t border-border/50 pt-4">
              <TaskComments taskId={vt?._id} />
            </div>
            {vt && vtPool && currentUser?.id && (
              <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center">
                {isManager ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={claimingId === vtId}
                    onClick={() => handleClaimTask(vtId, () => setViewTask(null))}
                  >
                    {claimingId === vtId ? 'Claiming…' : 'Claim this task'}
                  </Button>
                ) : userHasPendingAssignment(vt, currentUser.id) ? (
                  <p className="text-sm font-medium text-primary">Awaiting admin approval for this request.</p>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={requestingId === vtId}
                    onClick={() => handleRequestAssignment(vtId, () => setViewTask(null))}
                  >
                    {requestingId === vtId ? 'Sending…' : 'Request assignment'}
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {isManager
                    ? 'Assign this pool task to yourself to start working.'
                    : 'Ask an admin or lead to approve you for this task.'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
