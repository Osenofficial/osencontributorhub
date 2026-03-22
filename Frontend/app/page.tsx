'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ClipboardList, Trophy, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingNav, LandingFooter } from '@/components/landing-nav'
import { apiFetch } from '@/lib/api'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'

const HOW_IT_WORKS = [
  { icon: Users, title: 'Join the Community', description: 'Create your OSEN profile and become part of a thriving developer community.', color: 'text-neon-purple', glow: 'neon-glow-purple', border: 'border-primary/30' },
  { icon: ClipboardList, title: 'Pick Up Tasks', description: 'Browse and get assigned tasks across development, design, content, and research.', color: 'text-neon-cyan', glow: 'neon-glow-cyan', border: 'border-accent/30' },
  { icon: Trophy, title: 'Earn Points & Rewards', description: 'Complete tasks to earn points. Payout by monthly tier (10+ pts to qualify, up to ₹5000/month).', color: 'text-yellow-400', glow: '', border: 'border-yellow-400/30' },
]

export default function LandingPage() {
  const { currentUser, loading: authLoading } = useApp()
  const [stats, setStats] = useState<{ totalUsers: number; completedTasks: number; monthlyCapValue: number; pointValue: number; monthlyCap: number } | null>(null)

  useEffect(() => {
    apiFetch<any>('/public/stats')
      .then(setStats)
      .catch(() => setStats(null))
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
            {authLoading ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-11 w-40 animate-pulse rounded-md bg-muted/60" />
                <div className="h-11 w-36 animate-pulse rounded-md bg-muted/40" />
              </div>
            ) : currentUser ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-purple gap-2 px-8">
                  Go to Dashboard <ArrowRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-purple gap-2 px-8">
                    Get Started <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-border gap-2 px-8">
                    Login
                  </Button>
                </Link>
              </>
            )}
            {!authLoading && (
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="border-border gap-2 px-8">
                  Learn More
                </Button>
              </a>
            )}
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

      <LandingFooter />
    </div>
  )
}
