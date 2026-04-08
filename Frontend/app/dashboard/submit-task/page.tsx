'use client'

import { useState } from 'react'
import { Send, Github, FileText, Link as LinkIcon, CheckCircle2, Sparkles } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
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
    if (!form.title || !form.contributionType) return
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
        }),
      })
      setSubmitted(true)
      setForm({
        title: '',
        description: '',
        contributionType: '',
        category: 'community',
        points: '10',
        githubLink: '',
        notionLink: '',
        googleDoc: '',
        comments: '',
      })
    } catch {
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col min-h-full">
        <DashboardTopbar title="Submit Task" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="max-w-md w-full glass rounded-2xl border border-green-400/20 bg-green-400/5 p-8 text-center space-y-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-400/20 border border-green-400/30 mx-auto">
              <CheckCircle2 className="size-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Submitted successfully!</h2>
            <p className="text-sm text-muted-foreground">
              Your contribution has been submitted for review. An admin or lead will review it and approve it soon.
            </p>
            <Button
              variant="outline"
              onClick={() => setSubmitted(false)}
              className="border-green-400/30 text-green-400 hover:bg-green-400/10"
            >
              Submit another
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Submit Task" />

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-bold">Submit your completed work</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Did you complete a contribution on your own (not assigned)? Submit it here for review. Points and payout follow the OSEN rewards policy.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass rounded-2xl border p-6 space-y-4">
            <h3 className="font-semibold text-sm">What did you complete?</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. Edited reel for OSEN launch event"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Brief description of what you did..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-background border-border min-h-20 resize-none"
              />
            </div>
          </div>

          <div className="glass rounded-2xl border p-6 space-y-4">
            <h3 className="font-semibold text-sm">Contribution type & points</h3>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
              <div className="min-w-0 flex-1 space-y-2">
                <label className="text-sm font-medium">Contribution type <span className="text-destructive">*</span></label>
                <Select value={form.contributionType} onValueChange={handleContributionTypeChange}>
                  <SelectTrigger className="h-auto min-h-10 w-full min-w-0 bg-background border-border py-2.5 whitespace-normal !w-full items-start [&_[data-slot=select-value]]:whitespace-normal [&_[data-slot=select-value]]:text-left [&_[data-slot=select-value]]:items-start">
                    <SelectValue placeholder="Choose a type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-72">
                    {CONTRIBUTION_TYPES.map((group) => (
                      <div key={group.group}>
                        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                          {group.group}
                        </div>
                        {group.items.map((item) => (
                          <SelectItem key={item.id} value={item.id} className="py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm">{item.label}</span>
                              <span className="text-xs text-primary font-medium">{item.points} pts</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full shrink-0 space-y-2 lg:w-36">
                <label className="text-sm font-medium">Points</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                  className="w-full bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Payout by monthly points tier (min 10 pts) · Cap {MONTHLY_POINT_CAP}+ pts = ₹{MAX_PAYOUT_INR}
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl border p-6 space-y-4">
            <h3 className="font-semibold text-sm">Proof / Links</h3>
            <p className="text-xs text-muted-foreground">Add links to your work (GitHub, Notion, Google Doc, etc.) so reviewers can verify.</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Github className="size-3" /> GitHub
                </label>
                <Input
                  placeholder="https://github.com/..."
                  value={form.githubLink}
                  onChange={(e) => setForm((f) => ({ ...f, githubLink: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="size-3" /> Notion
                </label>
                <Input
                  placeholder="https://notion.so/..."
                  value={form.notionLink}
                  onChange={(e) => setForm((f) => ({ ...f, notionLink: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <FileText className="size-3" /> Google Doc
                </label>
                <Input
                  placeholder="https://docs.google.com/..."
                  value={form.googleDoc}
                  onChange={(e) => setForm((f) => ({ ...f, googleDoc: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Comments</label>
                <Textarea
                  placeholder="Any additional notes for the reviewer..."
                  value={form.comments}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                  className="bg-background border-border min-h-16 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!form.title || !form.contributionType || loading}
              className="flex-1 bg-primary text-primary-foreground gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Submitting...</span>
              ) : (
                <>
                  <Send className="size-4" /> Submit for review
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
