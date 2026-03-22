'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { MobileNav } from '@/components/mobile-nav'
import { useApp } from '@/lib/app-context'

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useApp()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login')
    }
  }, [loading, currentUser, router])

  useEffect(() => {
    if (loading || !currentUser) return
    if (currentUser.role !== 'accounts' && currentUser.role !== 'evangelist') return

    const allowed = [
      '/dashboard/invoices',
      '/dashboard/invoice-tracking',
      '/dashboard/profile',
      '/dashboard/notifications',
    ]
    if (!allowed.includes(pathname)) {
      router.replace('/dashboard/invoices')
    }
  }, [loading, currentUser, pathname, router])

  if (loading || !currentUser) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden min-h-0 md:flex md:shrink-0">
        <DashboardSidebar />
      </div>
      {/* Main: min-h-0 + overscroll avoids scroll chaining / jump; pb reserves space for fixed mobile nav */}
      {/* Extra bottom padding on mobile so content clears the fixed bottom nav + iOS home indicator */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] scroll-pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:scroll-pb-0 [scrollbar-gutter:stable]">
        {children}
      </main>
      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
