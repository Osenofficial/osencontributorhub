'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** Shared tabs when invoices are split across submit/review vs tracking routes. */
export function InvoiceHubNav() {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap gap-1 border-b border-border/50 bg-muted/15 px-4 sm:px-6">
      <Link
        href="/dashboard/invoices"
        className={cn(
          '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
          pathname === '/dashboard/invoices'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        Submit & review
      </Link>
      <Link
        href="/dashboard/invoice-tracking"
        className={cn(
          '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
          pathname === '/dashboard/invoice-tracking'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground',
        )}
      >
        Tracking
      </Link>
    </div>
  )
}
