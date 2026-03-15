'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Trophy, Zap } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { BadgeChip } from '@/components/badge-chip'
import { Progress } from '@/components/ui/progress'
import { useApp } from '@/lib/app-context'
import { MONTHLY_POINT_CAP, PAYOUT_TIERS, MAX_PAYOUT_INR } from '@/lib/data'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

const RANK_COLORS = ['text-yellow-400', 'text-slate-400', 'text-amber-600']
const GLOW_CLASSES = ['neon-glow-purple border-primary/50', 'neon-glow-blue border-neon-blue/50', 'neon-glow-cyan border-accent/50']

export default function LeaderboardPage() {
  const { currentUser } = useApp()
  const [sorted, setSorted] = useState<any[]>([])

  useEffect(() => {
    apiFetch<any[]>('/dashboard/leaderboard')
      .then(setSorted)
      .catch(() => setSorted([]))
  }, [])
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Leaderboard" />

      <div className="flex-1 p-6 space-y-8 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-balance">Top Contributors of the Month</h2>
          <p className="text-muted-foreground text-sm">Rankings based on total points earned this month.</p>
        </div>

        {/* Top 3 Podium */}
        <div className="grid gap-4 md:grid-cols-3 items-end">
          {[top3[1], top3[0], top3[2]].map((user, displayIdx) => {
            if (!user) return null
            const rank = sorted.findIndex((u) => (u.userId ?? u.id) === (user.userId ?? user.id))
            const isFirst = rank === 0
            const glowClass = GLOW_CLASSES[rank]
            const rankColor = RANK_COLORS[rank]
            const isCurrentUser = (user.userId ?? user.id) === currentUser?.id
            const delay = displayIdx * 0.3

            return (
              <div
                key={user.userId ?? user.id}
                className={cn(
                  'glass rounded-2xl border p-6 text-center transition-transform hover:-translate-y-1 animate-float relative',
                  glowClass,
                  isFirst && 'md:scale-105',
                  isCurrentUser && 'ring-1 ring-primary',
                )}
                style={{ animationDelay: `${delay}s` }}
              >
                {isFirst && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-0.5 text-xs font-bold text-yellow-400">
                    <Trophy className="size-3" /> Leader
                  </div>
                )}
                <div className={cn('text-4xl font-bold mb-3', rankColor)}>#{rank + 1}</div>
                <AvatarCircle initials={user.initials ?? user.name?.slice(0, 2) ?? '?'} src={user.avatar?.startsWith?.('http') ? user.avatar : undefined} size="xl" className="mx-auto mb-3" />
                <div className="font-bold text-base">
                  {user.name}
                  {isCurrentUser && <span className="text-xs text-primary ml-1">(you)</span>}
                </div>
                <div className="text-muted-foreground text-xs mb-4 capitalize">{user.role}</div>
                <div className={cn('text-3xl font-bold mb-1', 'neon-text-purple')}>{user.totalPoints ?? user.points ?? 0}</div>
                <div className="text-xs text-muted-foreground mb-3">points</div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3 text-green-400" />
                  {user.completedTasks ?? user.tasksCompleted ?? 0} tasks completed
                </div>
                {user.badges?.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {user.badges.slice(0, 2).map((b) => (
                      <BadgeChip key={b.id} badge={b} size="sm" />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rest of the table */}
        <div className="glass rounded-2xl border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-sm">All Contributors</h3>
            <span className="text-xs text-muted-foreground">{sorted.length} members</span>
          </div>
          <div className="divide-y divide-border/50">
            {sorted.map((user, i) => {
              const isCurrentUser = (user.userId ?? user.id) === currentUser?.id
              const points = user.totalPoints ?? user.points ?? 0
              const pointsPercent = Math.round((points / MONTHLY_POINT_CAP) * 100)
              return (
                <div
                  key={user.userId ?? user.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-4 transition-colors',
                    isCurrentUser ? 'bg-primary/10' : 'hover:bg-muted/20',
                  )}
                >
                  <span className={cn('w-6 text-center font-bold text-sm shrink-0', i < 3 ? RANK_COLORS[i] : 'text-muted-foreground')}>
                    {i + 1}
                  </span>
                  <AvatarCircle initials={user.initials ?? user.name?.slice(0, 2) ?? '?'} src={user.avatar?.startsWith?.('http') ? user.avatar : undefined} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-sm font-medium', isCurrentUser && 'text-primary')}>
                        {user.name}
                      </span>
                      {isCurrentUser && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={pointsPercent} className="h-1 flex-1 max-w-32 bg-muted" />
                      <span className="text-[10px] text-muted-foreground">{pointsPercent}%</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <CheckCircle2 className="size-3 text-green-400" />
                    {user.completedTasks ?? user.tasksCompleted ?? 0}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Zap className="size-3.5 text-primary" />
                    <span className="font-bold text-sm text-primary">{user.totalPoints ?? user.points ?? 0}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payout tiers */}
        <div className="glass rounded-2xl border border-border/50 p-5">
          <h3 className="font-semibold mb-3 text-sm">Monthly Payout (tiered)</h3>
          <p className="text-xs text-muted-foreground mb-3">Min 10 pts to qualify. Payout by total monthly points.</p>
          <div className="space-y-1.5 text-sm">
            {PAYOUT_TIERS.map((t) => (
              <div key={t.min} className="flex justify-between items-center rounded-lg bg-muted/30 px-3 py-2">
                <span className="font-medium">{t.min === t.max ? t.min : `${t.min}-${t.max}`} pts</span>
                <span className="font-bold text-green-400">₹{t.amount}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Cap: {MONTHLY_POINT_CAP} pts = ₹{MAX_PAYOUT_INR}</p>
        </div>
      </div>
    </div>
  )
}
