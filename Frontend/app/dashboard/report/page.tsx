'use client'

import { useState } from 'react'
import { Search, CalendarRange } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/app-context'
import { apiFetch } from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

type ReportTask = {
  _id: string
  title: string
  status: string
  category: string
  points: number
  createdAt: string
}

type ReportResponse = {
  user: { id: string; name: string; email: string; role: string }
  range: { from: string | null; to: string | null }
  summary: {
    taskCount: number
    totalPoints: number
    byStatus: Record<string, number>
  }
  tasks: ReportTask[]
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReportPage() {
  const { currentUser } = useApp()
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReportResponse | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setReport(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const data = await apiFetch<ReportResponse>(`/dashboard/report?${params.toString()}`)
      setReport(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Contribution Report" />

      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
        <form onSubmit={handleSearch} className="glass rounded-2xl border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Check Contribution History</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter an email or name (optional) and a date range to see all tasks completed in that period.
            Leave the search box empty to see your own work.
          </p>
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              placeholder={`Search by email or name (default: ${currentUser?.email})`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-input border-border/60 text-sm"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'justify-start text-left text-xs font-normal bg-input border-border/60',
                    !from && 'text-muted-foreground',
                  )}
                >
                  <span>From: {from ? formatDate(from) : 'Select date'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={from ? new Date(from) : undefined}
                  onSelect={(date) => {
                    if (!date) return
                    setFrom(date.toISOString().slice(0, 10))
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'justify-start text-left text-xs font-normal bg-input border-border/60',
                    !to && 'text-muted-foreground',
                  )}
                >
                  <span>To: {to ? formatDate(to) : 'Select date'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={to ? new Date(to) : undefined}
                  onSelect={(date) => {
                    if (!date) return
                    setTo(date.toISOString().slice(0, 10))
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button type="submit" className="gap-1.5" disabled={loading}>
              <Search className="size-3.5" />
              {loading ? 'Loading…' : 'View'}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        {report && (
          <div className="space-y-4">
            <div className="glass rounded-2xl border p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Summary for {report.user.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {report.user.email} · {report.user.role}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="glass rounded-xl border px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Tasks</div>
                  <div className="text-sm font-semibold">{report.summary.taskCount}</div>
                </div>
                <div className="glass rounded-xl border px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Points</div>
                  <div className="text-sm font-semibold text-primary">{report.summary.totalPoints}</div>
                </div>
                <div className="glass rounded-xl border px-3 py-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Range</div>
                  <div className="text-xs">
                    {formatDate(report.range.from)} – {formatDate(report.range.to)}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Tasks in range</h3>
                <span className="text-xs text-muted-foreground">{report.tasks.length} items</span>
              </div>
              {report.tasks.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No tasks found for this range.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {report.tasks.map((task) => (
                    <div key={task._id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(task.createdAt)} · {task.points} pts
                        </p>
                      </div>
                      <StatusBadge value={task.category as any} type="category" />
                      <StatusBadge value={task.status as any} type="status" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

