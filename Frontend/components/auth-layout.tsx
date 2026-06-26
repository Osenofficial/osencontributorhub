import Link from 'next/link'
import { Zap } from 'lucide-react'

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-20 size-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-10 size-80 rounded-full bg-accent/15 blur-[100px]" />

      <div className="relative w-full max-w-[420px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 shadow-lg shadow-primary/20">
            <Zap className="size-5 text-primary" />
          </div>
          <div className="text-left">
            <div className="text-base font-bold tracking-tight text-foreground">OSEN Contributor Hub</div>
            <div className="text-xs text-muted-foreground">Build together</div>
          </div>
        </Link>

        <div className="surface-card p-8 shadow-xl shadow-black/20">
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
