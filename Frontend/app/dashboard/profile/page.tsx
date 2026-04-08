'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Zap, Calendar } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { AvatarCircle } from '@/components/avatar-circle'
import { BadgeChip } from '@/components/badge-chip'
import { StatusBadge } from '@/components/status-badge'
import { Progress } from '@/components/ui/progress'
import { useApp } from '@/lib/app-context'
import { getPayoutForPoints, BADGES, pointsProgressPercent, monthlyPointCapForCycle } from '@/lib/data'
import { type LeaderboardResponse, leaderboardUrl } from '@/lib/contributor-cycle'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function ProfilePage() {
  const { currentUser, refreshUser } = useApp()
  const [tasks, setTasks] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [activeCycleSequence, setActiveCycleSequence] = useState<number | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const [position, setPosition] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [customInterest, setCustomInterest] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser?.id) return
    apiFetch<any[]>('/dashboard/tasks')
      .then(setTasks)
      .catch(() => setTasks([]))
    apiFetch<LeaderboardResponse>(leaderboardUrl(null))
      .then((data) => {
        setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : [])
        setActiveCycleSequence(data.period?.sequence)
      })
      .catch(() => {
        setLeaderboard([])
        setActiveCycleSequence(undefined)
      })
  }, [currentUser?.id])

  const INTEREST_OPTIONS = [
    'Designing',
    'Video editor',
    'Non technical work',
    'Docs improvement',
    'Frontend design',
    'Backend',
    'MERN',
    'Community',
    'Research',
  ]

  const myTasks = tasks
  const completed = myTasks.filter((t) => t.status === 'completed')
  const inProgress = myTasks.filter((t) => t.status === 'in_progress')
  const myRank =
    leaderboard.findIndex((u) => String(u.userId ?? u.id) === String(currentUser?.id)) + 1
  const monthlyCap = monthlyPointCapForCycle(activeCycleSequence)
  const pointsPercent = pointsProgressPercent(currentUser?.points ?? 0, monthlyCap)

  const categoryBreakdown = myTasks.reduce<Record<string, number>>((acc, task) => {
    if (task.status === 'completed') {
      acc[task.category] = (acc[task.category] ?? 0) + (task.points || 0)
    }
    return acc
  }, {})

  const userBadges = (currentUser?.badges as string[] | undefined)?.map(
    (id) => BADGES.find((b) => b.id === id)
  ).filter(Boolean) ?? []

  useEffect(() => {
    if (!editOpen || !currentUser?.id) return
    setPosition(currentUser.position || '')
    setSelectedInterests(currentUser.interests || [])
    setCustomInterest('')
  }, [editOpen, currentUser?.id])

  function toggleInterest(interest: string) {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((x) => x !== interest)
      return [...prev, interest]
    })
  }

  function addCustomInterest() {
    const trimmed = customInterest.trim()
    if (!trimmed) return
    toggleInterest(trimmed)
    setCustomInterest('')
  }

  async function handleSaveProfile() {
    if (!currentUser?.id) return
    setSaving(true)
    try {
      await apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          position: position.trim(),
          interests: selectedInterests,
        }),
      })
      setEditOpen(false)
      await refreshUser()
    } catch {
      // ignore - backend will respond with message, but we keep UI simple
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="My Profile" />

      <div className="flex-1 p-6 space-y-6 max-w-4xl mx-auto w-full">
        <div className="glass rounded-2xl border border-primary/20 p-6 neon-glow-purple">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <AvatarCircle
              initials={currentUser?.avatar ?? '?'}
              src={currentUser?.avatarSrc}
              size="xl"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{currentUser?.name}</h2>
              <p className="text-muted-foreground text-sm mt-0.5 capitalize">{currentUser?.role} &middot; {currentUser?.email}</p>
              <p className="text-sm mt-2 leading-relaxed text-foreground/80">{currentUser?.bio || 'No bio yet.'}</p>

              <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Position</div>
                  <div className="font-medium text-foreground/90">{currentUser?.position || '—'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Interests</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(currentUser?.interests || []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">No interests yet.</span>
                    ) : (
                      currentUser?.interests.map((i) => (
                        <span
                          key={i}
                          className="text-xs rounded-full border border-border/60 bg-background/40 px-2 py-0.5"
                        >
                          {i}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Button size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
                  Edit Profile
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>Joined {currentUser?.joinedAt ? new Date(currentUser.joinedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 glass rounded-xl border p-4 shrink-0 text-center">
              <div className="text-3xl font-bold neon-text-purple">{currentUser?.points ?? 0}</div>
              <div className="text-xs text-muted-foreground">total points</div>
              <div className="text-sm font-medium text-green-400 mt-1">
                {(() => {
                  const { amount, tierLabel } = getPayoutForPoints(currentUser?.points ?? 0, activeCycleSequence)
                  return amount > 0 ? `Payout: ₹${amount} (${tierLabel})` : tierLabel
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Dialog */}
        <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Position</label>
                <Input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Community Manager, Video Editor, Frontend Developer..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((opt) => {
                    const active = selectedInterests.includes(opt)
                    return (
                      <Button
                        key={opt}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleInterest(opt)}
                      >
                        {opt}
                      </Button>
                    )
                  })}
                </div>

                <div className="pt-2 space-y-2">
                  <label className="text-xs text-muted-foreground">Other (optional)</label>
                  <div className="flex gap-2">
                    <Input
                      value={customInterest}
                      onChange={(e) => setCustomInterest(e.target.value)}
                      placeholder="Type custom interest and click Add"
                    />
                    <Button type="button" variant="outline" onClick={addCustomInterest} disabled={!customInterest.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={saving} className="gap-1.5">
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: 'Tasks Done', value: completed.length, color: 'text-green-400' },
            { label: 'In Progress', value: inProgress.length, color: 'text-blue-400' },
            { label: 'Total Points', value: currentUser?.points ?? 0, color: 'text-primary' },
            {
              label: 'Rank (current cycle)',
              value: myRank > 0 ? `#${myRank}` : '—',
              color: 'text-yellow-400',
            },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl border p-4 text-center">
              <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Monthly Points Progress</h3>
            <span className="font-mono text-sm text-primary">{currentUser?.points ?? 0} / {monthlyCap}</span>
          </div>
          <Progress value={pointsPercent} className="h-2.5 bg-muted" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{pointsPercent}% of monthly cap reached</span>
            <span>{Math.max(0, monthlyCap - (currentUser?.points ?? 0))} pts to cap</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass rounded-2xl border p-5">
            <h3 className="font-semibold mb-4">Badges</h3>
            {userBadges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No badges earned yet. Complete tasks to unlock badges!</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {userBadges.map((badge) => badge && <BadgeChip key={badge.id} badge={badge} />)}
              </div>
            )}
          </div>

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
                      <Progress value={Math.round((pts / (currentUser?.points || 1)) * 100)} className="h-1.5 bg-muted" />
                    </div>
                    <span className="text-sm font-mono text-primary w-12 text-right">{pts} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl border p-5">
          <h3 className="font-semibold mb-4">Contribution History</h3>
          <div className="space-y-3">
            {myTasks.filter((t) => t.status === 'completed' || t.status === 'submitted').length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
            ) : (
              myTasks
                .filter((t) => t.status === 'completed' || t.status === 'submitted')
                .map((task) => (
                  <div key={task._id} className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/30 px-4 py-3">
                    <CheckCircle2 className={cn('size-4 mt-0.5 shrink-0', task.status === 'completed' ? 'text-green-400' : 'text-yellow-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge value={task.category} type="category" />
                        <span className="text-xs text-muted-foreground">
                          {task.deadline ? new Date(task.deadline).toLocaleDateString('en-IN') : '—'}
                        </span>
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
