'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, Trophy, Zap, ArrowRight, Activity, Play, Send, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useApp } from '@/lib/app-context'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
  MONTHLY_POINT_CAP,
  POINT_VALUE_INR,
} from '@/lib/data'
import { getContributionLabel } from '@/lib/contribution-types'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  glow,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  glow?: string
}) {
  return (
    <div className={cn('glass rounded-2xl border p-5 transition-transform hover:-translate-y-0.5', glow)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{title}</p>
          <p className={cn('text-3xl font-bold', color)}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={cn('flex size-10 items-center justify-center rounded-xl border border-border/50 bg-background/50')}>
          <Icon className={cn('size-5', color)} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { currentUser } = useApp()
  const [myTasks, setMyTasks] = useState<any[]>([])
  const [sortedUsers, setSortedUsers] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  const [submitTarget, setSubmitTarget] = useState<any | null>(null)
  const [reassignTarget, setReassignTarget] = useState<any | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [submission, setSubmission] = useState({ githubLink: '', notionLink: '', googleDoc: '', comments: '' })

  useEffect(() => {
    apiFetch<any>('/dashboard/overview')
      .then((data) => {
        setMyTasks(data.recentTasks || [])
        setActivities(data.activities || [])
      })
      .catch(() => {
        setMyTasks([])
        setActivities([])
      })
    apiFetch<any[]>('/dashboard/leaderboard')
      .then(setSortedUsers)
      .catch(() => setSortedUsers([]))
    apiFetch<any[]>('/dashboard/team')
      .then(setTeam)
      .catch(() => setTeam([]))
  }, [currentUser?.id])

  const completedTasks = myTasks.filter((t) => t.status === 'completed')
  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress')
  const myRank = sortedUsers.findIndex((u) => u.userId === currentUser?.id) + 1
  const pointsPercent = Math.round(((currentUser?.points ?? 0) / MONTHLY_POINT_CAP) * 100)

  function handleStart(task: any) {
    apiFetch<any>(`/dashboard/tasks/${task._id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' }),
    }).catch(() => {})
    setMyTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: 'in_progress' } : t))
  }

  function handleSubmit() {
    if (!submitTarget) return
    apiFetch<any>(`/dashboard/tasks/${submitTarget._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'submitted',
        submission: { ...submission, submittedAt: new Date().toISOString() },
      }),
    }).catch(() => {})
    setMyTasks((prev) =>
      prev.map((t) =>
        t._id === submitTarget._id
          ? { ...t, status: 'submitted', submission: { ...submission, submittedAt: new Date().toISOString() } }
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
        setMyTasks((prev) => prev.filter((t) => t._id !== reassignTarget._id))
        setReassignTarget(null)
        setReassignTo('')
      })
      .catch(() => {})
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {/* Welcome */}
        <div className="glass rounded-2xl border border-primary/20 p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AvatarCircle initials={currentUser?.avatar || currentUser?.name?.slice(0, 2) || '?'} src={currentUser?.avatarSrc} size="lg" />
            <div>
              <h2 className="text-xl font-bold">Welcome back, {currentUser?.name?.split(' ')[0] ?? 'there'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentUser?.role === 'admin'
                  ? 'You have admin access to manage all tasks and contributors.'
                  : `You have ${inProgressTasks.length} task${inProgressTasks.length !== 1 ? 's' : ''} in progress.`}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="size-4 text-primary" />
            <span className="font-bold text-primary text-lg">{currentUser?.points ?? 0}</span>
            <span>/ {MONTHLY_POINT_CAP} pts this month</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Points"
            value={currentUser?.points ?? 0}
            sub={`≈ ₹${currentUser.points * POINT_VALUE_INR} value`}
            icon={Zap}
            color="text-primary"
            glow="border-primary/20"
          />
          <StatCard
            title="Tasks Completed"
            value={completedTasks.length}
            sub="All time"
            icon={CheckCircle2}
            color="text-green-400"
            glow="border-green-400/20"
          />
          <StatCard
            title="In Progress"
            value={inProgressTasks.length}
            sub="Active tasks"
            icon={Clock}
            color="text-yellow-400"
            glow="border-yellow-400/20"
          />
          {myRank > 0 && (
            <StatCard
              title="Leaderboard Rank"
              value={`#${myRank}`}
              sub={`of ${sortedUsers.length} contributors`}
              icon={Trophy}
              color="text-neon-cyan"
              glow="border-accent/20"
            />
          )}
        </div>

        {/* Monthly points progress */}
        <div className="glass rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Monthly Points Progress</h3>
            <span className="text-sm font-mono text-primary">{currentUser?.points ?? 0} / {MONTHLY_POINT_CAP}</span>
          </div>
          <Progress value={pointsPercent} className="h-2 bg-muted" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{pointsPercent}% of monthly cap</span>
            <span className="text-xs text-muted-foreground">{MONTHLY_POINT_CAP - (currentUser?.points ?? 0)} pts remaining</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* My Tasks */}
          <div className="glass rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">My Tasks</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Start, submit, or reassign</p>
              </div>
              <Link href="/dashboard/tasks">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-primary">
                  View all <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {myTasks.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
                  <p className="text-xs text-muted-foreground">Ask your admin or lead to assign tasks to you.</p>
                  <Link href="/dashboard/tasks">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      Go to Tasks <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                myTasks.slice(0, 4).map((task) => {
                  const assignee = task.assignedTo
                  const currentAssigneeId = assignee?._id ?? task.assignedTo
                  const othersCount = team.filter((m) => m._id !== currentAssigneeId).length
                  const canReassign = (task.status === 'todo' || task.status === 'in_progress') && othersCount > 0
                  return (
                    <div key={task._id ?? task.id} className="rounded-xl border border-border/50 bg-background/30 px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Due {task.deadline ? new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono text-primary">{task.points} pts</span>
                          <StatusBadge value={task.status} type="status" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {task.status === 'todo' && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-blue-400/30 text-blue-400 hover:bg-blue-400/10" onClick={() => handleStart(task)}>
                            <Play className="size-3" /> Start
                          </Button>
                        )}
                        {task.status === 'in_progress' && (
                          <Button size="sm" className="h-7 gap-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30" onClick={() => setSubmitTarget(task)}>
                            <Send className="size-3" /> Submit
                          </Button>
                        )}
                        {task.status === 'submitted' && (
                          <span className="text-xs text-yellow-400 py-1">Awaiting review</span>
                        )}
                        {canReassign && (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setReassignTarget(task)}>
                            <UserPlus className="size-3" /> Reassign
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Community Leaderboard preview */}
          <div className="glass rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Community Leaderboard</h3>
              <Link href="/dashboard/leaderboard">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-primary">
                  Full view <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {sortedUsers.slice(0, 5).map((user, i) => (
                <div
                  key={user.userId ?? user.id ?? i}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 transition-colors',
                    (user.userId ?? user.id) === currentUser?.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/30',
                  )}
                >
                  <span className={cn('w-5 text-center text-sm font-bold shrink-0', i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground')}>
                    {i + 1}
                  </span>
                  <AvatarCircle initials={user.initials ?? user.name?.slice(0, 2) ?? '?'} src={user.avatar?.startsWith?.('http') ? user.avatar : undefined} size="sm" />
                  <span className={cn('flex-1 text-sm font-medium', (user.userId ?? user.id) === currentUser?.id && 'text-primary')}>
                    {user.name}
                    {(user.userId ?? user.id) === currentUser?.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </span>
                  <span className="text-sm font-bold text-primary shrink-0">{user.totalPoints ?? user.points ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="size-4 text-primary" />
            <h3 className="font-semibold">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity, idx) => {
              const user = sortedUsers.find((u) => u.userId === activity.userId)
              return (
                <div key={activity._id ?? activity.id ?? idx} className="flex items-start gap-3">
                  <AvatarCircle initials={user?.initials ?? user?.name?.slice(0, 2) ?? '?'} src={user?.avatar?.startsWith?.('http') ? user.avatar : undefined} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{user?.name}</span>{' '}
                      <span className="text-muted-foreground">{activity.action}</span>{' '}
                      <span className="text-foreground/80">{activity.detail}</span>
                      {activity.points && (
                        <span className="ml-1 text-xs font-mono text-primary">+{activity.points} pts</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(activity.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
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
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <StatusBadge value={submitTarget?.category} type="category" />
              <span className="text-sm font-mono text-primary font-semibold">{submitTarget?.points} pts</span>
              <span className="text-xs text-muted-foreground">
                {submitTarget && getContributionLabel(submitTarget.category, submitTarget.contributionType)}
              </span>
            </div>
          </div>
          <div className="space-y-3 py-4 px-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">GitHub Link</label>
              <Input placeholder="https://github.com/..." value={submission.githubLink}
                onChange={(e) => setSubmission((s) => ({ ...s, githubLink: e.target.value }))}
                className="bg-background border-border text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Notion Link</label>
              <Input placeholder="https://notion.so/..." value={submission.notionLink}
                onChange={(e) => setSubmission((s) => ({ ...s, notionLink: e.target.value }))}
                className="bg-background border-border text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Google Doc Link</label>
              <Input placeholder="https://docs.google.com/..." value={submission.googleDoc}
                onChange={(e) => setSubmission((s) => ({ ...s, googleDoc: e.target.value }))}
                className="bg-background border-border text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Comments</label>
              <Textarea placeholder="Add any notes for the reviewer..." value={submission.comments}
                onChange={(e) => setSubmission((s) => ({ ...s, comments: e.target.value }))}
                className="bg-background border-border text-sm min-h-20 resize-none" />
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
            <p className="text-sm text-muted-foreground">{reassignTarget?.title}</p>
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
                          <AvatarCircle initials={m.name?.slice(0, 2) || '?'} src={m.avatar?.startsWith?.('http') ? m.avatar : undefined} size="sm" />
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
