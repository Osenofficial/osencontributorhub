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
  getUserById,
} from '@/lib/data'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

type FormState = {
  title: string
  description: string
  category: TaskCategory
  points: string
  deadline: string
  assignedTo: string
  priority: Priority
}

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
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
              {submitted.map((task) => {
                const assignee = getUserById(task.assignedTo)
                return (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {assignee && <AvatarCircle initials={assignee.avatar} size="sm" />}
                        <span className="text-xs text-muted-foreground">{assignee?.name}</span>
                        <span className="text-xs font-mono text-primary">{task.points} pts</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setViewTask(task)} className="text-xs">
                        Review
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(task.id)} className="bg-green-400/20 text-green-400 hover:bg-green-400/30 border border-green-400/30 text-xs gap-1">
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
              {allTasks.map((task) => {
                const assignee = getUserById(task.assignedTo)
                return (
                  <div key={task.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Created {task.createdAt}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {assignee && (
                        <div className="flex items-center gap-1.5">
                          <AvatarCircle initials={assignee.avatar} size="sm" />
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
                      <Button size="icon" variant="ghost" className="size-7 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
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
        <DialogContent className="glass border-border/60 max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Task Title *</label>
              <Input placeholder="Enter task title..." value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-input border-border/60" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea placeholder="Describe the task..." value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-input border-border/60 min-h-20 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                    {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Points Value</label>
                <Input type="number" min={1} max={100} value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                  className="bg-input border-border/60" />
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
            <Button onClick={handleCreate} className="bg-primary text-primary-foreground gap-1.5" disabled={!form.title || !form.assignedTo || !form.deadline}>
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
                  <span>{viewTask.deadline}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned to: </span>
                  <span>{getUserById(viewTask.assignedTo)?.name}</span>
                </div>
              </div>
              {viewTask.submission && (
                <div className="glass rounded-xl border border-border/50 p-4 space-y-2">
                  <h4 className="text-sm font-semibold">Submission</h4>
                  {viewTask.submission.githubLink && (
                    <p className="text-xs text-muted-foreground">GitHub: <a href={viewTask.submission.githubLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{viewTask.submission.githubLink}</a></p>
                  )}
                  {viewTask.submission.notionLink && (
                    <p className="text-xs text-muted-foreground">Notion: <a href={viewTask.submission.notionLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{viewTask.submission.notionLink}</a></p>
                  )}
                  {viewTask.submission.comments && (
                    <p className="text-xs text-muted-foreground">Comments: {viewTask.submission.comments}</p>
                  )}
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
