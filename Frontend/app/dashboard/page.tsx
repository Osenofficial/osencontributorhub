'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, TrendingUp, Trophy, Zap, ArrowRight, Activity } from 'lucide-react'
import Link from 'next/link'
import { useApp } from '@/lib/app-context'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  MONTHLY_POINT_CAP,
  POINT_VALUE_INR,
  STATUS_LABELS,
} from '@/lib/data'
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
  }, [currentUser.id])

  const completedTasks = myTasks.filter((t) => t.status === 'completed')
  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress')
  const myRank = sortedUsers.findIndex((u) => u.userId === currentUser.id) + 1
  const pointsPercent = Math.round((currentUser.points / MONTHLY_POINT_CAP) * 100)

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Dashboard" />

      <div className="flex-1 p-6 space-y-6">
        {/* Welcome */}
        <div className="glass rounded-2xl border border-primary/20 p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AvatarCircle initials={currentUser.avatar} size="lg" />
            <div>
              <h2 className="text-xl font-bold">Welcome back, {currentUser.name.split(' ')[0]}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {currentUser.role === 'admin'
                  ? 'You have admin access to manage all tasks and contributors.'
                  : `You have ${inProgressTasks.length} task${inProgressTasks.length !== 1 ? 's' : ''} in progress.`}
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="size-4 text-primary" />
            <span className="font-bold text-primary text-lg">{currentUser.points}</span>
            <span>/ {MONTHLY_POINT_CAP} pts this month</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Points"
            value={currentUser.points}
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
            <span className="text-sm font-mono text-primary">{currentUser.points} / {MONTHLY_POINT_CAP}</span>
          </div>
          <Progress value={pointsPercent} className="h-2 bg-muted" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{pointsPercent}% of monthly cap</span>
            <span className="text-xs text-muted-foreground">{MONTHLY_POINT_CAP - currentUser.points} pts remaining</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* My Tasks */}
          <div className="glass rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">My Tasks</h3>
              <Link href="/dashboard/tasks">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-primary">
                  View all <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {myTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No tasks assigned yet.</p>
              ) : (
                myTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Due {task.deadline}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-primary">{task.points} pts</span>
                      <StatusBadge value={task.status} type="status" />
                    </div>
                  </div>
                ))
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
                  key={user.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 transition-colors',
                    user.id === currentUser.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/30',
                  )}
                >
                  <span className={cn('w-5 text-center text-sm font-bold shrink-0', i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground')}>
                    {i + 1}
                  </span>
                  <AvatarCircle initials={user.avatar || '?'} size="sm" />
                  <span className={cn('flex-1 text-sm font-medium', user.id === currentUser.id && 'text-primary')}>
                    {user.name}
                    {user.userId === currentUser.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </span>
                  <span className="text-sm font-bold text-primary shrink-0">{user.points}</span>
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
            {activities.slice(0, 5).map((activity) => {
              const user = sortedUsers.find((u) => u.userId === activity.userId)
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <AvatarCircle initials={user?.avatar ?? '?'} size="sm" />
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
    </div>
  )
}
