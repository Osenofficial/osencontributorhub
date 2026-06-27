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
  Clock,
  Trash2,
  Check,
} from 'lucide-react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch } from '@/lib/api'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'
import { DashboardPageShell, PageCard } from '@/components/dashboard-page-shell'
import { toIsoLocalDate } from '@/lib/date-utils'

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

function isSelfSubmittedTask(task: any): boolean {
  const history = Array.isArray(task?.history) ? task.history : []
  if (history.some((h: any) => h.action === 'self_submitted' || h.meta?.selfContribution)) return true
  const cid = task?.createdBy?._id ?? task?.createdBy
  const aid = task?.assignedTo?._id ?? task?.assignedTo
  return Boolean(cid && aid && String(cid) === String(aid))
}

function getSubmissionWorkLink(submission: unknown): string {
  if (!submission || typeof submission !== 'object') return ''
  const s = submission as { githubLink?: string; notionLink?: string; googleDoc?: string }
  return (
    (typeof s.githubLink === 'string' && s.githubLink.trim()) ||
    (typeof s.notionLink === 'string' && s.notionLink.trim()) ||
    (typeof s.googleDoc === 'string' && s.googleDoc.trim()) ||
    ''
  )
}

function submissionPayloadFromDraft(draft: { workLink: string; workBrief: string }) {
  return {
    githubLink: draft.workLink.trim(),
    notionLink: '',
    googleDoc: '',
    comments: draft.workBrief.trim(),
  }
}

const TASK_PROGRESS_STEPS = [
  { key: 'start', label: 'Start' },
  { key: 'work', label: 'Work' },
  { key: 'submit', label: 'Submit' },
  { key: 'approved', label: 'Approved' },
] as const

function taskProgressIndex(status: string): number {
  if (status === 'todo') return 0
  if (status === 'in_progress' || status === 'rejected') return 1
  if (status === 'submitted') return 2
  if (status === 'completed') return 3
  return 0
}

function MyTaskStatusTag({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    todo: {
      label: 'Assigned',
      className: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    },
    in_progress: {
      label: 'In progress',
      className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    },
    submitted: {
      label: 'Lead pending review',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    },
    rejected: {
      label: 'Rejected',
      className: 'border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-300',
    },
    completed: {
      label: 'Completed',
      className: 'border-green-400/30 bg-green-400/10 text-green-600 dark:text-green-300',
    },
  }
  const item = config[status] ?? {
    label: status.replace(/_/g, ' '),
    className: 'border-border bg-muted/50 text-muted-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        item.className,
      )}
    >
      {item.label}
    </span>
  )
}

function TaskProgressStepper({ status, compact }: { status: string; compact?: boolean }) {
  const activeIndex = taskProgressIndex(status)
  if (compact) {
    return (
      <div className="mt-3 w-full max-w-sm" aria-label="Task progress">
        <div className="flex gap-1">
          {TASK_PROGRESS_STEPS.map((step, i) => (
            <div
              key={step.key}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= activeIndex ? 'bg-primary' : 'bg-muted',
                i < activeIndex && 'bg-green-500',
              )}
              title={step.label}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
          {TASK_PROGRESS_STEPS.map((step, i) => (
            <span
              key={step.key}
              className={cn(
                i === activeIndex && 'font-semibold text-primary',
                i < activeIndex && 'text-green-600 dark:text-green-400',
              )}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="Task progress">
      {TASK_PROGRESS_STEPS.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-muted-foreground/50">→</span>}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                done && 'bg-green-500/15 text-green-700 dark:text-green-300',
                active && !done && 'bg-primary/15 text-primary',
                !done && !active && 'bg-muted/50 text-muted-foreground',
              )}
            >
              {done ? <Check className="size-2.5" /> : null}
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

type WithdrawConfirm =
  | null
  | { taskId: string; mode: 'delete' | 'withdraw'; title: string; points: number }

export type MyTasksTab = 'active' | 'submitted' | 'completed' | 'all'

const MY_TASKS_TAB_TRIGGER =
  'gap-1.5 text-xs font-medium sm:text-sm text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/30 data-[state=active]:[&_.tab-count]:bg-primary-foreground/20 data-[state=active]:[&_.tab-count]:text-primary-foreground'

export type AllTasksViewProps = {
  pageTitle?: string
  pageDescription?: string
  defaultFilter?: string
  lockFilter?: boolean
  hideBackLink?: boolean
  initialTaskId?: string | null
  defaultMyTasksTab?: MyTasksTab
}

export function AllTasksView({
  pageTitle = 'All tasks',
  pageDescription = 'Browse the full program task list — open pool tasks, assignments, and submissions.',
  defaultFilter = 'all',
  lockFilter = false,
  hideBackLink = false,
  initialTaskId = null,
  defaultMyTasksTab = 'active',
}: AllTasksViewProps = {}) {
  const { currentUser } = useApp()
  const [taskFeed, setTaskFeed] = useState<any[]>([])
  const [taskFeedFilter, setTaskFeedFilter] = useState<string>(defaultFilter)
  const [myTasksTab, setMyTasksTab] = useState<MyTasksTab>(defaultMyTasksTab)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [viewTask, setViewTask] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [submissionDraft, setSubmissionDraft] = useState({ workBrief: '', workLink: '' })
  const [submissionSaving, setSubmissionSaving] = useState(false)
  const [submissionJustSent, setSubmissionJustSent] = useState<'submit' | 'resubmit' | null>(null)
  /** Eye = read-only modal; Pencil = editable (submission / start task). */
  const [taskDetailMode, setTaskDetailMode] = useState<'view' | 'edit' | null>(null)
  /** When set, dialog scrolls to assignee edit/start section after open (pencil on card). */
  const [scrollAssigneeSectionTaskId, setScrollAssigneeSectionTaskId] = useState<string | null>(null)
  const assigneeActionsRef = useRef<HTMLDivElement>(null)
  const [withdrawConfirm, setWithdrawConfirm] = useState<WithdrawConfirm>(null)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [openedInitialTaskId, setOpenedInitialTaskId] = useState<string | null>(null)

  const isAdminUser = currentUser?.role === 'admin'
  const canSeeStaffThread =
    currentUser?.role === 'admin' || currentUser?.role === 'lead'

  function closeTaskDialog() {
    setViewTask(null)
    setTaskDetailMode(null)
    setScrollAssigneeSectionTaskId(null)
    setSubmissionJustSent(null)
  }

  function showSubmitSuccessScreen(wasResubmit: boolean) {
    setSubmissionJustSent(wasResubmit ? 'resubmit' : 'submit')
    setTaskDetailMode('view')
    if (lockFilter) setMyTasksTab('submitted')
  }

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
      workBrief: typeof s.comments === 'string' ? s.comments : '',
      workLink: getSubmissionWorkLink(s),
    })
  }, [viewTask])

  useEffect(() => {
    if (!initialTaskId || loading || openedInitialTaskId === initialTaskId) return
    const task = taskFeed.find((t) => String(t._id ?? t.id) === String(initialTaskId))
    if (!task) return
    const assigneeId = task.assignedTo?._id ?? task.assignedTo
    const mine =
      Boolean(currentUser?.id && assigneeId != null && String(assigneeId) === String(currentUser.id))
    if (!mine) return
    const tid = String(task._id ?? task.id)
    const editable =
      task.status === 'todo' || task.status === 'in_progress' || task.status === 'rejected'
    setMyTasksTab(
      task.status === 'completed' ? 'completed' : task.status === 'submitted' ? 'submitted' : 'active',
    )
    setViewTask(task)
    setTaskDetailMode(editable ? 'edit' : 'view')
    if (editable) setScrollAssigneeSectionTaskId(tid)
    setOpenedInitialTaskId(initialTaskId)
  }, [initialTaskId, loading, taskFeed, currentUser?.id, openedInitialTaskId])

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

  const myAssignedTasks = useMemo(() => {
    const uid = currentUser?.id
    if (!uid) return []
    return taskFeed.filter((task: any) => {
      const aid = task.assignedTo?._id ?? task.assignedTo
      return aid != null && String(aid) === String(uid)
    })
  }, [taskFeed, currentUser?.id])

  const myTasksTabCounts = useMemo(
    () => ({
      active: myAssignedTasks.filter((t) => ['todo', 'in_progress', 'rejected'].includes(t.status)).length,
      submitted: myAssignedTasks.filter((t) => t.status === 'submitted').length,
      completed: myAssignedTasks.filter((t) => t.status === 'completed').length,
      all: myAssignedTasks.length,
    }),
    [myAssignedTasks],
  )

  const myActiveTasks = useMemo(
    () => myAssignedTasks.filter((t) => ['todo', 'in_progress', 'rejected'].includes(t.status)),
    [myAssignedTasks],
  )

  const mySubmittedTasks = useMemo(
    () => myAssignedTasks.filter((t) => t.status === 'submitted'),
    [myAssignedTasks],
  )

  const myCompletedTasks = useMemo(
    () => myAssignedTasks.filter((t) => t.status === 'completed'),
    [myAssignedTasks],
  )

  const filteredTaskFeed = useMemo(() => {
    const uid = currentUser?.id
    return taskFeed.filter((task: any) => {
      const aid = task.assignedTo?._id ?? task.assignedTo
      const assigneeStr = aid != null ? String(aid) : ''
      const mine = uid != null && assigneeStr === String(uid)

      if (lockFilter && !mine) return false

      const effectiveFilter = taskFeedFilter

      if (effectiveFilter !== 'all') {
        const isPool = task.status === 'todo' && !task.assignedTo

        let statusOk = true
        switch (effectiveFilter) {
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

      if (!lockFilter && (dateFrom || dateTo)) {
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
  }, [taskFeed, taskFeedFilter, currentUser?.id, dateFrom, dateTo, lockFilter])

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
    body: { status?: string; submission?: ReturnType<typeof submissionPayloadFromDraft> },
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
      let current = viewTask
      const submission = submissionPayloadFromDraft(submissionDraft)
      if (current.status === 'todo') {
        current = await patchMyTask(String(id), {
          status: 'in_progress',
          submission,
        })
        setViewTask(current)
      }
      const payload: { status?: string; submission: ReturnType<typeof submissionPayloadFromDraft> } = {
        submission,
      }
      if (
        options?.alsoSubmit &&
        (current.status === 'in_progress' || current.status === 'rejected')
      ) {
        payload.status = 'submitted'
      }
      const updated = await patchMyTask(String(id), payload)
      setViewTask(updated)
      refreshFeed()
      if (options?.alsoSubmit && updated.status === 'submitted') {
        showSubmitSuccessScreen(viewTask.status === 'rejected')
      }
    } catch {
      /* toast optional */
    } finally {
      setSubmissionSaving(false)
    }
  }

  async function executeWithdrawConfirm() {
    if (!withdrawConfirm) return
    setWithdrawLoading(true)
    try {
      const activeViewTaskId = viewTask?._id ?? viewTask?.id
      const isActiveViewTask =
        activeViewTaskId != null && String(activeViewTaskId) === String(withdrawConfirm.taskId)
      if (withdrawConfirm.mode === 'delete') {
        await apiFetch(`/dashboard/tasks/${withdrawConfirm.taskId}`, { method: 'DELETE' })
        if (isActiveViewTask) {
          setViewTask(null)
          setTaskDetailMode(null)
        }
      } else {
        const updated = await apiFetch<any>(
          `/dashboard/tasks/${withdrawConfirm.taskId}/withdraw-submission`,
          { method: 'POST' },
        )
        if (isActiveViewTask) {
          setViewTask(updated)
        }
      }
      refreshFeed()
      setWithdrawConfirm(null)
    } catch {
      /* keep dialog open */
    } finally {
      setWithdrawLoading(false)
    }
  }

  function openTaskForAssignee(task: any, mode: 'view' | 'edit') {
    const tid = String(task._id ?? task.id)
    setViewTask(task)
    setTaskDetailMode(mode)
    if (mode === 'edit') setScrollAssigneeSectionTaskId(tid)
  }

  function renderMyTaskCard(task: any) {
    const tid = task._id ?? task.id
    const createdBy = task.createdBy
    const assignee = task.assignedTo
    const isPool = task.status === 'todo' && !task.assignedTo
    const assigneeId = assignee?._id ?? assignee
    const taskAssignedToMe =
      Boolean(currentUser?.id && assigneeId != null && String(assigneeId) === String(currentUser.id))
    const showCardEditPencil = taskAssignedToMe && !isPool && task.status !== 'completed'
    const canCardUndoSubmission =
      taskAssignedToMe &&
      task.status !== 'completed' &&
      (task.status === 'submitted' || (task.status === 'rejected' && isSelfSubmittedTask(task)))
    const cardUndoSubmissionMode: 'delete' | 'withdraw' | null =
      canCardUndoSubmission && task.status === 'submitted' && !isSelfSubmittedTask(task)
        ? 'withdraw'
        : canCardUndoSubmission && isSelfSubmittedTask(task)
          ? 'delete'
          : null
    const dateStr = task.createdAt
      ? new Date(task.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
    const deadlineStr = task.deadline
      ? new Date(task.deadline).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null
    const isOverdue =
      task.deadline &&
      new Date(task.deadline).getTime() < Date.now() &&
      !['completed', 'submitted'].includes(task.status)
    const pointsLabel =
      task.overduePenaltyApplied && task.basePoints
        ? `${task.points} pts (−30%)`
        : `${task.points ?? 0} pts`
    const tidStr = String(tid)
    const canSubmitOnCard =
      taskAssignedToMe &&
      !isPool &&
      ['todo', 'in_progress', 'rejected'].includes(task.status)
    const submitLabel = task.status === 'rejected' ? 'Resubmit' : 'Submit'

    return (
      <Card
        key={tid}
        className={cn(
          'flex h-full flex-col gap-0 overflow-hidden border py-0 shadow-sm transition-all hover:border-primary/30 hover:shadow-md',
          isOverdue ? 'border-destructive/40 bg-destructive/[0.03]' : 'border-border/70 bg-card/80',
        )}
      >
        <CardHeader className="space-y-3 border-b border-border/40 bg-muted/15 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-left text-base font-semibold leading-snug tracking-tight">
              {task.title}
            </CardTitle>
            <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
              {pointsLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge value={task.category} type="category" />
            {task.priority && <StatusBadge value={task.priority} type="priority" />}
            <MyTaskStatusTag status={task.status} />
            {task.contributorPeriod && (
              <span className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-200">
                {(task.contributorPeriod as { label?: string }).label ?? 'Cycle'}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid flex-1 gap-2 px-4 py-3 text-xs">
          <div className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-2 rounded-xl border border-border/35 bg-background/60 p-3">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium text-foreground">{createdBy?.name ?? '—'}</span>
            <span className="text-muted-foreground">Assignee</span>
            <span className="font-medium text-foreground">{assignee?.name ?? '—'}</span>
            {deadlineStr && (
              <>
                <span className="text-muted-foreground">Due</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-medium',
                    isOverdue ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  <Clock className="size-3 shrink-0" />
                  {deadlineStr}
                  {isOverdue && <span className="text-[10px] uppercase tracking-wide">(overdue)</span>}
                </span>
              </>
            )}
            <span className="text-muted-foreground">Created</span>
            <span className="text-foreground/90">{dateStr}</span>
          </div>
          {task.assignmentNote?.trim() && (
            <p className="line-clamp-2 rounded-md border border-violet-500/20 bg-violet-500/8 px-2.5 py-1.5 text-[11px] text-violet-900 dark:text-violet-100">
              {task.assignmentNote.trim()}
            </p>
          )}
        </CardContent>

        <CardFooter className="mt-auto flex flex-wrap gap-1.5 border-t border-border/50 bg-muted/10 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              setScrollAssigneeSectionTaskId(null)
              setTaskDetailMode('view')
              setViewTask(task)
            }}
          >
            <Eye className="size-3" />
            View
          </Button>
          {canSubmitOnCard && (
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => openTaskForAssignee(task, 'edit')}
            >
              <Send className="size-3" />
              {submitLabel}
            </Button>
          )}
          {showCardEditPencil && cardUndoSubmissionMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              onClick={() =>
                setWithdrawConfirm({
                  taskId: tidStr,
                  mode: cardUndoSubmissionMode,
                  title: task?.title ?? 'this task',
                  points: task?.points ?? 0,
                })
              }
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  function renderMyTasksList(tasks: any[], emptyMessage: string) {
    if (tasks.length === 0) {
      return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    }
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <div key={task._id ?? task.id} className="flex min-h-[260px]">
            {renderMyTaskCard(task)}
          </div>
        ))}
      </div>
    )
  }

  function renderMyTasksTabPanel(
    tasks: any[],
    emptyMessage: string,
    panel: {
      title: string
      description: string
      variant?: 'default' | 'submitted'
    },
  ) {
    const cardClass =
      panel.variant === 'submitted'
        ? 'surface-card flex max-h-[min(70vh,44rem)] flex-col overflow-hidden border-yellow-500/25 bg-yellow-500/[0.03]'
        : 'surface-card flex max-h-[min(70vh,44rem)] flex-col overflow-hidden'

    return (
      <div className={cardClass}>
        <div className="shrink-0 border-b border-border/50 px-5 py-3">
          {panel.variant === 'submitted' ? (
            <h3 className="flex items-center gap-2 font-semibold text-yellow-600 dark:text-yellow-400">
              <Eye className="size-4" />
              {panel.title}
            </h3>
          ) : (
            <h3 className="font-semibold">{panel.title}</h3>
          )}
          <p className="text-[11px] text-muted-foreground">{panel.description}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {renderMyTasksList(tasks, emptyMessage)}
        </div>
      </div>
    )
  }

  function renderTaskBox(task: any) {
    const tid = task._id ?? task.id
    const createdBy = task.createdBy
    const assignee = task.assignedTo
    const isPool = task.status === 'todo' && !task.assignedTo
    const canClaimPool = isPool && Boolean(currentUser?.id) && isAdminUser
    const canRequest =
      isPool && Boolean(currentUser?.id) && !isAdminUser && !userHasPendingAssignment(task, currentUser?.id)
    const pendingMine = isPool && userHasPendingAssignment(task, currentUser?.id)
    const assigneeId = assignee?._id ?? assignee
    const taskAssignedToMe =
      Boolean(currentUser?.id && assigneeId != null && String(assigneeId) === String(currentUser.id))
    const showCardEditPencil = taskAssignedToMe && !isPool && task.status !== 'completed'
    const canCardUndoSubmission =
      taskAssignedToMe &&
      task.status !== 'completed' &&
      (task.status === 'submitted' || (task.status === 'rejected' && isSelfSubmittedTask(task)))
    const cardUndoSubmissionMode: 'delete' | 'withdraw' | null =
      canCardUndoSubmission && task.status === 'submitted' && !isSelfSubmittedTask(task)
        ? 'withdraw'
        : canCardUndoSubmission && isSelfSubmittedTask(task)
          ? 'delete'
          : null
    const dateStr = task.createdAt
      ? new Date(task.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'
    const deadlineStr = task.deadline
      ? new Date(task.deadline).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null
    const isOverdue =
      task.deadline &&
      new Date(task.deadline).getTime() < Date.now() &&
      !['completed', 'submitted'].includes(task.status)
    const pointsLabel =
      task.overduePenaltyApplied && task.basePoints
        ? `${task.points} pts (−30%)`
        : `${task.points ?? 0} pts`

    return (
      <Card
        className={cn(
          'group flex h-full flex-col gap-0 overflow-hidden border py-0 shadow-sm transition-all hover:border-primary/30 hover:shadow-md',
          isPool
            ? 'border-amber-500/35 bg-gradient-to-b from-amber-500/[0.07] to-card'
            : isOverdue
              ? 'border-destructive/40 bg-destructive/[0.03]'
              : 'border-border/70 bg-card/80',
        )}
      >
        <CardHeader className="space-y-3 border-b border-border/40 bg-muted/15 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-left text-base font-semibold leading-snug tracking-tight">
              {task.title}
            </CardTitle>
            <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
              {pointsLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge value={task.category} type="category" />
            <StatusBadge value={task.priority} type="priority" />
            <StatusBadge value={task.status} type="status" />
            {task.contributorPeriod && (
              <span className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:text-violet-200">
                {(task.contributorPeriod as { label?: string }).label ?? 'Cycle'}
              </span>
            )}
            {isPool && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                <UserCircle className="size-3" />
                Pool
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid flex-1 gap-2 px-4 py-3 text-xs">
          <div className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-2 rounded-xl border border-border/35 bg-background/60 p-3">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium text-foreground">{createdBy?.name ?? '—'}</span>
            <span className="text-muted-foreground">{isPool ? 'Type' : 'Assignee'}</span>
            <span className={cn('font-medium', isPool ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
              {isPool ? 'Open pool' : assignee?.name ?? '—'}
            </span>
            {deadlineStr && (
              <>
                <span className="text-muted-foreground">Due</span>
                <span className={cn('inline-flex items-center gap-1 font-medium', isOverdue ? 'text-destructive' : 'text-foreground')}>
                  <Clock className="size-3 shrink-0" />
                  {deadlineStr}
                  {isOverdue && <span className="text-[10px] uppercase tracking-wide">(overdue)</span>}
                </span>
              </>
            )}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title="Edit submission / start task"
                    className="h-8 w-8 shrink-0 p-0 text-primary transition-colors hover:bg-primary/10 hover:text-primary"
                    onClick={() => openTaskForAssignee(task, 'edit')}
                  >
                    <Pencil className="size-3.5" />
                    <span className="sr-only">Edit task</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Edit task</TooltipContent>
              </Tooltip>
            )}
            {taskAssignedToMe &&
              !isPool &&
              ['todo', 'in_progress', 'rejected'].includes(task.status) && (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => openTaskForAssignee(task, 'edit')}
              >
                <Send className="size-3.5" />
                {task.status === 'rejected' ? 'Resubmit' : 'Submit'}
              </Button>
            )}
            {showCardEditPencil && cardUndoSubmissionMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title={cardUndoSubmissionMode === 'delete' ? 'Delete submission' : 'Withdraw submission'}
                    className="h-8 w-8 shrink-0 p-0 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      setWithdrawConfirm({
                        taskId: String(tid),
                        mode: cardUndoSubmissionMode,
                        title: task?.title ?? 'this task',
                        points: task?.points ?? 0,
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">
                      {cardUndoSubmissionMode === 'delete' ? 'Delete submission' : 'Withdraw submission'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  {cardUndoSubmissionMode === 'delete' ? 'Delete submission' : 'Withdraw submission'}
                </TooltipContent>
              </Tooltip>
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
    vtMine &&
    !vtPool &&
    (vt?.status === 'todo' || vt?.status === 'in_progress' || vt?.status === 'rejected')
  const latestRejectComment = getLatestRejectComment(vt)
  const dialogEditable = taskDetailMode === 'edit'
  const showAssigneeEditPanel = dialogEditable && canEditSubmission && !submissionJustSent
  const showReadOnlySubmission =
    Boolean(vt?.submission) &&
    (!dialogEditable || !canEditSubmission || vt?.status === 'submitted' || submissionJustSent)

  return (
    <DashboardPageShell
      title={pageTitle}
      description={
        lockFilter
          ? pageDescription ||
            'Everything assigned to you — start work, submit proof, and track review status.'
          : pageDescription
      }
      width="full"
    >
      <div className={cn('space-y-4', lockFilter && '-mt-1')}>
        {!hideBackLink && (
          <PageCard className="p-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </PageCard>
        )}

        {lockFilter ? (
          <>
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">Your assigned work</h2>
              <p className="text-sm text-muted-foreground">
                Tasks assigned to you — start, submit proof, and track review status.
              </p>
            </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : (
            <Tabs
              value={myTasksTab}
              onValueChange={(v) => setMyTasksTab(v as MyTasksTab)}
              className="w-full gap-4"
            >
              <TabsList className="grid h-auto min-h-11 w-full grid-cols-2 gap-1 border border-border/60 bg-muted/80 p-1 shadow-sm sm:max-w-3xl sm:grid-cols-4">
                <TabsTrigger value="active" className={MY_TASKS_TAB_TRIGGER}>
                  Assigned
                  {myTasksTabCounts.active > 0 && (
                    <span className="tab-count rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                      {myTasksTabCounts.active}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="submitted" className={MY_TASKS_TAB_TRIGGER}>
                  Submitted
                  {myTasksTabCounts.submitted > 0 && (
                    <span className="tab-count rounded-full bg-yellow-500/25 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-yellow-700 dark:text-yellow-300">
                      {myTasksTabCounts.submitted}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="completed" className={MY_TASKS_TAB_TRIGGER}>
                  Completed
                  {myTasksTabCounts.completed > 0 && (
                    <span className="tab-count rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-green-700 dark:text-green-300">
                      {myTasksTabCounts.completed}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className={MY_TASKS_TAB_TRIGGER}>
                  All
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-0">
                {renderMyTasksTabPanel(
                  myActiveTasks,
                  'No tasks need your action right now. Check All for open pool work.',
                  {
                    title: 'Assigned',
                    description: 'Tasks waiting for you to start or submit.',
                  },
                )}
              </TabsContent>

              <TabsContent value="submitted" className="mt-0">
                {renderMyTasksTabPanel(
                  mySubmittedTasks,
                  'Nothing in review yet. Submit work from the Assigned tab when ready.',
                  {
                    title: 'Submitted',
                    description: 'Waiting for your lead to review.',
                    variant: 'submitted',
                  },
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-0">
                {renderMyTasksTabPanel(
                  myCompletedTasks,
                  'No completed tasks yet — finish work and get it approved.',
                  {
                    title: 'Completed',
                    description: 'Approved and finished work.',
                  },
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-0">
                {renderMyTasksTabPanel(myAssignedTasks, 'No tasks assigned to you yet.', {
                  title: 'All tasks',
                  description:
                    'Everything assigned to you — start work, submit proof, and track review status.',
                })}
              </TabsContent>
            </Tabs>
          )}
          </>
        ) : (
        <PageCard className="overflow-hidden p-0" glow="primary">
              <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                    <ClipboardList className="size-6 text-primary" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" aria-hidden />
                      <h2 className="text-lg font-bold tracking-tight sm:text-xl">Program task list</h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      Open pool: use <strong className="font-medium text-foreground">Request</strong> (admin or lead
                      approves) or <strong className="font-medium text-foreground">Claim</strong> if you&apos;re an{' '}
                      <strong className="font-medium text-foreground">admin</strong>.
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
        </PageCard>
        )}
      </div>

      <Dialog
        open={!!viewTask}
        onOpenChange={(o) => {
          if (!o && submissionJustSent) return
          if (!o) closeTaskDialog()
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
            {submissionJustSent && vt?.status === 'submitted' && (
              <div className="rounded-xl border border-green-500/35 bg-green-500/10 px-4 py-4 text-center space-y-3">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-green-500/20">
                  <Check className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-green-800 dark:text-green-200">
                    {submissionJustSent === 'resubmit' ? 'Resubmitted!' : 'Submitted!'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Lead pending review — you&apos;ll get notified when it&apos;s approved or needs changes.
                  </p>
                </div>
                <Button type="button" size="sm" className="min-w-24" onClick={closeTaskDialog}>
                  Done
                </Button>
              </div>
            )}

            {!submissionJustSent && (
              <>
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
            {vt?.assignmentNote?.trim() && (
              <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs">
                <p className="font-semibold text-violet-900 dark:text-violet-100">Note from your lead</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground/90">{vt.assignmentNote.trim()}</p>
              </div>
            )}
            {vtMine && vt?.status && <TaskProgressStepper status={vt.status} />}
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

            {taskDetailMode === 'view' && vtMine && canEditSubmission && (
              <p className="flex items-start gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                <Pencil className="mt-0.5 size-3.5 shrink-0 text-primary/80" aria-hidden />
                <span>
                  This is a read-only view. Use <strong className="text-foreground/90">Submit</strong> on the task
                  card to add proof and send for review.
                </span>
              </p>
            )}

            {showAssigneeEditPanel && (
              <div ref={assigneeActionsRef} className="space-y-4 scroll-mt-6">
            {canEditSubmission && (
              <div className="rounded-lg border border-primary/25 bg-muted/20 p-3 space-y-3">
                {vt?.status === 'rejected' && latestRejectComment && (
                  <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground/90">Lead feedback</p>
                    <p className="mt-1 whitespace-pre-wrap">{latestRejectComment}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {vt?.status === 'rejected'
                    ? 'Update your brief and work link using the feedback above, then resubmit.'
                    : 'Briefly describe what you did, add your proof link, then submit for lead review.'}
                </p>
                <div className="space-y-1">
                  <Label htmlFor="work-brief" className="text-xs">
                    Describe your work in brief
                  </Label>
                  <Textarea
                    id="work-brief"
                    className="min-h-[72px] resize-none text-sm bg-background"
                    placeholder="What did you build or deliver? Keep it short."
                    value={submissionDraft.workBrief}
                    onChange={(e) =>
                      setSubmissionDraft((d) => ({ ...d, workBrief: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="work-link" className="text-xs">
                    Submit your work link
                  </Label>
                  <Input
                    id="work-link"
                    className="h-9 text-sm bg-background"
                    placeholder="GitHub PR, Notion page, Google Doc, demo URL…"
                    value={submissionDraft.workLink}
                    onChange={(e) =>
                      setSubmissionDraft((d) => ({ ...d, workLink: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(vt?.status === 'todo' ||
                    vt?.status === 'in_progress' ||
                    vt?.status === 'rejected') && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={
                        submissionSaving ||
                        !submissionDraft.workBrief.trim() ||
                        !submissionDraft.workLink.trim()
                      }
                      onClick={() => void handleSaveSubmission({ alsoSubmit: true })}
                    >
                      <Send className="size-3.5" />
                      {submissionSaving
                        ? 'Sending…'
                        : vt?.status === 'rejected'
                          ? 'Resubmit for review'
                          : 'Submit for review'}
                    </Button>
                  )}
                </div>
              </div>
            )}
              </div>
            )}

            {showReadOnlySubmission && (
              <div className="rounded-lg border border-border/50 p-3 text-xs space-y-2">
                {typeof vt.submission.comments === 'string' && vt.submission.comments.trim() && (
                  <div>
                    <div className="font-semibold">Brief</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                      {vt.submission.comments.trim()}
                    </p>
                  </div>
                )}
                <div>
                  <div className="font-semibold">Work link</div>
                  {getSubmissionWorkLink(vt.submission) ? (
                    <a
                      href={getSubmissionWorkLink(vt.submission)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-primary hover:underline"
                    >
                      {getSubmissionWorkLink(vt.submission)}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-muted-foreground">No link submitted yet.</p>
                  )}
                </div>
              </div>
            )}
            {latestRejectComment && vt?.status !== 'rejected' && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground/90">Feedback</p>
                <p className="mt-1 whitespace-pre-wrap">{latestRejectComment}</p>
              </div>
            )}
            <div className="border-t border-border/50 pt-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Task comments</p>
              <TaskComments taskId={vt?._id} />
            </div>
            {canSeeStaffThread && (vt?._id ?? vt?.id) ? (
              <div className="border-t border-border/50 pt-4">
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
                  <TaskComments taskId={String(vt._id ?? vt.id)} audience="staff" />
                </div>
              </div>
            ) : null}
            {vt && vtPool && currentUser?.id && (
              <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center">
                {isAdminUser ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={claimingId === vtId}
                    onClick={() => handleClaimTask(vtId, () => setViewTask(null))}
                  >
                    {claimingId === vtId ? 'Claiming…' : 'Claim this task'}
                  </Button>
                ) : userHasPendingAssignment(vt, currentUser.id) ? (
                  <p className="text-sm font-medium text-primary">Awaiting approval from admin or lead.</p>
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
                  {isAdminUser
                    ? 'Assign this pool task to yourself to start working.'
                    : 'An admin will approve or decline your request.'}
                </p>
              </div>
            )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!withdrawConfirm}
        onOpenChange={(open) => {
          if (!open) setWithdrawConfirm(null)
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {withdrawConfirm?.mode === 'delete' ? 'Delete this submission?' : 'Withdraw submission?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block">
                {withdrawConfirm?.mode === 'delete' ? (
                  <>
                    <strong className="text-foreground">&quot;{withdrawConfirm.title}&quot;</strong> will be
                    permanently removed from review.
                  </>
                ) : (
                  <>
                    Your submission for{' '}
                    <strong className="text-foreground">&quot;{withdrawConfirm?.title}&quot;</strong> will be pulled
                    back. You can edit and submit again.
                  </>
                )}
              </span>
              <span className="block text-destructive/90">
                No points ({withdrawConfirm?.points ?? 0} pts) have been awarded yet. If you remove this now, those
                points will not count unless you submit again and get approved.
              </span>
              <span className="block">This cannot be undone from the dashboard once confirmed.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={withdrawLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void executeWithdrawConfirm()
              }}
            >
              {withdrawLoading
                ? 'Working…'
                : withdrawConfirm?.mode === 'delete'
                  ? 'Yes, delete'
                  : 'Yes, withdraw'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPageShell>
  )
}

export default function AllTasksPage() {
  return <AllTasksView />
}
