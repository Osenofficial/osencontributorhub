'use client'

import { CheckCircle2, Zap, Clock, Calendar, MapPin } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { BadgeChip } from '@/components/badge-chip'
import { StatusBadge } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import { useApp } from '@/lib/app-context'
import { TASKS, USERS, MONTHLY_POINT_CAP, POINT_VALUE_INR, getTasksByUser, getActivitiesByUser } from '@/lib/data'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const { currentUser } = useApp()
  const myTasks = getTasksByUser(currentUser.id)
  const activities = getActivitiesByUser(currentUser.id)
  const completed = myTasks.filter((t) => t.status === 'completed')
  const inProgress = myTasks.filter((t) => t.status === 'in_progress')
  const sorted = [...USERS].sort((a, b) => b.points - a.points)
  const rank = sorted.findIndex((u) => u.id === currentUser.id) + 1
  const pointsPercent = Math.round((currentUser.points / MONTHLY_POINT_CAP) * 100)

  const categoryBreakdown = myTasks.reduce<Record<string, number>>((acc, task) => {
    if (task.status === 'completed') {
      acc[task.category] = (acc[task.category] ?? 0) + task.points
    }
    return acc
  }, {})

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="My Profile" />

      <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Profile card */}
        <div className="glass rounded-2xl border border-primary/20 p-6 neon-glow-purple">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <AvatarCircle initials={currentUser.avatar} size="xl" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{currentUser.name}</h2>
              <p className="text-muted-foreground text-sm mt-0.5 capitalize">{currentUser.role} &middot; {currentUser.email}</p>
              <p className="text-sm mt-2 leading-relaxed text-foreground/80">{currentUser.bio}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>Joined {new Date(currentUser.joinedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 glass rounded-xl border p-4 shrink-0 text-center">
              <div className="text-3xl font-bold neon-text-purple">{currentUser.points}</div>
              <div className="text-xs text-muted-foreground">total points</div>
              <div className="text-sm font-medium text-green-400 mt-1">≈ ₹{currentUser.points * POINT_VALUE_INR}</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: 'Tasks Done', value: completed.length, color: 'text-green-400' },
            { label: 'In Progress', value: inProgress.length, color: 'text-blue-400' },
            { label: 'Total Points', value: currentUser.points, color: 'text-primary' },
            { label: 'Global Rank', value: `#${rank}`, color: 'text-yellow-400' },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl border p-4 text-center">
              <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Monthly progress */}
        <div className="glass rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Monthly Points Progress</h3>
            <span className="font-mono text-sm text-primary">{currentUser.points} / {MONTHLY_POINT_CAP}</span>
          </div>
          <Progress value={pointsPercent} className="h-2.5 bg-muted" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{pointsPercent}% of monthly cap reached</span>
            <span>{MONTHLY_POINT_CAP - currentUser.points} pts to cap</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Badges */}
          <div className="glass rounded-2xl border p-5">
            <h3 className="font-semibold mb-4">Badges</h3>
            {currentUser.badges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No badges earned yet. Complete tasks to unlock badges!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentUser.badges.map((badge) => (
                  <BadgeChip key={badge.id} badge={badge} />
                ))}
              </div>
            )}
          </div>

          {/* Points by category */}
          <div className="glass rounded-2xl border p-5">
            <h3 className="font-semibold mb-4">Points by Category</h3>
            {Object.keys(categoryBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(categoryBreakdown).map(([cat, pts]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <StatusBadge value={cat as any} type="category" />
                    <div className="flex-1">
                      <Progress value={Math.round((pts / currentUser.points) * 100)} className="h-1.5 bg-muted" />
                    </div>
                    <span className="text-sm font-mono text-primary w-12 text-right">{pts} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contribution History */}
        <div className="glass rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Contribution History</h3>
          <div className="space-y-3">
            {myTasks.filter((t) => t.status === 'completed' || t.status === 'submitted').length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
            ) : (
              myTasks
                .filter((t) => t.status === 'completed' || t.status === 'submitted')
                .map((task) => (
                  <div key={task.id} className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/30 px-4 py-3">
                    <CheckCircle2 className={cn('size-4 mt-0.5 shrink-0', task.status === 'completed' ? 'text-green-400' : 'text-yellow-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge value={task.category} type="category" />
                        <span className="text-xs text-muted-foreground">{task.deadline}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono text-primary shrink-0">{task.points} pts</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
