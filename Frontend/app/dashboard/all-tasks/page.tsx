'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Eye,
  Filter,
  ClipboardList,
  Sparkles,
  UserCircle,
  CalendarRange,
  Pencil,
  Send,
  PlayCircle,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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

function getLatestRejectComment(task: any): string {
  const history = Array.isArray(task?.history) ? [...task.history] : []
  const sorted = history.sort(
    (a: any, b: any) => new Date(b?.createdAt ?? 0).getTime() - new Date(a?.createdAt ?? 0).getTime(),
  )
  for (const e of sorted) {
    if (e?.toStatus === 'rejected' && e?.meta && typeof e.meta.rejectComment === 'string') {
      const s = e.meta.rejectComment.trim()
      if (s) return s
    }
  }
  return ''
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
  const [submissionDraft, setSubmissionDraft] = useState({
    githubLink: '',
    notionLink: '',
    googleDoc: '',
    comments: '',
  })
  const [submissionSaving, setSubmissionSaving] = useState(false)
  const [startTaskLoading, setStartTaskLoading] = useState(false)
  /** Eye = read-only modal; Pencil = editable (submission / start task). */
  const [taskDetailMode, setTaskDetailMode] = useState<'view' | 'edit' | null>(null)
  /** When set, dialog scrolls to assignee edit/start section after open (pencil on card). */
  const [scrollAssigneeSectionTaskId, setScrollAssigneeSectionTaskId] = useState<string | null>(null)
  const assigneeActionsRef = useRef<HTMLDivElement>(null)

  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'lead'

  useEffect(() => {
    if (!viewTask || !scrollAssigneeSectionTaskId) return
    const id = String(viewTask._id ?? viewTask.id)
    if (id !== scrollAssigneeSectionTaskId) return
    const timer = window.setTimeout(() => {
      assigneeActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setScrollAssigneeSectionTaskId(null)
    }, 150)
    return () => clearTimeout(timer)
  }, [viewTask, scrollAssigneeSectionTaskId])

  useEffect(() => {
    if (!viewTask) return
    const s = viewTask.submission || {}
    setSubmissionDraft({
      githubLink: typeof s.githubLink === 'string' ? s.githubLink : '',
      notionLink: typeof s.notionLink === 'string' ? s.notionLink : '',
      googleDoc: typeof (s as { googleDoc?: string }).googleDoc === 'string' ? (s as { googleDoc?: string }).googleDoc! : '',
      comments: typeof s.comments === 'string' ? s.comments : '',
    })
  }, [viewTask])

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
          case 'rejected':
            statusOk = task.status === 'rejected'
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

  async function patchMyTask(
    taskId: string,
    body: { status?: string; submission?: typeof submissionDraft },
  ) {
    return apiFetch<any>(`/dashboard/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  async function handleSaveSubmission(options?: { alsoSubmit?: boolean }) {
    const id = viewTask?._id ?? viewTask?.id
    if (!id || !viewTask) return
    setSubmissionSaving(true)
    try {
      const payload: { status?: string; submission: typeof submissionDraft } = {
        submission: submissionDraft,
      }
      if (options?.alsoSubmit && (viewTask.status === 'in_progress' || viewTask.status === 'rejected')) {
        payload.status = 'submitted'
      }
      const updated = await patchMyTask(String(id), payload)
      setViewTask(updated)
      refreshFeed()
    } catch {
      /* toast optional */
    } finally {
      setSubmissionSaving(false)
    }
  }

  async function handleStartAssignedTask() {
    const id = viewTask?._id ?? viewTask?.id
    if (!id || !viewTask || viewTask.status !== 'todo') return
    setStartTaskLoading(true)
    try {
      const updated = await patchMyTask(String(id), { status: 'in_progress' })
      setViewTask(updated)
      refreshFeed()
    } catch {
      /* */
    } finally {
      setStartTaskLoading(false)
    }
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
    const assigneeId = assignee?._id ?? assignee
    const taskAssignedToMe =
      Boolean(currentUser?.id && assigneeId != null && String(assigneeId) === String(currentUser.id))
    const showCardEditPencil = taskAssignedToMe && !isPool && task.status !== 'completed'
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
              onClick={() => {
                setScrollAssigneeSectionTaskId(null)
                setTaskDetailMode('view')
                setViewTask(task)
              }}
            >
              <Eye className="size-3.5" />
              View
            </Button>
            {showCardEditPencil && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Edit submission / start task"
                className="h-8 w-8 shrink-0 p-0 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => {
                  setTaskDetailMode('edit')
                  setViewTask(task)
                  setScrollAssigneeSectionTaskId(String(tid))
                }}
              >
                <Pencil className="size-3.5" />
                <span className="sr-only">Edit task</span>
              </Button>
            )}
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
  const vtAssigneeId = vt?.assignedTo?._id ?? vt?.assignedTo
  const vtMine =
    Boolean(currentUser?.id && vtAssigneeId != null && String(vtAssigneeId) === String(currentUser.id))
  const canEditSubmission =
    vtMine && (vt?.status === 'in_progress' || vt?.status === 'submitted' || vt?.status === 'rejected')
  const latestRejectComment = getLatestRejectComment(vt)
  const canStartAssigned = vtMine && vt?.status === 'todo' && !vtPool
  const dialogEditable = taskDetailMode === 'edit'
  const showAssigneeEditPanel = dialogEditable && (canStartAssigned || canEditSubmission)
  const showReadOnlySubmission =
    Boolean(vt?.submission) && (!dialogEditable || !canEditSubmission)

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
                      <SelectItem value="rejected">Rejected</SelectItem>
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

      <Dialog
        open={!!viewTask}
        onOpenChange={(o) => {
          if (!o) {
            setViewTask(null)
            setTaskDetailMode(null)
            setScrollAssigneeSectionTaskId(null)
          }
        }}
      >
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
              <StatusBadge value={vt?.priority} type="priority" />
              <StatusBadge value={vt?.status} type="status" />
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground/80">Contribution type:</span>{' '}
                {vt?.contributionType ?? vt?.category ?? '—'}
              </p>
              <p>
                <span className="font-medium text-foreground/80">Points:</span>{' '}
                <span className="font-semibold text-primary">{vt?.points ?? 0}</span>
              </p>
            </div>

            {taskDetailMode === 'view' && vtMine && (canStartAssigned || canEditSubmission) && (
              <p className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                <Pencil className="mt-0.5 size-3.5 shrink-0 text-primary/80" aria-hidden />
                <span>
                  This is a read-only view. Use the <strong className="text-foreground/90">pencil</strong> on the
                  task card to start the task or edit your submission.
                </span>
              </p>
            )}

            {showAssigneeEditPanel && (
              <div ref={assigneeActionsRef} className="space-y-4 scroll-mt-6">
            {canStartAssigned && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Assigned to you — mark it in progress when you start.</p>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={startTaskLoading}
                  onClick={() => void handleStartAssignedTask()}
                >
                  <PlayCircle className="size-4" />
                  {startTaskLoading ? 'Starting…' : 'Start task'}
                </Button>
              </div>
            )}

            {canEditSubmission && (
              <div className="rounded-lg border border-primary/25 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Pencil className="size-4 text-primary" />
                  Your submission
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  You can edit proof links and notes while the task is <strong>in progress</strong> or{' '}
                  <strong>submitted</strong> (waiting for review). If it was rejected, update and submit again.
                </p>
                {vt?.status === 'rejected' && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground/90">
                    <p className="font-semibold text-destructive">Submission rejected</p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                      {latestRejectComment || 'No comment was added by the reviewer.'}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">GitHub</Label>
                    <Input
                      className="h-9 text-sm bg-background"
                      placeholder="https://github.com/…"
                      value={submissionDraft.githubLink}
                      onChange={(e) => setSubmissionDraft((d) => ({ ...d, githubLink: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notion</Label>
                    <Input
                      className="h-9 text-sm bg-background"
                      placeholder="https://notion.so/…"
                      value={submissionDraft.notionLink}
                      onChange={(e) => setSubmissionDraft((d) => ({ ...d, notionLink: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Google Doc</Label>
                    <Input
                      className="h-9 text-sm bg-background"
                      placeholder="https://docs.google.com/…"
                      value={submissionDraft.googleDoc}
                      onChange={(e) => setSubmissionDraft((d) => ({ ...d, googleDoc: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes for reviewers</Label>
                    <Textarea
                      className="min-h-[72px] text-sm bg-background resize-none"
                      placeholder="What did you deliver? Anything reviewers should know?"
                      value={submissionDraft.comments}
                      onChange={(e) => setSubmissionDraft((d) => ({ ...d, comments: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={submissionSaving}
                    onClick={() => void handleSaveSubmission()}
                  >
                    {submissionSaving ? 'Saving…' : 'Save submission'}
                  </Button>
                  {(vt?.status === 'in_progress' || vt?.status === 'rejected') && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={submissionSaving}
                      onClick={() => void handleSaveSubmission({ alsoSubmit: true })}
                    >
                      <Send className="size-3.5" />
                      {submissionSaving
                        ? 'Sending…'
                        : vt?.status === 'rejected'
                          ? 'Save & resubmit for review'
                          : 'Save & submit for review'}
                    </Button>
                  )}
                </div>
              </div>
            )}
              </div>
            )}

            {showReadOnlySubmission && (
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
                {(vt.submission as { googleDoc?: string }).googleDoc && (
                  <a
                    href={(vt.submission as { googleDoc?: string }).googleDoc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-primary hover:underline"
                  >
                    {(vt.submission as { googleDoc?: string }).googleDoc}
                  </a>
                )}
                {vt.submission.comments && (
                  <p className="whitespace-pre-wrap text-muted-foreground">{vt.submission.comments}</p>
                )}
              </div>
            )}
            {(vt?.status === 'rejected' || getLatestRejectComment(vt)) && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-1.5">
                <p className="text-sm font-semibold text-destructive">Reviewer rejection / reversal note</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {getLatestRejectComment(vt) ||
                    'No detailed reason was recorded; check with your lead or admin.'}
                </p>
              </div>
            )}
            <div className="border-t border-border/50 pt-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Task comments</p>
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
