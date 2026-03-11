'use client'

import { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Shield, Trash2, Eye, Users, ListChecks, Ban, Check } from 'lucide-react'
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
import { useApp } from '@/lib/app-context'
import {
  Task,
  TaskCategory,
  Priority,
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
  assignedTo: '',
  priority: 'medium',
}

export default function AdminPage() {
  const { currentUser } = useApp()
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState<'tasks' | 'users'>('tasks')
  const [showCreate, setShowCreate] = useState(false)
  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [members, setMembers] = useState<any[]>([])
  const [stats, setStats] = useState<{ totalUsers: number; totalTasks: number; completedTasks: number } | null>(null)

  function formatDate(value: string | Date | undefined) {
    if (!value) return '—'
    const d = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
  }, [])

  const canManageUsers = currentUser.role === 'admin'

  if (currentUser.role !== 'admin' && currentUser.role !== 'lead') {
    return (
      <div className="flex flex-col min-h-full">
        <DashboardTopbar title="Admin Panel" />
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
    if (!form.title || !form.assignedTo || !form.deadline) return
    const payload = {
      title: form.title,
      description: form.description,
      points: parseInt(form.points) || 10,
      assignedTo: form.assignedTo,
      deadline: form.deadline,
      category: form.category,
      priority: form.priority,
    }
    apiFetch<Task>('/admin/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then((task) => {
        setTasks((prev) => [task, ...prev])
        setForm(DEFAULT_FORM)
        setShowCreate(false)
      })
      .catch(() => {})
  }

  function handleApprove(taskId: string) {
    apiFetch<Task>(`/admin/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    }).catch(() => {})
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'completed' } : t))
    setViewTask(null)
  }

  function handleDelete(taskId: string) {
    apiFetch(`/admin/tasks/${taskId}`, {
      method: 'DELETE',
    }).catch(() => {})
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setViewTask(null)
  }

  const submitted = tasks.filter((t) => t.status === 'submitted')
  const allTasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Admin Panel" />

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
            <Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground neon-glow-purple gap-2">
              <Plus className="size-4" /> Create Task
            </Button>
          )}
        </div>

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
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setViewTask(task)} className="text-xs">
                        Review
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(task._id ?? task.id)} className="bg-green-400/20 text-green-400 hover:bg-green-400/30 border border-green-400/30 text-xs gap-1">
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
                        {assignee?.name && (
                          <span className="ml-2">
                            · Assigned to <span className="font-medium">{assignee.name}</span>
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {assignee && (
                        <div className="flex items-center gap-1.5">
                          <AvatarCircle initials={assignee.name?.slice(0, 2) ?? '?'} size="sm" />
                          <span className="text-xs text-muted-foreground hidden md:block">{assignee.name}</span>
                        </div>
                      )}
                    </div>
                    <StatusBadge value={task.category} type="category" />
                    <StatusBadge value={task.status} type="status" />
                    <span className="text-xs font-mono text-primary shrink-0 hidden sm:block">{task.points} pts</span>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setViewTask(task)}>
                        <Eye className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task._id ?? task.id)}>
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
                    <AvatarCircle initials={user.avatar || user.name?.slice(0, 2) || '?'} size="sm" />
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
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {user.status === 'pending' && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            apiFetch(`/admin/users/${user._id}/approve`, { method: 'POST' }).catch(() => {})
                            setMembers((prev) =>
                              prev.map((u) => (u._id === user._id ? { ...u, status: 'active' } : u)),
                            )
                          }}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            apiFetch(`/admin/users/${user._id}/reject`, { method: 'POST' }).catch(() => {})
                            setMembers((prev) =>
                              prev.map((u) => (u._id === user._id ? { ...u, status: 'rejected' } : u)),
                            )
                          }}
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

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="glass border-border/60 max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Create a new OSEN contribution task and assign it to a contributor. Points and payout follow the rewards policy.
            </p>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Task Title *</label>
              <Input placeholder="e.g. Edit reel for OSEN launch" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-input border-border/60" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                placeholder="Add any context, links, or acceptance criteria..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-input border-border/60 min-h-24 resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Contribution Type *</label>
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
                  <SelectTrigger className="bg-input border-border/60">
                    <SelectValue placeholder="Select contribution type..." />
                  </SelectTrigger>
                  <SelectContent className="glass border-border/60 max-h-72">
                    {CONTRIBUTION_TYPES.map((group) => (
                      <div key={group.group}>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {group.group}
                        </div>
                        {group.items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm">{item.label}</span>
                              <span className="text-[11px] text-muted-foreground">{item.points} pts</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Points (auto from policy)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                  className="bg-input border-border/60"
                />
                <p className="text-[10px] text-muted-foreground">
                  1 point = ₹50 · Monthly max per contributor: 100 pts (₹5000)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TaskCategory }))}>
                  <SelectTrigger className="bg-input border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border-border/60">
                    {(['content', 'development', 'design', 'community', 'research'] as TaskCategory[]).map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger className="bg-input border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass border-border/60">
                    {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p === 'urgent' ? 'Urgent (priority)' : p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Deadline *</label>
                <Input type="date" value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="bg-input border-border/60" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assign To *</label>
              <Select value={form.assignedTo} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}>
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue placeholder="Select a member..." />
                </SelectTrigger>
                <SelectContent className="glass border-border/60">
                  {members.map((m) => (
                  <SelectItem key={m._id} value={m._id}>
                      <div className="flex items-center gap-2">
                      <AvatarCircle initials={m.avatar || m.name?.slice(0, 2) || '?'} size="sm" />
                      {m.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              className="bg-primary text-primary-foreground gap-1.5"
              disabled={!form.title || !form.assignedTo || !form.deadline || !form.contributionType}
            >
              <Plus className="size-3.5" /> Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={!!viewTask} onOpenChange={(o) => !o && setViewTask(null)}>
        {viewTask && (
          <DialogContent className="glass border-border/60 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">{viewTask.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
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
                <div>
                  <span className="text-muted-foreground">Assigned to: </span>
                  <span>{(viewTask as any).assignedTo?.name ?? '—'}</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-3 text-xs space-y-1">
                <div className="font-semibold">Payout Preview</div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Point value</span>
                  <span>1 pt = ₹50</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Task points</span>
                  <span>{viewTask.points} pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated amount</span>
                  <span className="font-semibold text-primary">₹{viewTask.points * 50}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Final monthly payout is capped at 100 points (₹5000) across all tasks as per OSEN policy.
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
                          <span className="font-mono text-xs">
                            {formatDate(entry.createdAt as string)}
                          </span>{' '}
                          ·{' '}
                          <span className="font-semibold">{entry.action}</span>{' '}
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
            </div>
            <DialogFooter className="gap-2">
              {viewTask.status === 'submitted' && (
                <Button onClick={() => handleApprove(viewTask.id)} className="bg-green-400/20 text-green-400 hover:bg-green-400/30 border border-green-400/30 gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Approve
                </Button>
              )}
              <Button variant="ghost" onClick={() => setViewTask(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
