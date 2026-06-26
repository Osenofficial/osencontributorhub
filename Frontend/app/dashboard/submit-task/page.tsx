'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Send, Github, FileText, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { DashboardPageShell, PageCard } from '@/components/dashboard-page-shell'
import { DateTimeField, defaultDateTimeLocal } from '@/components/datetime-field'
import { TaskFormField, TaskFormSection } from '@/components/task-form-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CONTRIBUTION_TYPES, findContributionItemById, type TaskCategory } from '@/lib/contribution-types'
import { MONTHLY_POINT_CAP, MAX_PAYOUT_INR } from '@/lib/data'
import { apiFetch } from '@/lib/api'

export default function SubmitTaskPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    contributionType: '',
    category: 'community' as TaskCategory,
    points: '10',
    completedDate: defaultDateTimeLocal(),
    githubLink: '',
    notionLink: '',
    googleDoc: '',
    comments: '',
  })

  function handleContributionTypeChange(value: string) {
    const match = findContributionItemById(value)
    setForm((f) => ({
      ...f,
      contributionType: value,
      category: match ? match.category : f.category,
      points: match ? String(match.points) : f.points,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.contributionType || !form.completedDate) return
    setLoading(true)
    try {
      await apiFetch('/dashboard/contribute', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          contributionType: form.contributionType,
          category: form.category,
          points: parseInt(form.points) || 10,
          githubLink: form.githubLink || undefined,
          notionLink: form.notionLink || undefined,
          googleDoc: form.googleDoc || undefined,
          comments: form.comments || undefined,
          completedDate: form.completedDate,
        }),
      })
      setSubmitted(true)
      setForm({
        title: '',
        description: '',
        contributionType: '',
        category: 'community',
        points: '10',
        completedDate: defaultDateTimeLocal(),
        githubLink: '',
        notionLink: '',
        googleDoc: '',
        comments: '',
      })
    } catch {
      /* keep form */
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <DashboardPageShell title="Submit task" width="sm">
        <PageCard className="mx-auto max-w-md border-emerald-500/25 bg-emerald-500/[0.04] p-10 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/15">
            <CheckCircle2 className="size-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold">Submitted successfully</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your work is in review. You&apos;ll get a notification when an admin or lead approves it.
          </p>
          <Button asChild variant="outline" className="mt-6 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10">
            <Link href="/dashboard/my-tasks">View my tasks</Link>
          </Button>
          <Button variant="ghost" onClick={() => setSubmitted(false)} className="mt-3 text-muted-foreground">
            Submit another
          </Button>
        </PageCard>
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell
      title="Submit task"
      description="Completed something on your own? Submit it here for review and points."
      width="sm"
    >
      <form onSubmit={handleSubmit}>
        <PageCard className="divide-y divide-border/50 p-0">
          <div className="space-y-5 p-6">
            <TaskFormSection step={1} title="What did you complete?" description="Give reviewers a clear title and summary.">
              <div className="space-y-4">
                <TaskFormField label="Title" required>
                  <Input
                    placeholder="e.g. Edited reel for OSEN launch event"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="h-11 bg-background/80"
                    required
                  />
                </TaskFormField>
                <TaskFormField label="Description">
                  <Textarea
                    placeholder="Brief description of what you did…"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="min-h-24 resize-none bg-background/80"
                  />
                </TaskFormField>
                <DateTimeField
                  label="Date & time completed"
                  required
                  value={form.completedDate}
                  onChange={(completedDate) => setForm((f) => ({ ...f, completedDate }))}
                  hint="When you finished this work — past or future dates are allowed."
                />
              </div>
            </TaskFormSection>
          </div>

          <div className="space-y-5 bg-muted/10 p-6">
            <TaskFormSection step={2} title="Contribution type & points" description="Points auto-fill from the policy.">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                <TaskFormField label="Type" required className="min-w-0 flex-1">
                  <Select value={form.contributionType} onValueChange={handleContributionTypeChange}>
                    <SelectTrigger className="min-h-11 w-full bg-background/80">
                      <SelectValue placeholder="Choose a type…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 border-border/60 bg-popover">
                      {CONTRIBUTION_TYPES.map((group) => (
                        <div key={group.group}>
                          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.group}
                          </div>
                          {group.items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              <span className="text-sm">{item.label}</span>
                              <span className="ml-2 text-xs text-primary">{item.points} pts</span>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </TaskFormField>
                <TaskFormField label="Points" hint={`Cap ${MONTHLY_POINT_CAP}+ pts = ₹${MAX_PAYOUT_INR}`} className="w-full lg:w-36">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.points}
                    onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                    className="h-11 bg-background/80"
                  />
                </TaskFormField>
              </div>
            </TaskFormSection>
          </div>

          <div className="space-y-5 p-6">
            <TaskFormSection step={3} title="Proof & links" description="Add links so reviewers can verify your work.">
              <div className="space-y-4">
                <TaskFormField label="GitHub">
                  <Input
                    placeholder="https://github.com/…"
                    value={form.githubLink}
                    onChange={(e) => setForm((f) => ({ ...f, githubLink: e.target.value }))}
                    className="h-11 bg-background/80"
                  />
                </TaskFormField>
                <TaskFormField label="Notion">
                  <Input
                    placeholder="https://notion.so/…"
                    value={form.notionLink}
                    onChange={(e) => setForm((f) => ({ ...f, notionLink: e.target.value }))}
                    className="h-11 bg-background/80"
                  />
                </TaskFormField>
                <TaskFormField label="Google Doc">
                  <Input
                    placeholder="https://docs.google.com/…"
                    value={form.googleDoc}
                    onChange={(e) => setForm((f) => ({ ...f, googleDoc: e.target.value }))}
                    className="h-11 bg-background/80"
                  />
                </TaskFormField>
                <TaskFormField label="Notes for reviewer">
                  <Textarea
                    placeholder="Anything else we should know…"
                    value={form.comments}
                    onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                    className="min-h-20 resize-none bg-background/80"
                  />
                </TaskFormField>
              </div>
            </TaskFormSection>
          </div>

          <div className="border-t border-border/50 bg-muted/20 p-6">
            <Button
              type="submit"
              disabled={!form.title || !form.contributionType || !form.completedDate || loading}
              className="h-12 w-full gap-2 text-base font-semibold shadow-lg shadow-primary/15"
            >
              {loading ? 'Submitting…' : (
                <>
                  <Send className="size-4" /> Submit for review
                </>
              )}
            </Button>
          </div>
        </PageCard>
      </form>
    </DashboardPageShell>
  )
}
