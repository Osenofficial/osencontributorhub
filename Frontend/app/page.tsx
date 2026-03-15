'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ClipboardList, Trophy, Users, Zap, Star, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingNav, LandingFooter } from '@/components/landing-nav'
import { AvatarCircle } from '@/components/avatar-circle'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

const HOW_IT_WORKS = [
  { icon: Users, title: 'Join the Community', description: 'Create your OSEN profile and become part of a thriving developer community.', color: 'text-neon-purple', glow: 'neon-glow-purple', border: 'border-primary/30' },
  { icon: ClipboardList, title: 'Pick Up Tasks', description: 'Browse and get assigned tasks across development, design, content, and research.', color: 'text-neon-cyan', glow: 'neon-glow-cyan', border: 'border-accent/30' },
  { icon: Trophy, title: 'Earn Points & Rewards', description: 'Complete tasks to earn points. Payout by monthly tier (10+ pts to qualify, up to ₹5000/month).', color: 'text-yellow-400', glow: '', border: 'border-yellow-400/30' },
]

const CONTRIBUTION_TYPES = [
  { name: 'Development', icon: '⌨', description: 'Build features, APIs, and tools', points: '10-15 pts', color: 'border-blue-400/30 bg-blue-400/5' },
  { name: 'Design', icon: '✦', description: 'UI/UX mockups, brand assets, icons', points: '8-13 pts', color: 'border-pink-400/30 bg-pink-400/5' },
  { name: 'Content', icon: '✎', description: 'Newsletters, blogs, social media', points: '5-8 pts', color: 'border-yellow-400/30 bg-yellow-400/5' },
  { name: 'Community', icon: '◎', description: 'Events, AMAs, moderation', points: '6-10 pts', color: 'border-green-400/30 bg-green-400/5' },
  { name: 'Research', icon: '◈', description: 'Reports, documentation, analysis', points: '8-12 pts', color: 'border-cyan-400/30 bg-cyan-400/5' },
]

export default function LandingPage() {
  const [stats, setStats] = useState<{ totalUsers: number; completedTasks: number; monthlyCapValue: number; pointValue: number; monthlyCap: number } | null>(null)
  const [topUsers, setTopUsers] = useState<any[]>([])

  useEffect(() => {
    apiFetch<any>('/public/stats')
      .then(setStats)
      .catch(() => setStats(null))
    apiFetch<any[]>('/public/leaderboard')
      .then(setTopUsers)
      .catch(() => setTopUsers([]))
  }, [])

  const displayStats = [
    { value: stats ? `${stats.totalUsers}+` : '—', label: 'Active Contributors' },
    { value: stats ? `${stats.completedTasks}+` : '—', label: 'Tasks Completed' },
    { value: stats ? `₹${stats.monthlyCapValue}` : '—', label: 'Monthly Cap Value' },
  ]

  return (
    <div className="min-h-screen">
      <LandingNav />

      <section className="relative grid-bg pt-36 pb-28 overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 size-80 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
            <Zap className="size-3.5 animate-pulse-glow" />
            <span>Built for the OSEN Community</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-balance md:text-7xl">
            <span className="animate-shimmer">OSEN</span>{' '}
            <span className="text-foreground">Contributor Hub</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed text-pretty">
            A platform for managing contributions, tasks, and rewards inside the OSEN community.
            Manage Tasks. Empower Contributors. Build Together.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-purple gap-2 px-8">
                Get Started <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="border-border gap-2 px-8">
                Learn More
              </Button>
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 divide-x divide-border/50 overflow-hidden rounded-2xl border border-border/50 glass">
            {displayStats.map((stat) => (
              <div key={stat.label} className="py-6 px-4 text-center">
                <div className="text-2xl font-bold neon-text-purple">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl text-balance">How It Works</h2>
            <p className="text-muted-foreground text-pretty">Three simple steps to start contributing and earning.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.title} className={cn('glass rounded-2xl border p-6 transition-transform hover:-translate-y-1', step.border)}>
                <div className={cn('mb-4 flex size-12 items-center justify-center rounded-xl border bg-background/50', step.border)}>
                  <step.icon className={cn('size-5', step.color)} />
                </div>
                <div className="mb-1 text-xs font-mono text-muted-foreground">Step 0{HOW_IT_WORKS.indexOf(step) + 1}</div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contributions" className="py-24 bg-card/30">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl text-balance">Contribution System</h2>
            <p className="text-muted-foreground text-pretty">
              Every type of contribution counts. Earn points for real work, redeemable for real value.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CONTRIBUTION_TYPES.map((type) => (
              <div key={type.name} className={cn('glass rounded-2xl border p-5 transition-transform hover:-translate-y-1', type.color)}>
                <div className="mb-3 text-2xl">{type.icon}</div>
                <h3 className="mb-1 font-semibold">{type.name}</h3>
                <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{type.description}</p>
                <div className="text-xs font-mono text-primary">{type.points}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 glass rounded-2xl border border-primary/20 p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Points Value</h3>
                <p className="text-muted-foreground text-sm">Your contributions translate to real monetary value each month.</p>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold neon-text-purple">1 pt</div>
                  <div className="text-sm text-muted-foreground mt-1">= ₹{stats?.pointValue ?? 50}</div>
                </div>
                <div className="w-px bg-border/50" />
                <div className="text-center">
                  <div className="text-3xl font-bold neon-text-cyan">{stats?.monthlyCap ?? 100}</div>
                  <div className="text-sm text-muted-foreground mt-1">Monthly cap</div>
                </div>
                <div className="w-px bg-border/50" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">₹{stats?.monthlyCapValue ?? 5000}</div>
                  <div className="text-sm text-muted-foreground mt-1">Max monthly</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="leaderboard" className="py-24">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-3xl font-bold md:text-4xl text-balance">Top Contributors</h2>
            <p className="text-muted-foreground text-pretty">The best builders rise to the top. Will you be next?</p>
          </div>

          {topUsers.length === 0 ? (
            <div className="glass rounded-2xl border p-12 text-center">
              <p className="text-muted-foreground">No contributors yet. Be the first!</p>
              <Link href="/register" className="mt-4 inline-block">
                <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 gap-2">
                  Join Now
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                {topUsers.slice(0, 3).map((user, i) => {
                  const glowClass = i === 0 ? 'neon-glow-purple border-primary/50' : i === 1 ? 'neon-glow-blue border-neon-blue/50' : 'neon-glow-cyan border-accent/50'
                  const rankColors = ['text-yellow-400', 'text-slate-400', 'text-amber-600']
                  const order = i === 0 ? 'md:order-2' : i === 1 ? 'md:order-1' : 'md:order-3'
                  const scale = i === 0 ? 'md:scale-105' : ''
                  const initials = user.initials ?? user.name?.slice(0, 2) ?? '?'
                  const avatarSrc = user.avatar?.startsWith('http') ? user.avatar : null
                  return (
                    <div key={user.userId} className={cn('glass rounded-2xl border p-6 text-center transition-transform hover:-translate-y-1 animate-float', glowClass, order, scale)}>
                      <div className={cn('mb-2 text-3xl font-bold', rankColors[i])}>#{user.rank ?? i + 1}</div>
                      <AvatarCircle initials={initials} src={avatarSrc} size="lg" className="mx-auto mb-3" />
                      <div className="font-semibold">{user.name}</div>
                      <div className="mt-1 text-2xl font-bold neon-text-purple">{user.totalPoints ?? user.points ?? 0}</div>
                      <div className="text-xs text-muted-foreground">points</div>
                      <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="size-3 text-green-400" />
                        {user.completedTasks ?? user.tasksCompleted ?? 0} tasks
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="glass rounded-2xl border overflow-hidden">
                {topUsers.slice(3).map((user, i) => {
                  const initials = user.initials ?? user.name?.slice(0, 2) ?? '?'
                  const avatarSrc = user.avatar?.startsWith('http') ? user.avatar : null
                  return (
                    <div key={user.userId} className={cn('flex items-center gap-4 px-5 py-3.5 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors')}>
                      <span className="w-6 text-center text-sm font-bold text-muted-foreground">#{user.rank ?? i + 4}</span>
                      <AvatarCircle initials={initials} src={avatarSrc} size="sm" />
                      <span className="flex-1 text-sm font-medium">{user.name}</span>
                      <span className="text-sm font-bold text-primary">{user.totalPoints ?? user.points ?? 0} pts</span>
                      <span className="text-xs text-muted-foreground hidden sm:block">{user.completedTasks ?? 0} tasks</span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 text-center">
                <Link href="/dashboard/leaderboard">
                  <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 gap-2">
                    <TrendingUp className="size-4" /> View Full Leaderboard
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="glass rounded-3xl border border-primary/20 p-10 md:p-14 neon-glow-purple relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-primary/5" />
            <Star className="mx-auto mb-4 size-8 text-primary" />
            <h2 className="mb-4 text-3xl font-bold md:text-4xl text-balance">Ready to Contribute?</h2>
            <p className="mb-8 text-muted-foreground text-pretty">
              Join the OSEN community, pick up tasks, and start earning rewards for your work.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-purple gap-2 px-10">
                Launch Dashboard <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
