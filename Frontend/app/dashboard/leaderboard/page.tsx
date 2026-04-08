'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Coins, Trophy, Zap } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { BadgeChip } from '@/components/badge-chip'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useApp } from '@/lib/app-context'
import {
  MAX_PAYOUT_INR,
  payoutTierDisplayRange,
  payoutTiersForCycle,
  monthlyPointCapForCycle,
  pointsProgressPercent,
} from '@/lib/data'
import {
  type ContributorPeriodRow,
  type ContributorPeriodsResponse,
  type LeaderboardResponse,
  leaderboardUrl,
  pickDefaultPeriodId,
} from '@/lib/contributor-cycle'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { LeaderboardPointsPayoutModal } from '@/components/leaderboard-points-payout-modal'

const RANK_COLORS = ['text-yellow-400', 'text-slate-400', 'text-amber-600']
const GLOW_CLASSES = ['neon-glow-purple border-primary/50', 'neon-glow-blue border-neon-blue/50', 'neon-glow-cyan border-accent/50']

function formatPeriodStarted(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type PayoutStatus = 'pending_admin' | 'pending_accounts' | 'paid' | 'rejected'

type MyPayoutRow = {
  _id: string
  status: PayoutStatus
  cycleLabel: string
  requestedPayoutINR: number
  createdAt: string
  contributorPeriod?: { _id?: string; sequence?: number; label?: string }
}

const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  pending_admin: 'Pending admin',
  pending_accounts: 'Pending accounts',
  paid: 'Paid',
  rejected: 'Rejected',
}

export default function LeaderboardPage() {
  const { currentUser } = useApp()
  /** Same rule as invoices: contributors submit; admin & accounts review in the hub. */
  const canRaiseInvoice = Boolean(
    currentUser?.role && !['admin', 'accounts'].includes(currentUser.role),
  )
  const [periodOptions, setPeriodOptions] = useState<ContributorPeriodRow[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [periodMeta, setPeriodMeta] = useState<LeaderboardResponse['period'] | null>(null)
  const [sorted, setSorted] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [pointsModalOpen, setPointsModalOpen] = useState(false)
  const [myPayouts, setMyPayouts] = useState<MyPayoutRow[]>([])
  const [payoutsLoading, setPayoutsLoading] = useState(false)

  const loadMyPayouts = useCallback(async () => {
    if (!canRaiseInvoice) {
      setMyPayouts([])
      return
    }
    setPayoutsLoading(true)
    try {
      const list = await apiFetch<MyPayoutRow[]>('/dashboard/payout-requests/tracking')
      setMyPayouts(Array.isArray(list) ? list : [])
    } catch {
      setMyPayouts([])
    } finally {
      setPayoutsLoading(false)
    }
  }, [canRaiseInvoice])

  useEffect(() => {
    let cancelled = false
    apiFetch<ContributorPeriodsResponse>('/dashboard/contributor-periods')
      .then((data) => {
        if (cancelled) return
        const periods = Array.isArray(data.periods) ? data.periods : []
        setPeriodOptions(periods)
        const def = pickDefaultPeriodId(periods)
        setSelectedPeriodId((prev) => prev ?? def)
      })
      .catch(() => {
        if (!cancelled) setPeriodOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedPeriodId) {
      setLoading(false)
      setSorted([])
      setPeriodMeta(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setSorted([])
    apiFetch<LeaderboardResponse>(leaderboardUrl(selectedPeriodId))
      .then((data) => {
        if (cancelled) return
        setPeriodMeta(data.period ?? null)
        setSorted(Array.isArray(data.leaderboard) ? data.leaderboard : [])
      })
      .catch(() => {
        if (!cancelled) {
          setSorted([])
          setPeriodMeta(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPeriodId])

  useEffect(() => {
    void loadMyPayouts()
  }, [loadMyPayouts, selectedPeriodId])

  useEffect(() => {
    if (!canRaiseInvoice || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('payout') === '1') {
      setPointsModalOpen(true)
      window.history.replaceState(null, '', '/dashboard/leaderboard')
    }
  }, [canRaiseInvoice, currentUser?.id])

  const payoutForSelectedCycle = selectedPeriodId
    ? myPayouts.find((p) => {
        const pid = p.contributorPeriod?._id
        return pid != null && String(pid) === String(selectedPeriodId)
      })
    : undefined

  const top3 = sorted.slice(0, 3)
  const tierTable = payoutTiersForCycle(periodMeta?.sequence)
  const tierCap = monthlyPointCapForCycle(periodMeta?.sequence)
  const periodLabel =
    periodMeta?.label ??
    periodOptions.find((p) => String(p._id) === selectedPeriodId)?.label ??
    '—'

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Leaderboard" />

      <div className="flex-1 p-6 space-y-8 max-w-4xl mx-auto w-full">
        <div className="space-y-4 text-center sm:text-left sm:flex sm:items-end sm:justify-between sm:gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-balance">Top contributors by program cycle</h2>
            <p className="text-muted-foreground text-sm max-w-xl">
              An admin starts each new cycle. Tasks created after that belong to the new cycle. Rankings sum{' '}
              <span className="font-medium text-foreground">completed</span> points for tasks tagged with that cycle.
            </p>
          </div>
          <div className="space-y-1.5 w-full sm:w-[min(100%,16rem)] shrink-0">
            <Label htmlFor="lb-cycle" className="text-xs text-muted-foreground">
              Cycle
            </Label>
            <Select
              value={selectedPeriodId ?? ''}
              onValueChange={(v) => setSelectedPeriodId(v || null)}
              disabled={periodOptions.length === 0}
            >
              <SelectTrigger id="lb-cycle" className="bg-background">
                <SelectValue placeholder={periodOptions.length ? 'Select cycle' : 'Loading…'} />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={String(p._id)} value={String(p._id)}>
                    {p.label}
                    {p.isActive ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] to-card p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Coins className="size-4 shrink-0 text-violet-500" />
              Points tier payout
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Request a payout from your <strong>cycle points</strong> tier for the selected contributor cycle. Travel
              reimbursements (events + bills) stay under{' '}
              <Link href="/dashboard/invoices" className="font-medium text-primary underline-offset-2 hover:underline">
                Invoices
              </Link>
              . Full points payout history and admin actions:{' '}
              <Link
                href="/dashboard/invoice-tracking"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Invoice tracking
              </Link>
              .
            </p>
            {canRaiseInvoice && selectedPeriodId && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">This cycle on leaderboard:</span>
                {payoutsLoading ? (
                  <span className="text-xs text-muted-foreground">Checking status…</span>
                ) : payoutForSelectedCycle ? (
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                      payoutForSelectedCycle.status === 'paid' && 'bg-green-500/15 text-green-600',
                      payoutForSelectedCycle.status === 'rejected' && 'bg-red-500/15 text-red-600',
                      payoutForSelectedCycle.status === 'pending_admin' && 'bg-amber-500/15 text-amber-700',
                      payoutForSelectedCycle.status === 'pending_accounts' && 'bg-blue-500/15 text-blue-700',
                    )}
                  >
                    {PAYOUT_STATUS_LABEL[payoutForSelectedCycle.status] ?? payoutForSelectedCycle.status}
                    <span className="ml-1 opacity-80">· ₹{payoutForSelectedCycle.requestedPayoutINR}</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">No payout submitted for this cycle yet</span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {canRaiseInvoice ? (
              <Button
                type="button"
                onClick={() => setPointsModalOpen(true)}
                className="gap-2 bg-violet-600 text-white shadow-sm hover:bg-violet-600/90 dark:bg-violet-600 dark:hover:bg-violet-600/90"
              >
                <Coins className="size-4" />
                Points payout
              </Button>
            ) : (
              <Button variant="outline" asChild className="gap-2 border-primary/35">
                <Link href="/dashboard/invoices">Invoices hub (review)</Link>
              </Button>
            )}
          </div>
        </div>

        <LeaderboardPointsPayoutModal
          open={pointsModalOpen}
          onOpenChange={setPointsModalOpen}
          selectedPeriodId={selectedPeriodId}
          canSubmit={canRaiseInvoice}
          onSubmitted={() => void loadMyPayouts()}
        />

        {periodMeta && (
          <p className="text-center sm:text-left text-sm text-muted-foreground">
            <span className="font-medium text-primary">{periodLabel}</span>
            {' · '}
            Started {formatPeriodStarted(periodMeta.startedAt)}
            {periodMeta.isActive ? (
              <span className="text-green-600 dark:text-green-400"> · Open cycle</span>
            ) : (
              <span> · Closed cycle</span>
            )}
          </p>
        )}

        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Loading leaderboard…</p>
        ) : !selectedPeriodId ? (
          <p className="text-center text-sm text-muted-foreground py-8">No contributor cycles yet.</p>
        ) : sorted.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8 rounded-2xl border border-dashed border-border/60">
            No completed tasks in this cycle yet. Try another cycle or keep contributing.
          </p>
        ) : (
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
                  <AvatarCircle
                    initials={user.initials ?? user.name?.slice(0, 2) ?? '?'}
                    src={user.avatar?.startsWith?.('http') ? user.avatar : undefined}
                    size="xl"
                    className="mx-auto mb-3"
                  />
                  <div className="font-bold text-base">
                    {user.name}
                    {isCurrentUser && <span className="text-xs text-primary ml-1">(you)</span>}
                  </div>
                  <div className="text-muted-foreground text-xs mb-4 capitalize">{user.role}</div>
                  <div className={cn('text-3xl font-bold mb-1', 'neon-text-purple')}>
                    {user.totalPoints ?? user.points ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">points (this cycle)</div>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3 text-green-400" />
                    {user.completedTasks ?? user.tasksCompleted ?? 0} tasks completed
                  </div>
                  {user.badges?.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-1">
                      {user.badges.slice(0, 2).map((b: any) => (
                        <BadgeChip key={b.id} badge={b} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="glass rounded-2xl border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">All contributors</h3>
              <span className="text-xs text-muted-foreground">{sorted.length} members</span>
            </div>
            <div className="divide-y divide-border/50">
              {sorted.map((user, i) => {
                const isCurrentUser = (user.userId ?? user.id) === currentUser?.id
                const points = user.totalPoints ?? user.points ?? 0
                const pointsPercent = pointsProgressPercent(points, tierCap)
                return (
                  <div
                    key={user.userId ?? user.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-4 transition-colors',
                      isCurrentUser ? 'bg-primary/10' : 'hover:bg-muted/20',
                    )}
                  >
                    <span
                      className={cn(
                        'w-6 text-center font-bold text-sm shrink-0',
                        i < 3 ? RANK_COLORS[i] : 'text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                    <AvatarCircle
                      initials={user.initials ?? user.name?.slice(0, 2) ?? '?'}
                      src={user.avatar?.startsWith?.('http') ? user.avatar : undefined}
                      size="sm"
                    />
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
        )}

        <div className="glass rounded-2xl border border-border/50 p-5">
          <h3 className="font-semibold mb-3 text-sm">Monthly Payout (tiered)</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Min 10 pts to qualify. Payout by total points in this cycle.
            {periodMeta?.sequence === 1 ? (
              <span className="block mt-1 text-amber-600/90 dark:text-amber-400/90">
                Cycle 1 uses the original band table (top tier at {tierCap} pts).
              </span>
            ) : null}
          </p>
          <div className="space-y-1.5 text-sm">
            {tierTable.map((t) => (
              <div key={t.min} className="flex justify-between items-center rounded-lg bg-muted/30 px-3 py-2">
                <span className="font-medium">{payoutTierDisplayRange(t)} pts</span>
                <span className="font-bold text-green-400">₹{t.amount}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Max payout ₹{MAX_PAYOUT_INR} at {tierCap}
            {tierTable.some((x) => x.max >= 1_000_000) ? '+' : ''} pts.
          </p>
        </div>
      </div>
    </div>
  )
}
