'use client'

import { useEffect, useState } from 'react'
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
import { cn } from '@/lib/utils'

const COLUMN_ORDER: TaskStatus[] = ['todo', 'in_progress', 'submitted', 'completed']

const COLUMN_META: Record<TaskStatus, { icon: React.ComponentType<{ className?: string }>; color: string; glow: string }> = {
  todo: { icon: Circle, color: 'text-muted-foreground', glow: 'border-border/60' },
  in_progress: { icon: Clock, color: 'text-blue-400', glow: 'border-blue-400/30' },
  submitted: { icon: AlertCircle, color: 'text-yellow-400', glow: 'border-yellow-400/30' },
  completed: { icon: CheckCircle2, color: 'text-green-400', glow: 'border-green-400/30' },
}

function TaskCard({
  task,
  onSubmit,
  onStart,
  onReassign,
  team,
}: {
  task: any
  onSubmit: (task: any) => void
  onStart: (task: any) => void
  onReassign: (task: any) => void
  team: any[]
}) {
  const assignee = task.assignedTo
  const currentAssigneeId = assignee?._id ?? task.assignedTo
  const othersCount = team.filter((m) => m._id !== currentAssigneeId).length
  const canReassign = (task.status === 'todo' || task.status === 'in_progress') && othersCount > 0

  return (
    <div className="glass rounded-xl border border-border/50 p-4 hover:border-primary/20 transition-all hover:-translate-y-0.5 cursor-default">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold leading-tight flex-1">{task.title}</h4>
        <StatusBadge value={task.priority} type="priority" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{task.description}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <StatusBadge value={task.category} type="category" />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>Due {task.deadline ? new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        <span className="font-mono text-primary font-bold">{task.points} pts</span>
      </div>
      {assignee && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
          <AvatarCircle initials={assignee.name?.slice(0, 2) ?? '?'} size="sm" />
          <span>{assignee.name}</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {task.status === 'todo' && (
          <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs border-blue-400/30 text-blue-400 hover:bg-blue-400/10" onClick={() => onStart(task)}>
            <Play className="size-3" /> Start Task
          </Button>
        )}
        {task.status === 'in_progress' && (
          <Button size="sm" className="w-full gap-1.5 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30" onClick={() => onSubmit(task)}>
            <Send className="size-3" /> Submit Work
          </Button>
        )}
        {task.status === 'submitted' && (
          <div className="text-xs text-yellow-400 text-center py-1">Awaiting review...</div>
        )}
        {task.status === 'completed' && task.submission && (
          <div className="flex gap-2 flex-wrap mt-1">
            {task.submission.githubLink && (
              <a href={task.submission.githubLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Github className="size-3" /> GitHub
              </a>
            )}
            {task.submission.notionLink && (
              <a href={task.submission.notionLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <LinkIcon className="size-3" /> Notion
              </a>
            )}
          </div>
        )}
        {canReassign && (
          <Button size="sm" variant="ghost" className="w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => onReassign(task)}>
            <UserPlus className="size-3" /> Assign to someone else
          </Button>
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { currentUser } = useApp()
  const [tasks, setTasks] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [submitTarget, setSubmitTarget] = useState<any | null>(null)
  const [reassignTarget, setReassignTarget] = useState<any | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [submission, setSubmission] = useState({ githubLink: '', notionLink: '', googleDoc: '', comments: '' })

  useEffect(() => {
    apiFetch<any[]>('/dashboard/tasks')
      .then(setTasks)
      .catch(() => setTasks([]))
  }, [currentUser?.id])

  useEffect(() => {
    apiFetch<any[]>('/dashboard/team')
      .then(setTeam)
      .catch(() => setTeam([]))
  }, [])

  const myTasks = currentUser.role === 'admin' ? tasks : tasks

  const columns = COLUMN_ORDER.reduce<Record<TaskStatus, any[]>>((acc, status) => {
    acc[status] = myTasks.filter((t) => t.status === status)
    return acc
  }, { todo: [], in_progress: [], submitted: [], completed: [] })

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

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title={currentUser.role === 'admin' ? 'All Tasks (Kanban)' : 'My Tasks'} />

      <div className="flex-1 p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {COLUMN_ORDER.map((status) => {
            const meta = COLUMN_META[status]
            const col = columns[status]
            return (
              <div key={status} className="w-72 flex-shrink-0">
                <div className={cn('glass rounded-xl border mb-3 px-4 py-3 flex items-center gap-2', meta.glow)}>
                  <meta.icon className={cn('size-4', meta.color)} />
                  <span className="font-semibold text-sm">{STATUS_LABELS[status]}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{col.length}</span>
                </div>
                <div className="space-y-3">
                  {col.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      onSubmit={setSubmitTarget}
                      onStart={handleStart}
                      onReassign={setReassignTarget}
                      team={team}
                    />
                  ))}
                  {col.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">
                      {status === 'todo' && currentUser.role !== 'admin' && myTasks.length === 0 ? (
                        <p>No tasks assigned yet. Ask your admin or lead to assign tasks to you.</p>
                      ) : (
                        'No tasks'
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Submit Work Dialog */}
      <Dialog open={!!submitTarget} onOpenChange={(o) => !o && setSubmitTarget(null)}>
        <DialogContent className="max-w-md border-border bg-card shadow-xl p-0 overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-muted/30">
            <DialogHeader>
              <DialogTitle>Submit Work</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-1">{submitTarget?.title}</p>
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
