'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Github,
  FileText,
  Link as LinkIcon,
  Send,
  Play,
  UserPlus,
  MessageSquare,
  Sparkles,
  LayoutGrid,
  Calendar,
  Zap,
  Inbox,
  ChevronRight,
} from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { StatusBadge } from '@/components/status-badge'
import { AvatarCircle } from '@/components/avatar-circle'
import { useApp } from '@/lib/app-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TaskStatus,
  STATUS_LABELS,
} from '@/lib/data'
import { getContributionLabel } from '@/lib/contribution-types'
import { apiFetch } from '@/lib/api'
import { TaskComments } from '@/components/task-comments'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

function userHasPendingAssignment(task: any, userId: string | undefined) {
  if (!userId || !task?.pendingAssignmentRequests?.length) return false
  return task.pendingAssignmentRequests.some(
    (p: any) => String(p.user?._id ?? p.user) === String(userId),
  )
}

const COLUMN_ORDER: TaskStatus[] = ['todo', 'in_progress', 'submitted', 'completed']

const COLUMN_META: Record<
  TaskStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; glow: string; accent: string }
> = {
  todo: {
    icon: Circle,
    color: 'text-muted-foreground',
    glow: 'border-border/60 bg-muted/20',
    accent: 'border-l-slate-400/80',
  },
  in_progress: {
    icon: Clock,
    color: 'text-blue-400',
    glow: 'border-blue-400/25 bg-blue-500/[0.06]',
    accent: 'border-l-blue-400',
  },
  submitted: {
    icon: AlertCircle,
    color: 'text-amber-400',
    glow: 'border-amber-400/25 bg-amber-500/[0.06]',
    accent: 'border-l-amber-400',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    glow: 'border-emerald-400/25 bg-emerald-500/[0.06]',
    accent: 'border-l-emerald-400',
  },
}

/** Short line under each column title — helps first-time users */
const COLUMN_HINT: Record<TaskStatus, string> = {
  todo: 'Ready to start or claim',
  in_progress: 'You’re working on these',
  submitted: 'Waiting for review',
  completed: 'Done & credited',
}

function TaskCard({
  task,
  status,
  onSubmit,
  onStart,
  onReassign,
  onView,
  onClaim,
  onRequestAssignment,
  currentUserId,
  requestingId,
  isManager,
  team,
}: {
  task: any
  status: TaskStatus
  onSubmit: (task: any) => void
  onStart: (task: any) => void
  onReassign: (task: any) => void
  onView?: (task: any) => void
  onClaim?: (task: any) => void
  onRequestAssignment?: (task: any) => void
  currentUserId?: string
  requestingId?: string | null
  isManager?: boolean
  team: any[]
}) {
  const assignee = task.assignedTo
  const isPool = task.status === 'todo' && !task.assignedTo
  const currentAssigneeId = assignee?._id ?? task.assignedTo
  const othersCount = team.filter((m) => m._id !== currentAssigneeId).length
  const canReassign =
    !isPool && (task.status === 'todo' || task.status === 'in_progress') && othersCount > 0
  const accent = COLUMN_META[status].accent
  const pendingMine = isPool && userHasPendingAssignment(task, currentUserId)

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm transition-all duration-200',
        'border-l-[3px] hover:border-border hover:shadow-md hover:shadow-primary/5',
        accent,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/[0.04] blur-2xl opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight text-foreground">{task.title}</h4>
          <StatusBadge value={task.priority} type="priority" />
        </div>
        {task.description?.trim() ? (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{task.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={task.category} type="category" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span>
              {task.deadline
                ? new Date(task.deadline).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'No deadline'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-primary">
            <Zap className="size-3 opacity-80" aria-hidden />
            {task.points} pts
          </span>
        </div>
        {isPool ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-2 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
            <span className="font-medium">Open pool</span> —{' '}
            {isManager
              ? 'Claim to assign it to yourself.'
              : 'Request assignment; an admin or lead will approve.'}
          </div>
        ) : (
          assignee && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AvatarCircle initials={assignee.name?.slice(0, 2) ?? '?'} size="sm" />
              <span className="truncate">{assignee.name}</span>
            </div>
          )
        )}
        <Separator className="bg-border/60" />
        <div className="flex flex-col gap-2">
          {task.status === 'todo' && isPool && isManager && onClaim && (
            <Button
              size="sm"
              className="h-9 w-full gap-1.5 text-xs shadow-sm bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 border border-amber-500/35 dark:text-amber-100"
              onClick={() => onClaim(task)}
            >
              <UserPlus className="size-3.5" /> Claim task
            </Button>
          )}
          {task.status === 'todo' && isPool && !isManager && onRequestAssignment && (
            <>
              {pendingMine ? (
                <p className="rounded-lg border border-primary/25 bg-primary/10 py-2 text-center text-[11px] font-medium text-primary">
                  Awaiting admin approval
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 w-full gap-1.5 text-xs border border-amber-500/35"
                  disabled={requestingId === task._id}
                  onClick={() => onRequestAssignment(task)}
                >
                  <UserPlus className="size-3.5" />{' '}
                  {requestingId === task._id ? 'Sending…' : 'Request assignment'}
                </Button>
              )}
            </>
          )}
          {task.status === 'todo' && !isPool && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-full gap-1.5 text-xs border-blue-400/35 text-blue-600 hover:bg-blue-500/10 dark:text-blue-300"
              onClick={() => onStart(task)}
            >
              <Play className="size-3.5" /> Start
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button
              size="sm"
              className="h-9 w-full gap-1.5 text-xs shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => onSubmit(task)}
            >
              <Send className="size-3.5" /> Submit work
            </Button>
          )}
          {task.status === 'submitted' && (
            <p className="py-1.5 text-center text-xs text-amber-600 dark:text-amber-400">In review — you’ll get points when it’s approved.</p>
          )}
          {task.status === 'completed' && task.submission && (
            <div className="flex flex-wrap gap-3 pt-0.5">
              {task.submission.githubLink && (
                <a
                  href={task.submission.githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Github className="size-3.5" /> GitHub
                </a>
              )}
              {task.submission.notionLink && (
                <a
                  href={task.submission.notionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <LinkIcon className="size-3.5" /> Notion
                </a>
              )}
            </div>
          )}
          {canReassign && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onReassign(task)}
            >
              <UserPlus className="size-3.5" /> Reassign
            </Button>
          )}
          {onView && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 w-full gap-1.5 text-xs border border-border/60 bg-background/80"
              onClick={() => onView(task)}
            >
              <MessageSquare className="size-3.5" /> Details & comments
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

function BoardTabSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-36 w-full max-w-2xl rounded-2xl" />
      <Skeleton className="h-36 w-full max-w-2xl rounded-2xl" />
    </div>
  )
}

export default function TasksPage() {
  const { currentUser } = useApp()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<any[]>([])
  const [submitTarget, setSubmitTarget] = useState<any | null>(null)
  const [reassignTarget, setReassignTarget] = useState<any | null>(null)
  const [viewTask, setViewTask] = useState<any | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [submission, setSubmission] = useState({ githubLink: '', notionLink: '', googleDoc: '', comments: '' })
  const [boardTab, setBoardTab] = useState<TaskStatus>('todo')
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const boardTabInitRef = useRef(false)
  const isManager = currentUser?.role === 'admin' || currentUser?.role === 'lead'

  useEffect(() => {
    setLoading(true)
    apiFetch<any[]>('/dashboard/tasks')
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [currentUser?.id])

  useEffect(() => {
    apiFetch<any[]>('/dashboard/team')
      .then(setTeam)
      .catch(() => setTeam([]))
  }, [])

  const myTasks = tasks

  const columns = useMemo(
    () =>
      COLUMN_ORDER.reduce<Record<TaskStatus, any[]>>((acc, status) => {
        acc[status] = myTasks.filter((t) => t.status === status)
        return acc
      }, { todo: [], in_progress: [], submitted: [], completed: [] }),
    [myTasks],
  )

  const totalCount = myTasks.length
  const inProgressCount = columns.in_progress.length
  const queuedCount = columns.todo.filter((t) => t.assignedTo).length
  const inReviewCount = columns.submitted.length
  const doneCount = columns.completed.length

  /** On first load, open the first tab that has tasks (e.g. skip empty To Do when only Completed has items). */
  useEffect(() => {
    if (loading || boardTabInitRef.current) return
    boardTabInitRef.current = true
    const firstWithTasks = COLUMN_ORDER.find((s) => columns[s].length > 0)
    if (firstWithTasks) setBoardTab(firstWithTasks)
    // Intentionally when `loading` flips false only — `columns` comes from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const pageTitle = currentUser?.role === 'admin' ? 'All tasks' : 'My tasks'
  const firstName = currentUser?.name?.split(' ')[0] ?? 'there'

  function handleStart(task: any) {
    apiFetch<any>(`/dashboard/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' }),
    }).catch(() => {})
    setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: 'in_progress' } : t))
  }

  function handleSubmit() {
    if (!submitTarget) return
    apiFetch<any>(`/dashboard/tasks/${submitTarget._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'submitted',
        submission: {
          ...submission,
          submittedAt: new Date().toISOString(),
        },
      }),
    }).catch(() => {})
    setTasks((prev) =>
      prev.map((t) =>
        t._id === submitTarget._id
          ? {
              ...t,
              status: 'submitted',
              submission: { ...submission, submittedAt: new Date().toISOString() },
            }
          : t,
      ),
    )
    setSubmitTarget(null)
    setSubmission({ githubLink: '', notionLink: '', googleDoc: '', comments: '' })
  }

  function handleReassign() {
    if (!reassignTarget || !reassignTo) return
    apiFetch<any>(`/dashboard/tasks/${reassignTarget._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo: reassignTo }),
    })
      .then(() => {
        setTasks((prev) => prev.filter((t) => t._id !== reassignTarget._id))
        setReassignTarget(null)
        setReassignTo('')
      })
      .catch(() => {})
  }

  function handleClaim(task: any) {
    apiFetch<any>(`/dashboard/tasks/${task._id}/claim`, { method: 'POST' })
      .then((updated) => {
        setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)))
      })
      .catch(() => {})
  }

  function handleRequestAssignment(task: any) {
    setRequestingId(task._id)
    apiFetch<any>(`/dashboard/tasks/${task._id}/request-assignment`, { method: 'POST' })
      .then((updated) => {
        setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)))
      })
      .catch(() => undefined)
      .finally(() => setRequestingId(null))
  }

  const showSelfSubmitCta =
    !!currentUser &&
    currentUser.role !== 'admin' &&
    currentUser.role !== 'lead' &&
    currentUser.role !== 'accounts' &&
    currentUser.role !== 'evangelist'

  return (
    <div className="flex min-h-full flex-col">
      <DashboardTopbar title={currentUser?.role === 'admin' ? 'All tasks' : 'My tasks'} />

      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/[0.07] to-transparent" />
        <div className="relative mx-auto max-w-[1700px] px-4 pb-10 pt-1 sm:px-6 lg:px-8">
          {/* Intro */}
          <section className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card/95 via-card/70 to-primary/[0.04] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Task board
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {pageTitle}
                  {currentUser?.role !== 'admin' && (
                    <span className="font-normal text-muted-foreground"> — hi {firstName}</span>
                  )}
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {currentUser?.role === 'admin'
                    ? 'Every task in the program, organized by status. Open a card for comments and details.'
                    : 'Everything assigned to you and open pool tasks — request assignment for pool work (admin approves), then start, submit, and track review in the tabs.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-xs backdrop-blur-sm">
                  <LayoutGrid className="size-4 text-muted-foreground" aria-hidden />
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums text-foreground">{loading ? '—' : totalCount}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2 text-xs">
                  <Clock className="size-4 text-blue-400" aria-hidden />
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-semibold tabular-nums text-blue-400">{loading ? '—' : inProgressCount}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs">
                  <AlertCircle className="size-4 text-amber-400" aria-hidden />
                  <span className="text-muted-foreground">In review</span>
                  <span className="font-semibold tabular-nums text-amber-500">{loading ? '—' : inReviewCount}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs">
                  <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
                  <span className="text-muted-foreground">Done</span>
                  <span className="font-semibold tabular-nums text-emerald-500">{loading ? '—' : doneCount}</span>
                </div>
              </div>
            </div>
          </section>

          {showSelfSubmitCta && (
            <section className="mb-6 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Send className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Self-submit contribution</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Did useful work that wasn&apos;t a formal task? Send it here so leads can review and award points.
                    </p>
                  </div>
                </div>
                <Link href="/dashboard/submit-task" className="shrink-0">
                  <Button variant="secondary" className="w-full gap-2 border border-primary/20 bg-background sm:w-auto">
                    Open form
                    <ChevronRight className="size-4 opacity-70" />
                  </Button>
                </Link>
              </div>
            </section>
          )}

          {/* Board — tabbed by workflow stage */}
          <section aria-label="Task board by status">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <LayoutGrid className="size-4 text-primary" aria-hidden />
                  Board
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {queuedCount > 0 && (
                    <span className="mr-2 inline-block rounded-md bg-muted/80 px-2 py-0.5 font-medium text-foreground/90">
                      {queuedCount} queued to start
                    </span>
                  )}
                  Use the tabs to move through your workflow: backlog → doing → review → done.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                Dashboard
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            {loading ? (
              <BoardTabSkeleton />
            ) : (
              <Tabs
                value={boardTab}
                onValueChange={(v) => setBoardTab(v as TaskStatus)}
                className="w-full gap-0"
              >
                <div className="relative -mx-1 overflow-x-auto px-1 pb-2 [scrollbar-gutter:stable]">
                  <TabsList className="inline-flex h-auto min-h-11 w-max max-w-full flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/50 p-1.5 sm:w-full sm:justify-between">
                    {COLUMN_ORDER.map((status) => {
                      const meta = COLUMN_META[status]
                      const n = columns[status].length
                      return (
                        <TabsTrigger
                          key={status}
                          value={status}
                          className={cn(
                            'shrink-0 gap-1.5 rounded-lg px-2.5 py-2 text-xs sm:flex-1 sm:px-3 sm:text-sm',
                            'data-[state=active]:shadow-sm',
                          )}
                        >
                          <meta.icon className={cn('size-3.5 shrink-0 sm:size-4', meta.color)} />
                          <span className="max-w-[5.5rem] truncate sm:max-w-none">{STATUS_LABELS[status]}</span>
                          <span
                            className={cn(
                              'ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:text-[11px]',
                              n > 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {n}
                          </span>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </div>

                {COLUMN_ORDER.map((status) => {
                  const meta = COLUMN_META[status]
                  const col = columns[status]
                  return (
                    <TabsContent key={status} value={status} className="mt-4">
                      <div
                        className={cn(
                          'mb-4 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-sm sm:px-5',
                          meta.glow,
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/80">
                            <meta.icon className={cn('size-4', meta.color)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold leading-tight">{STATUS_LABELS[status]}</span>
                              <span className="inline-flex items-center rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                {col.length} {col.length === 1 ? 'task' : 'tasks'}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-foreground/90">{COLUMN_HINT[status]}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mx-auto flex max-w-2xl flex-col gap-3">
                        {col.map((task) => (
                          <TaskCard
                            key={task._id}
                            task={task}
                            status={status}
                            onSubmit={setSubmitTarget}
                            onStart={handleStart}
                            onReassign={setReassignTarget}
                            onView={setViewTask}
                            onClaim={isManager ? handleClaim : undefined}
                            onRequestAssignment={!isManager ? handleRequestAssignment : undefined}
                            currentUserId={currentUser?.id}
                            requestingId={requestingId}
                            isManager={isManager}
                            team={team}
                          />
                        ))}
                        {col.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-border/50 bg-muted/15 px-4 py-12 text-center">
                            <Inbox className="mx-auto size-10 text-muted-foreground/35" aria-hidden />
                            <p className="mt-4 text-sm font-medium text-foreground/80">
                              {status === 'todo' && currentUser?.role !== 'admin' && myTasks.length === 0
                                ? 'Nothing here yet'
                                : 'No tasks in this stage'}
                            </p>
                            <p className="mt-2 max-w-sm mx-auto text-xs leading-relaxed text-muted-foreground">
                              {status === 'todo' && currentUser?.role !== 'admin' && myTasks.length === 0
                                ? 'When a lead assigns work—or posts to the open pool—it will appear in To do.'
                                : status === 'completed'
                                  ? 'Finished tasks show up here with your submission links.'
                                  : 'Tasks move here as you update their status.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  )
                })}
              </Tabs>
            )}
          </section>
        </div>
      </div>

      {/* Submit Work Dialog */}
      <Dialog open={!!submitTarget} onOpenChange={(o) => !o && setSubmitTarget(null)}>
        <DialogContent className="max-w-md border-border bg-card shadow-xl p-0 overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-gradient-to-br from-muted/40 to-muted/10">
            <DialogHeader>
              <DialogTitle className="text-lg">Submit work for review</DialogTitle>
              <p className="text-sm font-medium leading-snug text-foreground/90">{submitTarget?.title}</p>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-2">Add links to your output — reviewers use these to verify and approve.</p>
            <div className="flex items-center gap-3 mt-3">
              <StatusBadge value={submitTarget?.category} type="category" />
              <span className="text-sm font-mono text-primary font-semibold">{submitTarget?.points} pts</span>
              <span className="text-xs text-muted-foreground">
                {submitTarget && getContributionLabel(submitTarget.category, submitTarget.contributionType)}
              </span>
            </div>
          </div>
          <div className="space-y-3 py-4 px-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Github className="size-3" /> GitHub Link
              </label>
              <Input placeholder="https://github.com/..." value={submission.githubLink}
                onChange={(e) => setSubmission((s) => ({ ...s, githubLink: e.target.value }))}
                className="bg-input border-border/60 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <LinkIcon className="size-3" /> Notion Link
              </label>
              <Input placeholder="https://notion.so/..." value={submission.notionLink}
                onChange={(e) => setSubmission((s) => ({ ...s, notionLink: e.target.value }))}
                className="bg-input border-border/60 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="size-3" /> Google Doc Link
              </label>
              <Input placeholder="https://docs.google.com/..." value={submission.googleDoc}
                onChange={(e) => setSubmission((s) => ({ ...s, googleDoc: e.target.value }))}
                className="bg-input border-border/60 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Comments</label>
              <Textarea placeholder="Add any notes for the reviewer..." value={submission.comments}
                onChange={(e) => setSubmission((s) => ({ ...s, comments: e.target.value }))}
                className="bg-input border-border/60 text-sm min-h-20 resize-none" />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-0">
            <Button variant="ghost" onClick={() => setSubmitTarget(null)}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-primary text-primary-foreground gap-1.5">
              <Send className="size-3.5" /> Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task & Comments Dialog */}
      <Dialog open={!!viewTask} onOpenChange={(o) => !o && setViewTask(null)}>
        <DialogContent className="max-w-lg border-border bg-card shadow-xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
          {/* Keep header visible so the close button never scrolls out of view */}
          <div className="px-6 pt-6 pb-3 border-b border-border/50">
            <DialogHeader>
              <DialogTitle>{viewTask?.title}</DialogTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">{viewTask?.description}</p>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={viewTask?.category} type="category" />
              <StatusBadge value={viewTask?.status} type="status" />
              <span className="text-sm font-mono text-primary font-semibold">{viewTask?.points} pts</span>
            </div>

            {viewTask?.submission && (
              <div className="rounded-lg border border-border/50 p-3 text-xs space-y-1">
                <div className="font-semibold">Submission</div>
                {viewTask.submission.githubLink && (
                  <a
                    href={viewTask.submission.githubLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline block truncate"
                  >
                    {viewTask.submission.githubLink}
                  </a>
                )}
                {viewTask.submission.notionLink && (
                  <a
                    href={viewTask.submission.notionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline block truncate"
                  >
                    {viewTask.submission.notionLink}
                  </a>
                )}
                {viewTask.submission.comments && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{viewTask.submission.comments}</p>
                )}
              </div>
            )}

            <div className="border-t border-border/50 pt-4">
              <TaskComments taskId={viewTask?._id} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={(o) => !o && setReassignTarget(null)}>
        <DialogContent className="max-w-sm border-border bg-card">
          <DialogHeader>
            <DialogTitle>Assign to someone else</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {reassignTarget?.title}
            </p>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to</label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select a team member..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {team
                    .filter((m) => {
                      const currentId = reassignTarget?.assignedTo?._id ?? reassignTarget?.assignedTo
                      return m._id !== currentId
                    })
                    .map((m) => (
                      <SelectItem key={m._id} value={m._id} className="py-2">
                        <div className="flex items-center gap-2">
                          <AvatarCircle initials={m.name?.slice(0, 2) || '?'} size="sm" />
                          <span>{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassignTarget(null)}>Cancel</Button>
            <Button onClick={handleReassign} disabled={!reassignTo} className="gap-1.5">
              <UserPlus className="size-3.5" /> Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
