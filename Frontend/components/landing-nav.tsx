'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const { currentUser, loading } = useApp()
  const isLoggedIn = Boolean(currentUser)

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <nav className="glass flex items-center justify-between rounded-2xl border px-5 py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/40 neon-glow-purple">
              <Zap className="size-4 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight neon-text-purple">OSEN</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
            <Link href="/dashboard/leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Leaderboard
            </Link>
          </div>

          {/* Actions */}
          <div className="hidden items-center gap-3 md:flex">
            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted/50" aria-hidden />
            ) : isLoggedIn ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-purple">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-purple">
                    Join OSEN
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>

        {/* Mobile menu */}
        {open && (
          <div className="glass mt-2 rounded-2xl border px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#how-it-works" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>How it Works</a>
              <Link href="/dashboard/leaderboard" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Leaderboard</Link>
              <div className="mt-2 flex flex-col gap-2">
                {loading ? (
                  <div className="h-9 w-full animate-pulse rounded-md bg-muted/50" aria-hidden />
                ) : isLoggedIn ? (
                  <Link href="/dashboard" className="w-full" onClick={() => setOpen(false)}>
                    <Button size="sm" className="w-full bg-primary neon-glow-purple">Dashboard</Button>
                  </Link>
                ) : (
                  <div className="flex gap-3">
                    <Link href="/login" className="flex-1" onClick={() => setOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full border-border">Login</Button>
                    </Link>
                    <Link href="/register" className="flex-1" onClick={() => setOpen(false)}>
                      <Button size="sm" className="w-full bg-primary neon-glow-purple">Join OSEN</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/40">
              <Zap className="size-3.5 text-primary" />
            </div>
            <span className="font-bold neon-text-purple">OSEN</span>
            <span className="text-muted-foreground text-sm ml-1">Contributor Hub</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              LinkedIn
            </a>
            <a href="https://x.com" target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              X (Twitter)
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Instagram
            </a>
          </div>
          <p className="text-muted-foreground text-xs">
            &copy; {new Date().getFullYear()} OSEN. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
