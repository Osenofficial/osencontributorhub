'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Trophy,
  Zap,
  ArrowRight,
  Sparkles,
  CalendarRange,
} from 'lucide-react'
import Link from 'next/link'
import { useApp } from '@/lib/app-context'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  MONTHLY_POINT_CAP,
  getPayoutForPoints,
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
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card/30 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5',
        glow,
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={cn('mt-1.5 text-3xl font-bold tabular-nums tracking-tight', color)}>{value}</p>
          {sub && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/70 shadow-inner">
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

  useEffect(() => {
    apiFetch<any>('/dashboard/overview')
      .then((data) => {
        setMyTasks(data.recentTasks || [])
      })
      .catch(() => {
        setMyTasks([])
      })
    apiFetch<any[]>('/dashboard/leaderboard')
      .then(setSortedUsers)
      .catch(() => setSortedUsers([]))
  }, [currentUser?.id])

  const completedTasks = myTasks.filter((t) => t.status === 'completed')
  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress')
  const myRank = sortedUsers.findIndex((u) => u.userId === currentUser?.id) + 1
  const pointsPercent = Math.round(((currentUser?.points ?? 0) / MONTHLY_POINT_CAP) * 100)

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex min-h-full flex-col">
      <DashboardTopbar title="Dashboard" />

      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/[0.07] to-transparent" />
        <div className="relative mx-auto max-w-6xl space-y-8 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
          {/* Hero */}
          <section className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/60 to-primary/[0.06] p-6 shadow-lg shadow-primary/5 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-primary/25 blur-xl" />
                  <div className="relative rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                    <AvatarCircle
                      initials={currentUser?.avatar || currentUser?.name?.slice(0, 2) || '?'}
                      src={currentUser?.avatarSrc}
                      size="lg"
                    />
                  </div>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="size-4 text-primary" aria-hidden />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{todayLabel}</p>
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Hi, {currentUser?.name?.split(' ')[0] ?? 'there'}
                  </h1>
                  <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {currentUser?.role === 'admin'
                      ? 'Manage contributors, review work, and keep the program moving from here.'
                      : inProgressTasks.length > 0
                        ? `You’re making progress — ${inProgressTasks.length} active task${inProgressTasks.length !== 1 ? 's' : ''} right now. Finish strong!`
                        : 'Open My tasks for your board, or browse the full program list under All tasks.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 px-4 py-3 backdrop-blur-sm">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
                    <Zap className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">This month</p>
                    <p className="text-xl font-bold tabular-nums text-primary">
                      {currentUser?.points ?? 0}
                      <span className="text-sm font-normal text-muted-foreground"> / {MONTHLY_POINT_CAP}</span>
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-full lg:flex-col">
                  <Link href="/dashboard/all-tasks" className="w-full sm:w-auto lg:w-full">
                    <Button variant="outline" className="w-full gap-2 border-primary/25" size="lg">
                      All tasks
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                  <Link href="/dashboard/tasks" className="w-full sm:w-auto lg:w-full">
                    <Button className="w-full gap-2 shadow-md shadow-primary/10" size="lg">
                      My tasks
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section aria-label="Your stats">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total points"
                value={currentUser?.points ?? 0}
                sub={(() => {
                  const pts = currentUser?.points ?? 0
                  const { amount, tierLabel } = getPayoutForPoints(pts)
                  return amount > 0 ? `Est. payout ₹${amount} · ${tierLabel}` : tierLabel
                })()}
                icon={Zap}
                color="text-primary"
                glow="border-primary/25"
              />
              <StatCard
                title="Completed"
                value={completedTasks.length}
                sub="Tasks finished (all time)"
                icon={CheckCircle2}
                color="text-green-400"
                glow="border-green-400/25"
              />
              <StatCard
                title="In progress"
                value={inProgressTasks.length}
                sub="Currently active"
                icon={Clock}
                color="text-yellow-400"
                glow="border-yellow-400/25"
              />
              {myRank > 0 ? (
                <StatCard
                  title="Leaderboard"
                  value={`#${myRank}`}
                  sub={`of ${sortedUsers.length} contributors`}
                  icon={Trophy}
                  color="text-cyan-400"
                  glow="border-cyan-400/25"
                />
              ) : (
                <Link href="/dashboard/leaderboard" className="block">
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-dashed border-border/80 bg-card/20 p-5 transition-all hover:border-primary/40 hover:bg-card/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Leaderboard</p>
                        <p className="mt-1.5 text-lg font-semibold text-muted-foreground">Not ranked yet</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">Earn points to appear on the board →</p>
                      </div>
                      <Trophy className="size-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </section>

          {/* Progress + report */}
          <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm backdrop-blur-sm lg:col-span-3">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Monthly points</h2>
                  <p className="text-xs text-muted-foreground">Caps reset each month — keep contributing.</p>
                </div>
                <span className="font-mono text-sm text-primary">
                  {currentUser?.points ?? 0} / {MONTHLY_POINT_CAP}
                </span>
              </div>
              <Progress value={pointsPercent} className="h-3 rounded-full bg-muted/80" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{pointsPercent}% of monthly cap</span>
                <span className="tabular-nums">{Math.max(0, MONTHLY_POINT_CAP - (currentUser?.points ?? 0))} pts left</span>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 lg:col-span-2">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                  <CalendarRange className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Contribution report</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Download your monthly breakdown and CSV for records or payouts.
                  </p>
                </div>
              </div>
              <Separator className="my-4 bg-border/60" />
              <Link href="/dashboard/report" className="block">
                <Button variant="secondary" className="w-full gap-2 border border-primary/20 bg-background/80 hover:bg-background">
                  Open report
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
