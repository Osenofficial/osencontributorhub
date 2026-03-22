'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  CheckCircle2,
  Shield,
  Trash2,
  Eye,
  Users,
  ListChecks,
  Ban,
  Check,
  CalendarIcon,
  UserPlus,
  XCircle,
  Pencil,
} from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { StatusBadge } from '@/components/status-badge'
import { AvatarCircle } from '@/components/avatar-circle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useApp } from '@/lib/app-context'
import { TaskComments } from '@/components/task-comments'
import {
  Task,
  TaskCategory,
  Priority,
  PAYOUT_TIERS,
  MIN_POINTS_FOR_PAYOUT,
  MAX_PAYOUT_INR,
  MONTHLY_POINT_CAP,
} from '@/lib/data'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

type FormState = {
  title: string
  description: string
  contributionType: string
  category: TaskCategory
  points: string
  deadline: string
  assignedTo: string
  priority: Priority
}

const CONTRIBUTION_TYPES = [
  {
    group: 'Video Editing',
    items: [
      { id: 'video_reel', label: 'Reel editing', points: 5, category: 'development' as TaskCategory },
      { id: 'video_short', label: '1–5 min video', points: 10, category: 'development' as TaskCategory },
      { id: 'video_long', label: '5–10 min video', points: 15, category: 'development' as TaskCategory },
    ],
  },
  {
    group: 'Design',
    items: [
      { id: 'design_poster', label: 'Event poster', points: 6, category: 'design' as TaskCategory },
    ],
  },
  {
    group: 'Community',
    items: [
      {
        id: 'interview_taken_over5',
        label: 'Interviews taken (more than 5)',
        points: 10,
        category: 'community' as TaskCategory,
      },
      {
        id: 'interview_taken_over10',
        label: 'Interviews taken (more than 10)',
        points: 21,
        category: 'community' as TaskCategory,
      },
      {
        id: 'basic_community_work',
        label: 'Basic community work',
        points: 3,
        category: 'community' as TaskCategory,
      },
      {
        id: 'social_media_community',
        label: 'Social media',
        points: 3,
        category: 'community' as TaskCategory,
      },
    ],
  },
  {
    group: 'Community Program & Hackathon',
    items: [
      { id: 'program_manager', label: 'Programme manager', points: 15, category: 'community' as TaskCategory },
      { id: 'social_creatives', label: 'Social media creatives', points: 6, category: 'content' as TaskCategory },
      { id: 'promo_video', label: 'Promotional video editing', points: 10, category: 'development' as TaskCategory },
      { id: 'technical_speaker', label: 'Technical speaker', points: 7, category: 'community' as TaskCategory },
      { id: 'volunteer_coordination', label: 'Volunteer coordination', points: 7, category: 'community' as TaskCategory },
      { id: 'judge_mentor', label: 'Judge / Mentor', points: 10, category: 'community' as TaskCategory },
    ],
  },
  {
    group: 'Speaker Sessions',
    items: [
      { id: 'speaker_online_technical', label: 'Online technical session', points: 15, category: 'community' as TaskCategory },
      { id: 'speaker_intro_online', label: 'Online intro to OSEN', points: 7, category: 'community' as TaskCategory },
      { id: 'speaker_intro_offline', label: 'Offline intro to OSEN', points: 10, category: 'community' as TaskCategory },
      { id: 'speaker_offline_technical', label: 'Offline technical session', points: 20, category: 'community' as TaskCategory },
      { id: 'speaker_hackathon_mentor', label: 'Mentoring during hackathons', points: 15, category: 'community' as TaskCategory },
    ],
  },
  {
    group: 'Volunteer-Based',
    items: [
      { id: 'volunteer_engagement', label: 'Community engagement', points: 2, category: 'community' as TaskCategory },
      { id: 'volunteer_moderation', label: 'Group moderation / management', points: 3, category: 'community' as TaskCategory },
      { id: 'volunteer_formatting', label: 'Formatting groups / docs', points: 3, category: 'content' as TaskCategory },
      { id: 'volunteer_sponsor_support', label: 'Sponsor support', points: 6, category: 'community' as TaskCategory },
      { id: 'volunteer_updates', label: 'Event updates', points: 2, category: 'community' as TaskCategory },
      { id: 'volunteer_registrations', label: 'Registrations', points: 4, category: 'community' as TaskCategory },
      { id: 'volunteer_feedback', label: 'Feedback collection', points: 3, category: 'community' as TaskCategory },
    ],
  },
]

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  contributionType: '',
  category: 'development',
  points: '10',
  deadline: '',
  assignedTo: '__pool__',
  priority: 'medium',
}

function taskToFormState(task: any): FormState {
  const aid = task.assignedTo?._id ?? task.assignedTo
  const assignedTo = aid ? String(aid) : '__pool__'
  let deadline = ''
  if (task.deadline) {
    const d = new Date(task.deadline)
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      deadline = `${y}-${m}-${day}T${hh}:${mm}`
    }
  }
  return {
    title: task.title ?? '',
    description: task.description ?? '',
    contributionType: task.contributionType ?? '',
    category: (task.category as TaskCategory) ?? 'development',
    points: String(task.points ?? 10),
    deadline,
    assignedTo,
    priority: (task.priority as Priority) ?? 'medium',
  }
}

function isTaskCreator(task: any, userId: string | undefined) {
  if (!userId) return false
  const cb = task.createdBy?._id ?? task.createdBy
  return cb != null && String(cb) === String(userId)
}

/** Admins may edit/delete/approve any task; leads only on tasks they created (else they submit an approval request). */
function canActDirectOnTask(
  task: any | undefined,
  user: { id: string; role: string } | null | undefined,
) {
  if (!user || !task) return false
  if (user.role === 'admin') return true
  return isTaskCreator(task, user.id)
}

type AdminConfirm =
  | null
  | { kind: 'approve_submission'; taskId: string; title: string }
  | { kind: 'reject_submission'; taskId: string; title: string }
  | { kind: 'delete_task'; taskId: string; title: string }
  | {
      kind: 'approve_assignment'
      taskId: string
      userId: string
      title: string
      userName: string
    }
  | {
      kind: 'reject_assignment'
      taskId: string
      userId: string
      title: string
      userName: string
    }
  | { kind: 'approve_user'; userId: string; name: string }
  | { kind: 'reject_user'; userId: string; name: string }

function adminConfirmMeta(c: NonNullable<AdminConfirm>) {
  switch (c.kind) {
    case 'approve_submission':
      return {
        title: 'Approve this submission?',
        description: `Mark "${c.title}" as completed? The contributor will be notified.`,
        actionLabel: 'Yes, approve',
        destructive: false,
      }
    case 'reject_submission':
      return {
        title: 'Reject this submission?',
        description: `Send "${c.title}" back to in progress so the contributor can revise and resubmit. They will be notified.`,
        actionLabel: 'Yes, reject',
        destructive: true,
      }
    case 'delete_task':
      return {
        title: 'Delete this task?',
        description: `Permanently delete "${c.title}"? This cannot be undone.`,
        actionLabel: 'Yes, delete',
        destructive: true,
      }
    case 'approve_assignment':
      return {
        title: 'Assign this task?',
        description: `Approve ${c.userName} for "${c.title}"? They will be assigned and other requests cleared.`,
        actionLabel: 'Yes, assign',
        destructive: false,
      }
    case 'reject_assignment':
      return {
        title: 'Decline this request?',
        description: `Remove ${c.userName}'s request for "${c.title}"?`,
        actionLabel: 'Yes, decline',
        destructive: true,
      }
    case 'approve_user':
      return {
        title: 'Approve this account?',
        description: `Allow ${c.name} to log in and use the dashboard?`,
        actionLabel: 'Yes, approve',
        destructive: false,
      }
    case 'reject_user':
      return {
        title: 'Reject this signup?',
        description: `${c.name} will not be able to sign in with this account.`,
        actionLabel: 'Yes, reject',
        destructive: true,
      }
  }
}

export default function AdminPage() {
  const { currentUser } = useApp()
  if (!currentUser) return null
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState<'tasks' | 'users'>('tasks')
  const [taskForm, setTaskForm] = useState<{ mode: 'create' } | { mode: 'edit'; taskId: string } | null>(null)
  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [members, setMembers] = useState<any[]>([])
  const [stats, setStats] = useState<{ totalUsers: number; totalTasks: number; completedTasks: number } | null>(null)
  const [pendingAssignmentTasks, setPendingAssignmentTasks] = useState<any[]>([])
  const [leadActionRequests, setLeadActionRequests] = useState<any[]>([])
  const [confirm, setConfirm] = useState<AdminConfirm>(null)

  function formatDate(value: string | Date | undefined) {
    if (!value) return '—'
    const d = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function refreshPendingAssignments() {
    apiFetch<any[]>('/admin/pending-assignment-requests')
      .then(setPendingAssignmentTasks)
      .catch(() => setPendingAssignmentTasks([]))
  }

  function refreshLeadRequests() {
    if (currentUser?.role !== 'admin') return
    apiFetch<any[]>('/admin/lead-action-requests')
      .then(setLeadActionRequests)
      .catch(() => setLeadActionRequests([]))
  }

  useEffect(() => {
    apiFetch<Task[]>('/admin/tasks')
      .then(setTasks)
      .catch(() => setTasks([]))
    apiFetch<any[]>('/admin/users')
      .then((users) => setMembers(users.filter((u) => u.role !== 'admin')))
      .catch(() => setMembers([]))
    apiFetch<any>('/admin/stats')
      .then(setStats)
      .catch(() => setStats(null))
    refreshPendingAssignments()
    if (currentUser.role === 'admin') {
      apiFetch<any[]>('/admin/lead-action-requests')
        .then(setLeadActionRequests)
        .catch(() => setLeadActionRequests([]))
    }
  }, [currentUser.role])

  const canManageUsers = currentUser.role === 'admin'

  if (currentUser.role !== 'admin' && currentUser.role !== 'lead') {
    return (
      <div className="flex flex-col min-h-full">
        <DashboardTopbar title="Access denied" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Shield className="size-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">You do not have admin access.</p>
          </div>
        </div>
      </div>
    )
  }

  function handleCreate() {
    if (!form.title || !form.deadline || !form.contributionType) return
    const assignPayload =
      form.assignedTo && form.assignedTo !== '__pool__' ? form.assignedTo : null
    const payload = {
      title: form.title,
      description: form.description,
      points: parseInt(form.points) || 10,
      assignedTo: assignPayload,
      deadline: form.deadline,
      category: form.category,
      contributionType: form.contributionType || undefined,
      priority: form.priority,
    }
    apiFetch<Task>('/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then((task) => {
        setTasks((prev) => [task, ...prev])
        setForm(DEFAULT_FORM)
        setTaskForm(null)
      })
      .catch(() => {})
  }

  function findTaskById(taskId: string) {
    return tasks.find((t) => String((t as any)._id ?? t.id) === taskId)
  }

  function handleUpdateTask() {
    if (!taskForm || taskForm.mode !== 'edit') return
    if (!form.title || !form.deadline || !form.contributionType) return
    const taskId = taskForm.taskId
    const assignPayload =
      form.assignedTo && form.assignedTo !== '__pool__' ? form.assignedTo : null
    const payload = {
      title: form.title,
      description: form.description,
      points: parseInt(form.points) || 10,
      assignedTo: assignPayload,
      deadline: form.deadline,
      category: form.category,
      contributionType: form.contributionType || undefined,
      priority: form.priority,
    }
    const existing = findTaskById(taskId)
    if (canActDirectOnTask(existing, currentUser)) {
      apiFetch<Task>(`/admin/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
        .then((task) => {
          setTasks((prev) =>
            prev.map((t) => (((t as any)._id ?? t.id) === taskId ? { ...t, ...task } : t)),
          )
          setViewTask((vt) => {
            if (!vt) return vt
            const vid = (vt as any)._id ?? vt.id
            return vid === taskId ? ({ ...vt, ...task } as Task) : vt
          })
          setForm(DEFAULT_FORM)
          setTaskForm(null)
        })
        .catch(() => {})
    } else {
      apiFetch('/admin/lead-action-requests', {
        method: 'POST',
        body: JSON.stringify({ type: 'edit_task', taskId, payload }),
      })
        .then(() => {
          setForm(DEFAULT_FORM)
          setTaskForm(null)
        })
        .catch(() => {})
    }
  }

  function handleApprove(taskId: string) {
    const t = findTaskById(taskId)
    if (canActDirectOnTask(t, currentUser)) {
      apiFetch<Task>(`/admin/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      }).catch(() => {})
      setTasks((prev) =>
        prev.map((task) => {
          const tid = (task as any)._id ?? task.id
          return tid === taskId ? { ...task, status: 'completed' } : task
        }),
      )
    } else {
      apiFetch('/admin/lead-action-requests', {
        method: 'POST',
        body: JSON.stringify({ type: 'approve_submission', taskId }),
      }).catch(() => {})
    }
    setViewTask(null)
  }

  function handleRejectSubmission(taskId: string) {
    const t = findTaskById(taskId)
    if (canActDirectOnTask(t, currentUser)) {
      apiFetch<Task>(`/admin/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      }).catch(() => {})
      setTasks((prev) =>
        prev.map((task) => {
          const tid = (task as any)._id ?? task.id
          return tid === taskId ? { ...task, status: 'in_progress' } : task
        }),
      )
    } else {
      apiFetch('/admin/lead-action-requests', {
        method: 'POST',
        body: JSON.stringify({ type: 'reject_submission', taskId }),
      }).catch(() => {})
    }
    setViewTask(null)
  }

  function handleDelete(taskId: string) {
    const t = findTaskById(taskId)
    if (canActDirectOnTask(t, currentUser)) {
      apiFetch(`/admin/tasks/${taskId}`, {
        method: 'DELETE',
      }).catch(() => {})
      setTasks((prev) => prev.filter((task) => ((task as any)._id ?? task.id) !== taskId))
    } else {
      apiFetch('/admin/lead-action-requests', {
        method: 'POST',
        body: JSON.stringify({ type: 'delete_task', taskId }),
      }).catch(() => {})
    }
    setViewTask(null)
  }

  function handleApproveAssignment(taskId: string, userId: string) {
    apiFetch(`/admin/tasks/${taskId}/approve-assignment`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
      .then(() => {
        refreshPendingAssignments()
        apiFetch<Task[]>('/admin/tasks').then(setTasks)
      })
      .catch(() => {})
  }

  function handleRejectAssignment(taskId: string, userId: string) {
    apiFetch(`/admin/tasks/${taskId}/reject-assignment`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
      .then(() => refreshPendingAssignments())
      .catch(() => {})
  }

  function executeConfirm() {
    if (!confirm) return
    const c = confirm
    setConfirm(null)
    switch (c.kind) {
      case 'approve_submission':
        handleApprove(c.taskId)
        break
      case 'reject_submission':
        handleRejectSubmission(c.taskId)
        break
      case 'delete_task':
        handleDelete(c.taskId)
        break
      case 'approve_assignment':
        handleApproveAssignment(c.taskId, c.userId)
        break
      case 'reject_assignment':
        handleRejectAssignment(c.taskId, c.userId)
        break
      case 'approve_user':
        apiFetch(`/admin/users/${c.userId}/approve`, { method: 'POST' }).catch(() => {})
        setMembers((prev) =>
          prev.map((u) => (String(u._id) === c.userId ? { ...u, status: 'active' } : u)),
        )
        break
      case 'reject_user':
        apiFetch(`/admin/users/${c.userId}/reject`, { method: 'POST' }).catch(() => {})
        setMembers((prev) =>
          prev.map((u) => (String(u._id) === c.userId ? { ...u, status: 'rejected' } : u)),
        )
        break
      default:
        break
    }
  }

  const submitted = tasks.filter((t) => t.status === 'submitted')
  const allTasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const panelTitle = currentUser.role === 'admin' ? 'Admin Panel' : 'Program'

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title={panelTitle} />

      <div className="flex-1 p-6 space-y-6">
        {/* Overview cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass rounded-xl border p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/30">
              <Users className="size-4 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Users</div>
              <div className="text-lg font-semibold">{stats?.totalUsers ?? '--'}</div>
            </div>
          </div>
          <div className="glass rounded-xl border p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 border border-accent/30">
              <ListChecks className="size-4 text-accent" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Tasks</div>
              <div className="text-lg font-semibold">{stats?.totalTasks ?? tasks.length}</div>
            </div>
          </div>
          <div className="glass rounded-xl border p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="size-4 text-green-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Completed Tasks</div>
              <div className="text-lg font-semibold">{stats?.completedTasks ?? submitted.length}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-full border border-border/60 bg-muted/30 p-1 text-xs">
            <button
              onClick={() => setView('tasks')}
              className={`px-3 py-1 rounded-full ${view === 'tasks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              Tasks
            </button>
            {canManageUsers && (
              <button
                onClick={() => setView('users')}
                className={`px-3 py-1 rounded-full ${view === 'users' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Users
              </button>
            )}
          </div>
          {view === 'tasks' && (
            <Button
              onClick={() => {
                setForm(DEFAULT_FORM)
                setTaskForm({ mode: 'create' })
              }}
              className="bg-primary text-primary-foreground neon-glow-purple gap-2"
            >
              <Plus className="size-4" /> Create Task
            </Button>
          )}
        </div>

        {view === 'tasks' && pendingAssignmentTasks.length > 0 && (
          <div className="glass rounded-2xl border border-primary/25 bg-primary/[0.04] p-5">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-primary">
              <UserPlus className="size-4" /> Assignment requests ({pendingAssignmentTasks.length} tasks)
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Contributors asked to work on these open pool tasks. Approve to assign them, or decline to remove the request.
            </p>
            <div className="space-y-4">
              {pendingAssignmentTasks.map((task: any) => (
                <div
                  key={task._id ?? task.id}
                  className="rounded-xl border border-border/60 bg-card/40 px-4 py-3"
                >
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {task.points} pts · Open pool
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {(task.pendingAssignmentRequests ?? []).map((req: any) => {
                      const uid = req.user?._id ?? req.user
                      const uname = req.user?.name ?? 'Contributor'
                      return (
                        <div
                          key={String(uid)}
                          className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarCircle initials={uname.slice(0, 2)} size="sm" />
                            <span className="truncate text-sm">{uname}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {req.requestedAt
                                ? new Date(req.requestedAt).toLocaleString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              className="gap-1 bg-primary/90 text-primary-foreground"
                              onClick={() =>
                                setConfirm({
                                  kind: 'approve_assignment',
                                  taskId: String(task._id ?? task.id),
                                  userId: String(uid),
                                  title: task.title ?? 'this task',
                                  userName: uname,
                                })
                              }
                            >
                              <Check className="size-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-muted-foreground"
                              onClick={() =>
                                setConfirm({
                                  kind: 'reject_assignment',
                                  taskId: String(task._id ?? task.id),
                                  userId: String(uid),
                                  title: task.title ?? 'this task',
                                  userName: uname,
                                })
                              }
                            >
                              <XCircle className="size-3.5" /> Decline
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'tasks' && canManageUsers && leadActionRequests.length > 0 && (
          <div className="glass rounded-2xl border border-orange-400/30 bg-orange-400/[0.06] p-5">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-orange-400">
              <Shield className="size-4" /> Lead requests — needs your approval ({leadActionRequests.length})
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Leads asked to edit, delete, approve, or reject work on tasks they didn&apos;t create. Approve to apply, or
              decline.
            </p>
            <div className="space-y-3">
              {leadActionRequests.map((req: any) => {
                const title = req.task?.title ?? 'Task'
                const leadName = req.requestedBy?.name ?? 'Lead'
                return (
                  <div
                    key={req._id}
                    className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">
                        <span className="text-orange-400/90">{String(req.type).replace(/_/g, ' ')}</span>
                        {' · '}
                        <span className="truncate">{title}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Requested by {leadName}
                        {req.createdAt
                          ? ` · ${new Date(req.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground"
                        onClick={() => {
                          apiFetch(`/admin/lead-action-requests/${req._id}/decline`, { method: 'POST' })
                            .then(() => {
                              setLeadActionRequests((prev) => prev.filter((r) => r._id !== req._id))
                            })
                            .catch(() => {})
                        }}
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 bg-primary/90 text-primary-foreground"
                        onClick={() => {
                          apiFetch(`/admin/lead-action-requests/${req._id}/approve`, { method: 'POST' })
                            .then(() => {
                              setLeadActionRequests((prev) => prev.filter((r) => r._id !== req._id))
                              apiFetch<Task[]>('/admin/tasks').then(setTasks)
                            })
                            .catch(() => {})
                        }}
                      >
                        <Check className="size-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {view === 'tasks' && submitted.length > 0 && (
          <div className="glass rounded-2xl border border-yellow-400/20 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-yellow-400">
              <Eye className="size-4" /> Pending Review ({submitted.length})
            </h3>
            <div className="space-y-3">
              {submitted.map((task: any) => {
                const assignee = task.assignedTo
                return (
                  <div key={task._id ?? task.id} className="flex items-center gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {assignee && (
                          <>
                            <AvatarCircle initials={assignee.name?.slice(0, 2) ?? '?'} size="sm" />
                            <span className="text-xs text-muted-foreground">{assignee.name}</span>
                          </>
                        )}
                        <span className="text-xs font-mono text-primary">{task.points} pts</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setViewTask(task)} className="text-xs">
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setConfirm({
                            kind: 'reject_submission',
                            taskId: String(task._id ?? task.id),
                            title: task.title ?? 'this task',
                          })
                        }
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs gap-1"
                      >
                        <XCircle className="size-3" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          setConfirm({
                            kind: 'approve_submission',
                            taskId: String(task._id ?? task.id),
                            title: task.title ?? 'this task',
                          })
                        }
                        className="bg-green-400/20 text-green-400 hover:bg-green-400/30 border border-green-400/30 text-xs gap-1"
                      >
                        <CheckCircle2 className="size-3" /> Approve
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tasks or Users table */}
        {view === 'tasks' ? (
          <div className="glass rounded-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h3 className="font-semibold">All Tasks</h3>
            </div>
            <div className="divide-y divide-border/50">
              {allTasks.map((task: any) => {
                const assignee = task.assignedTo
                return (
                  <div key={task._id ?? task.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {formatDate(task.createdAt)}
                        <span className="ml-2">
                          {assignee?.name ? (
                            <>
                              · Assigned to <span className="font-medium">{assignee.name}</span>
                            </>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400"> · Open pool</span>
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <AvatarCircle initials={assignee.name?.slice(0, 2) ?? '?'} size="sm" />
                          <span className="text-xs text-muted-foreground hidden md:block">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Pool</span>
                      )}
                    </div>
                    <StatusBadge value={task.category} type="category" />
                    <StatusBadge value={task.status} type="status" />
                    <span className="text-xs font-mono text-primary shrink-0 hidden sm:block">{task.points} pts</span>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setViewTask(task)}>
                        <Eye className="size-3.5" />
                      </Button>
                      {(currentUser.role === 'admin' || currentUser.role === 'lead') && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-primary hover:bg-primary/10"
                          title={
                            canActDirectOnTask(task, currentUser)
                              ? 'Edit task'
                              : 'Request edit (sent to admin for approval)'
                          }
                          onClick={() => {
                            setForm(taskToFormState(task))
                            setTaskForm({ mode: 'edit', taskId: String(task._id ?? task.id) })
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setConfirm({
                            kind: 'delete_task',
                            taskId: String(task._id ?? task.id),
                            title: task.title ?? 'this task',
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold">User Management</h3>
              <p className="text-xs text-muted-foreground">{members.length} members</p>
            </div>
            <div className="divide-y divide-border/50">
              {members.map((user) => (
                <div key={user._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AvatarCircle
                      initials={user.name?.slice(0, 2) || '?'}
                      src={typeof user.avatar === 'string' && user.avatar.startsWith('http') ? user.avatar : undefined}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <StatusBadge value={user.role} type="status" />
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {user.status || 'pending'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-primary shrink-0 hidden sm:block">
                    {user.points ?? 0} pts
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={user.role}
                      onValueChange={(role) => {
                        apiFetch(`/admin/users/${user._id}/role`, {
                          method: 'PATCH',
                          body: JSON.stringify({ role }),
                        }).catch(() => {})
                        setMembers((prev) => prev.map((u) => (u._id === user._id ? { ...u, role } : u)))
                      }}
                    >
                      <SelectTrigger className="w-28 bg-input border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass border-border/60">
                        <SelectItem value="intern">Intern</SelectItem>
                        <SelectItem value="associate">Associate</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="accounts">Accounts</SelectItem>
                          <SelectItem value="evangelist">Evangelist</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {user.status === 'pending' && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() =>
                            setConfirm({
                              kind: 'approve_user',
                              userId: String(user._id),
                              name: user.name ?? user.email ?? 'this user',
                            })
                          }
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setConfirm({
                              kind: 'reject_user',
                              userId: String(user._id),
                              name: user.name ?? user.email ?? 'this user',
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                    {user.status === 'active' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          apiFetch(`/admin/users/${user._id}/suspend`, { method: 'POST' }).catch(() => {})
                          setMembers((prev) =>
                            prev.map((u) => (u._id === user._id ? { ...u, status: 'suspended' } : u)),
                          )
                        }}
                      >
                        <Ban className="size-3.5" />
                      </Button>
                    )}
                    {user.status === 'suspended' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => {
                          apiFetch(`/admin/users/${user._id}/activate`, { method: 'POST' }).catch(() => {})
                          setMembers((prev) =>
                            prev.map((u) => (u._id === user._id ? { ...u, status: 'active' } : u)),
                          )
                        }}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No members found yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Task Dialog */}
      <Dialog
        open={taskForm !== null}
        onOpenChange={(o) => {
          if (!o) setTaskForm(null)
        }}
      >
        <DialogContent className="max-w-2xl border-border bg-card shadow-2xl shadow-black/40 p-0 overflow-hidden">
          {/* Header with solid background */}
          <div className="bg-gradient-to-br from-primary/20 via-card to-accent/10 border-b border-border px-6 py-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
                  {taskForm?.mode === 'edit' ? (
                    <Pencil className="size-5 text-primary" />
                  ) : (
                    <Plus className="size-5 text-primary" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-xl">
                    {taskForm?.mode === 'edit' ? 'Edit task' : 'Create New Task'}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {taskForm?.mode === 'edit'
                      ? 'Only the task creator can change details. Update fields below and save.'
                      : 'Assign a contribution task to a member. Fill in the basics below — points auto-fill from the policy.'}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Form body with solid background */}
          <div className="bg-card px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Step 1: Basic info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
                <h3 className="text-sm font-semibold text-foreground">Task details</h3>
              </div>
              <div className="space-y-3 pl-8">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Task title <span className="text-destructive">*</span></label>
                  <Input
                    placeholder="e.g. Edit reel for OSEN launch"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="h-10 bg-background border-border focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground text-xs">(optional)</span></label>
                  <Textarea
                    placeholder="Add context, links, or acceptance criteria..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="min-h-20 resize-none bg-background border-border focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Type & points */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
                <h3 className="text-sm font-semibold text-foreground">Contribution type & points</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Contribution type <span className="text-destructive">*</span></label>
                  <Select
                    value={form.contributionType}
                    onValueChange={(value) => {
                      const match = CONTRIBUTION_TYPES.flatMap((g) => g.items).find((i) => i.id === value)
                      setForm((f) => ({
                        ...f,
                        contributionType: value,
                        category: match ? match.category : f.category,
                        points: match ? String(match.points) : f.points,
                      }))
                    }}
                  >
                    <SelectTrigger className="h-10 bg-background border-border">
                      <SelectValue placeholder="Choose a type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-72">
                      {CONTRIBUTION_TYPES.map((group) => (
                        <div key={group.group}>
                          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            {group.group}
                          </div>
                          {group.items.map((item) => (
                            <SelectItem key={item.id} value={item.id} className="py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm">{item.label}</span>
                                <span className="text-xs text-primary font-medium">{item.points} pts</span>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Points</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.points}
                    onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                    className="h-10 bg-background border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Payout by monthly points tier (10+ pts) · Cap 100 pts = ₹{MAX_PAYOUT_INR}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Settings & assignee */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">3</span>
                <h3 className="text-sm font-semibold text-foreground">Settings & assignee</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-8">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TaskCategory }))}>
                    <SelectTrigger className="h-10 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {(['content', 'development', 'design', 'community', 'research'] as TaskCategory[]).map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Priority</label>
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
                    <SelectTrigger className="h-10 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p === 'urgent' ? 'Urgent' : p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Deadline & time <span className="text-destructive">*</span></label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-10 flex-1 justify-start text-left font-normal border-border">
                          <CalendarIcon className="mr-2 size-4" />
                          {form.deadline
                            ? new Date(form.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                        <Calendar
                          mode="single"
                          selected={form.deadline ? new Date(form.deadline) : undefined}
                          onSelect={(d) => {
                            const datePart = d ? d.toISOString().slice(0, 10) : ''
                            const timePart = form.deadline?.includes('T') ? form.deadline.slice(11, 16) : '23:59'
                            setForm((f) => ({ ...f, deadline: datePart ? `${datePart}T${timePart}` : '' }))
                          }}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={form.deadline?.includes('T') ? form.deadline.slice(11, 16) : '23:59'}
                      onChange={(e) => {
                        const datePart = form.deadline?.slice(0, 10) || new Date().toISOString().slice(0, 10)
                        setForm((f) => ({ ...f, deadline: `${datePart}T${e.target.value}` }))
                      }}
                      className="h-10 w-28 bg-background border-border"
                    />
                  </div>
                </div>
              </div>
              <div className="pl-8 space-y-2">
                <label className="text-sm font-medium text-foreground">Assign to</label>
                <p className="text-xs text-muted-foreground">Leave as open pool so anyone can claim, or pick a member.</p>
                <Select value={form.assignedTo} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}>
                  <SelectTrigger className="h-10 bg-background border-border">
                    <SelectValue placeholder="Open pool or member..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__pool__" className="py-2">
                      <span className="text-amber-600 dark:text-amber-400">Open pool (unassigned)</span>
                    </SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m._id} value={m._id} className="py-2">
                        <div className="flex items-center gap-2">
                          <AvatarCircle
                            initials={m.name?.slice(0, 2) || '?'}
                            src={typeof m.avatar === 'string' && m.avatar.startsWith('http') ? m.avatar : undefined}
                            size="sm"
                          />
                          <span>{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer with solid background */}
          <div className="border-t border-border bg-muted/30 px-6 py-4 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {!form.title || !form.deadline || !form.contributionType
                ? taskForm?.mode === 'edit'
                  ? 'Fill in all required fields (*) to save'
                  : 'Fill in all required fields (*) to create'
                : taskForm?.mode === 'edit'
                  ? taskForm.taskId &&
                      !canActDirectOnTask(findTaskById(taskForm.taskId), currentUser)
                    ? 'Ready to submit to admin for approval'
                    : 'Ready to save changes'
                  : 'Ready to create'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTaskForm(null)} className="border-border">
                Cancel
              </Button>
              {taskForm?.mode === 'edit' ? (
                <Button
                  onClick={handleUpdateTask}
                  className="bg-primary text-primary-foreground gap-1.5 shadow-lg shadow-primary/25"
                  disabled={!form.title || !form.deadline || !form.contributionType}
                >
                  <Pencil className="size-4" />{' '}
                  {taskForm.taskId &&
                  !canActDirectOnTask(findTaskById(taskForm.taskId), currentUser)
                    ? 'Submit for approval'
                    : 'Save changes'}
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  className="bg-primary text-primary-foreground gap-1.5 shadow-lg shadow-primary/25"
                  disabled={!form.title || !form.deadline || !form.contributionType}
                >
                  <Plus className="size-4" /> Create Task
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={!!viewTask} onOpenChange={(o) => !o && setViewTask(null)}>
        {viewTask && (
          <DialogContent className="glass border-border/60 max-w-lg max-h-[90vh] overflow-hidden p-0 flex flex-col">
            {/* Fixed header so the close X never scrolls out of view */}
            <div className="px-6 pt-6 pb-3 border-b border-border/50">
              <DialogHeader>
                <DialogTitle className="text-base">{viewTask.title}</DialogTitle>
              </DialogHeader>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{viewTask.description}</p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={viewTask.category} type="category" />
                <StatusBadge value={viewTask.priority} type="priority" />
                <StatusBadge value={viewTask.status} type="status" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Points: </span>
                  <span className="font-bold text-primary">{viewTask.points}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Deadline: </span>
                  <span>{formatDate((viewTask as any).deadline)}</span>
                </div>
                <div className="col-span-1">
                  <span className="text-muted-foreground">Assigned to: </span>
                  <span>{(viewTask as any).assignedTo?.name ?? 'Open pool (unassigned)'}</span>
                </div>
                <div className="col-span-2 text-xs">
                  <span className="text-muted-foreground">Created by: </span>
                  <span className="font-medium text-foreground">
                    {(viewTask as any).createdBy?.name ?? '—'}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-3 text-xs space-y-2">
                <div className="font-semibold">Payout (tiered by monthly points)</div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">This task</span>
                  <span>{viewTask.points} pts</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Payout is by <strong>total monthly points</strong>. Min {MIN_POINTS_FOR_PAYOUT} pts to qualify.
                </p>
                <div className="space-y-0.5 text-[10px]">
                  {PAYOUT_TIERS.map((t) => (
                    <div key={t.min} className="flex justify-between">
                      <span className="text-muted-foreground">{t.min === t.max ? t.min : `${t.min}-${t.max}`} pts</span>
                      <span className="font-medium text-primary">₹{t.amount}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cap: {MONTHLY_POINT_CAP} pts = ₹{MAX_PAYOUT_INR} as per OSEN policy.
                </p>
              </div>
              {viewTask.submission && (
                <div className="glass rounded-xl border border-border/50 p-4 space-y-2">
                  <h4 className="text-sm font-semibold">Submission</h4>
                  {viewTask.submission.githubLink && (
                    <p className="text-xs text-muted-foreground">
                      GitHub:{' '}
                      <a
                        href={viewTask.submission.githubLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {viewTask.submission.githubLink}
                      </a>
                    </p>
                  )}
                  {viewTask.submission.notionLink && (
                    <p className="text-xs text-muted-foreground">
                      Notion:{' '}
                      <a
                        href={viewTask.submission.notionLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {viewTask.submission.notionLink}
                      </a>
                    </p>
                  )}
                  {(viewTask.submission as any).googleDoc && (
                    <p className="text-xs text-muted-foreground">
                      Google Doc:{' '}
                      <a
                        href={(viewTask.submission as any).googleDoc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {(viewTask.submission as any).googleDoc}
                      </a>
                    </p>
                  )}
                  {viewTask.submission.comments && (
                    <p className="text-xs text-muted-foreground">
                      Comments:{' '}
                      <span className="whitespace-pre-wrap">{viewTask.submission.comments}</span>
                    </p>
                  )}
                </div>
              )}
              {(viewTask as any).history && (viewTask as any).history.length > 0 && (
                <div className="glass rounded-xl border border-border/50 p-4 space-y-2">
                  <h4 className="text-sm font-semibold">History</h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {(viewTask as any).history
                      .slice()
                      .sort(
                        (a: any, b: any) =>
                          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                      )
                      .map((entry: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-muted-foreground">
                          <span className="font-mono text-xs">{formatDate(entry.createdAt as string)}</span>{' '}
                          · <span className="font-semibold">{entry.action}</span>{' '}
                          {entry.fromStatus && entry.toStatus && (
                            <span>
                              ({entry.fromStatus} → {entry.toStatus})
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="glass rounded-xl border border-border/50 p-4">
                <TaskComments taskId={(viewTask as any)._id ?? viewTask.id} />
              </div>
            </div>

            {/* Fixed footer so Close/Approve never get hidden */}
            <div className="border-t border-border/50 bg-muted/20 px-6 py-4">
              <DialogFooter className="gap-2 flex-wrap sm:justify-end">
                {viewTask.status === 'submitted' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setConfirm({
                          kind: 'reject_submission',
                          taskId: String((viewTask as any)._id ?? viewTask.id),
                          title: viewTask.title ?? 'this task',
                        })
                      }
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
                    >
                      <XCircle className="size-3.5" /> Reject
                    </Button>
                    <Button
                      onClick={() =>
                        setConfirm({
                          kind: 'approve_submission',
                          taskId: String((viewTask as any)._id ?? viewTask.id),
                          title: viewTask.title ?? 'this task',
                        })
                      }
                      className="bg-green-400/20 text-green-400 hover:bg-green-400/30 border border-green-400/30 gap-1.5"
                    >
                      <CheckCircle2 className="size-3.5" /> Approve
                    </Button>
                  </>
                )}
                {(currentUser.role === 'admin' || currentUser.role === 'lead') && (
                  <Button
                    variant="outline"
                    className="gap-1.5 border-primary/40"
                    onClick={() => {
                      const t = viewTask
                      setViewTask(null)
                      setForm(taskToFormState(t))
                      setTaskForm({ mode: 'edit', taskId: String((t as any)._id ?? t.id) })
                    }}
                    title={
                      viewTask && canActDirectOnTask(viewTask as any, currentUser)
                        ? 'Edit task'
                        : 'Request edit (admin approves)'
                    }
                  >
                    <Pencil className="size-3.5" />{' '}
                    {viewTask && canActDirectOnTask(viewTask as any, currentUser)
                      ? 'Edit'
                      : 'Request edit'}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setViewTask(null)}>Close</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="glass border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? adminConfirmMeta(confirm).title : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? adminConfirmMeta(confirm).description : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm && adminConfirmMeta(confirm).destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault()
                executeConfirm()
              }}
            >
              {confirm ? adminConfirmMeta(confirm).actionLabel : 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
