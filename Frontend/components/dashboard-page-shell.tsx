'use client'

import { DashboardTopbar } from '@/components/dashboard-topbar'
import { cn } from '@/lib/utils'

type DashboardPageShellProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  /** default: 3xl | lg: 5xl | xl: 6xl | full: none */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

const WIDTH = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  full: 'max-w-none',
} as const

export function DashboardPageShell({
  title,
  description,
  actions,
  children,
  width = 'lg',
  className,
}: DashboardPageShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <DashboardTopbar title={title} />
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        <div
          className={cn(
            'page-container relative',
            WIDTH[width],
            className,
          )}
        >
          {(description || actions) && (
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              {description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : (
                <span />
              )}
              {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
            </header>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

export function PageCard({
  children,
  className,
  glow,
}: {
  children: React.ReactNode
  className?: string
  glow?: 'primary' | 'none'
}) {
  return (
    <div
      className={cn(
        'surface-card',
        glow === 'primary' && 'border-primary/25 shadow-lg shadow-primary/5',
        className,
      )}
    >
      {children}
    </div>
  )
}
