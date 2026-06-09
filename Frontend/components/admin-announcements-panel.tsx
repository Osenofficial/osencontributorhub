'use client'

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Send, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { apiFetch } from '@/lib/api'

const ROLE_OPTIONS = [
  { value: 'intern', label: 'Intern' },
  { value: 'associate', label: 'Associate' },
  { value: 'lead', label: 'Lead' },
  { value: 'evangelist', label: 'Evangelist' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'admin', label: 'Admin' },
] as const

type RoleValue = (typeof ROLE_OPTIONS)[number]['value']

type AnnouncementRow = {
  _id: string
  title: string
  message: string
  targetRoles: string[]
  recipientCount: number
  createdAt: string
  createdBy?: { name?: string; email?: string }
}

export function AdminAnnouncementsPanel() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<RoleValue[]>(['intern', 'associate', 'lead', 'evangelist'])
  const [history, setHistory] = useState<AnnouncementRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadHistory = useCallback(() => {
    setLoadingHistory(true)
    apiFetch<AnnouncementRow[]>('/admin/announcements')
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function toggleRole(role: RoleValue, checked: boolean) {
    setSelectedRoles((prev) => {
      if (checked) return prev.includes(role) ? prev : [...prev, role]
      return prev.filter((r) => r !== role)
    })
  }

  function selectAllRoles() {
    setSelectedRoles(ROLE_OPTIONS.map((r) => r.value))
  }

  function clearRoles() {
    setSelectedRoles([])
  }

  async function handleSend() {
    setError(null)
    setSuccess(null)
    setSending(true)
    try {
      const res = await apiFetch<{ recipientCount: number }>('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetRoles: selectedRoles,
        }),
      })
      setTitle('')
      setMessage('')
      setSuccess(`Announcement sent to ${res.recipientCount} active user${res.recipientCount === 1 ? '' : 's'}.`)
      setConfirmOpen(false)
      loadHistory()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send announcement')
      setConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  const canSend = title.trim().length > 0 && message.trim().length > 0 && selectedRoles.length > 0

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl border border-violet-500/25 bg-violet-500/[0.04] p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
            <Megaphone className="size-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold">Send announcement</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Broadcast to selected roles. Each recipient gets an in-app notification and an email (when email
              notifications are enabled).
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              placeholder="e.g. Monthly contributor sync — Friday 6 PM"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-message">Message</Label>
            <Textarea
              id="announcement-message"
              placeholder="Write your announcement here…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
              className="min-h-32 resize-y bg-background border-border"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Send to roles</Label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllRoles}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearRoles}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ROLE_OPTIONS.map((role) => {
                const checked = selectedRoles.includes(role.value)
                return (
                  <label
                    key={role.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleRole(role.value, v === true)}
                    />
                    <span>{role.label}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Only <span className="font-medium text-foreground">active</span> users with the selected roles receive
              this announcement.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}

          <Button
            type="button"
            disabled={!canSend || sending}
            className="gap-2 bg-primary text-primary-foreground"
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="size-4" />
            {sending ? 'Sending…' : 'Send announcement'}
          </Button>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl border">
        <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
          <History className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Recent announcements</h3>
        </div>
        <div className="divide-y divide-border/50">
          {loadingHistory ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : history.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No announcements sent yet.</p>
          ) : (
            history.map((row) => (
              <div key={row._id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{row.title}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">{row.message}</p>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>
                    To:{' '}
                    {row.targetRoles
                      .map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r)
                      .join(', ')}
                  </span>
                  <span>·</span>
                  <span>{row.recipientCount} recipient{row.recipientCount === 1 ? '' : 's'}</span>
                  {row.createdBy?.name && (
                    <>
                      <span>·</span>
                      <span>By {row.createdBy.name}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this announcement?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong>{title.trim()}</strong> will be sent to all active users with roles:{' '}
                {selectedRoles
                  .map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r)
                  .join(', ')}
                .
              </span>
              <span className="block">They will receive an in-app notification and an email.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault()
                void handleSend()
              }}
            >
              {sending ? 'Sending…' : 'Yes, send now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
