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
type AudienceMode = 'all_active' | 'roles'

type AnnouncementRow = {
  _id: string
  title: string
  message: string
  targetRoles: string[]
  recipientCount: number
  createdAt: string
  createdBy?: { name?: string; email?: string }
}

type RecipientPreview = {
  count: number
  allActive?: boolean
  excludeAdmins?: boolean
  byRole: Array<{ role: string; count: number }>
}

type SendResult = {
  recipientCount: number
  notificationsCreated: number
  emailsSent: number
  emailsFailed: number
  emailsSkipped: number
  emailErrors?: string[]
  audience?: string
}

export function AdminAnnouncementsPanel() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all_active')
  const [excludeAdmins, setExcludeAdmins] = useState(true)
  const [selectedRoles, setSelectedRoles] = useState<RoleValue[]>(
    ROLE_OPTIONS.map((r) => r.value),
  )
  const [history, setHistory] = useState<AnnouncementRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

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

  useEffect(() => {
    setLoadingPreview(true)
    const url =
      audienceMode === 'all_active'
        ? `/admin/announcements/recipient-count?allActive=true&excludeAdmins=${excludeAdmins}`
        : selectedRoles.length === 0
          ? null
          : `/admin/announcements/recipient-count?roles=${encodeURIComponent(selectedRoles.join(','))}`

    if (!url) {
      setRecipientPreview(null)
      setLoadingPreview(false)
      return
    }

    apiFetch<RecipientPreview>(url)
      .then(setRecipientPreview)
      .catch(() => setRecipientPreview(null))
      .finally(() => setLoadingPreview(false))
  }, [audienceMode, excludeAdmins, selectedRoles])

  function toggleRole(role: RoleValue, checked: boolean) {
    setSelectedRoles((prev) => {
      if (checked) return prev.includes(role) ? prev : [...prev, role]
      return prev.filter((r) => r !== role)
    })
  }

  async function handleSend() {
    setError(null)
    setSuccess(null)
    setSending(true)
    try {
      const res = await apiFetch<SendResult>('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          audience: audienceMode === 'all_active' ? 'all_active' : 'roles',
          excludeAdmins: audienceMode === 'all_active' ? excludeAdmins : false,
          targetRoles: audienceMode === 'roles' ? selectedRoles : undefined,
        }),
      })
      setTitle('')
      setMessage('')
      let msg = `${res.recipientCount} people notified, ${res.emailsSent} email${res.emailsSent === 1 ? '' : 's'} sent.`
      if (res.emailsFailed > 0) {
        msg += ` ${res.emailsFailed} failed.`
      }
      if (res.emailsSkipped > 0) {
        msg += ` ${res.emailsSkipped} skipped.`
      }
      setSuccess(msg)
      if (res.emailErrors?.length) {
        setError(res.emailErrors.join(' · '))
      }
      setConfirmOpen(false)
      loadHistory()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send announcement')
      setConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  const canSend =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (audienceMode === 'all_active' || selectedRoles.length > 0)

  return (
    <div className="space-y-6">
      <div className="surface-card border-violet-500/20 bg-violet-500/[0.04] p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15">
            <Megaphone className="size-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold">Send announcement</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Everyone selected gets an in-app notification and an email.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              placeholder="e.g. May work — please raise your invoice"
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

          <div className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-4">
            <Label>Who should receive this?</Label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAudienceMode('all_active')}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  audienceMode === 'all_active'
                    ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border/60 bg-card/40 hover:bg-muted/30'
                }`}
              >
                <p className="text-sm font-medium">All active members</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Everyone approved — same as Users tab (14 members).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAudienceMode('roles')}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  audienceMode === 'roles'
                    ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/30'
                    : 'border-border/60 bg-card/40 hover:bg-muted/30'
                }`}
              >
                <p className="text-sm font-medium">Specific roles only</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  e.g. only Associates, only Leads, only Evangelists…
                </p>
              </button>
            </div>

            {audienceMode === 'all_active' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={excludeAdmins} onCheckedChange={(v) => setExcludeAdmins(v === true)} />
                Exclude admins (recommended)
              </label>
            )}

            {audienceMode === 'roles' && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Select one or more roles</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedRoles(ROLE_OPTIONS.map((r) => r.value))}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedRoles([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((role) => {
                    const roleCount = recipientPreview?.byRole.find((b) => b.role === role.value)?.count ?? 0
                    return (
                      <label
                        key={role.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-sm hover:bg-muted/20"
                      >
                        <Checkbox
                          checked={selectedRoles.includes(role.value)}
                          onCheckedChange={(v) => toggleRole(role.value, v === true)}
                        />
                        <span className="flex-1">
                          {role.label}
                          {audienceMode === 'roles' && roleCount > 0 ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">({roleCount})</span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
              {loadingPreview
                ? 'Calculating recipients…'
                : recipientPreview != null
                  ? audienceMode === 'roles' && selectedRoles.length > 0
                    ? `Will reach ${recipientPreview.count} active user${recipientPreview.count === 1 ? '' : 's'} (${selectedRoles
                        .map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r)
                        .join(', ')})`
                    : `Will reach ${recipientPreview.count} active user${recipientPreview.count === 1 ? '' : 's'}`
                  : audienceMode === 'roles' && selectedRoles.length === 0
                    ? 'Select at least one role'
                    : null}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}

          <Button
            type="button"
            disabled={!canSend || sending || loadingPreview}
            className="gap-2 bg-primary text-primary-foreground"
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="size-4" />
            {sending ? 'Sending…' : 'Send announcement'}
          </Button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
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
                <strong>{title.trim()}</strong> →{' '}
                <strong>{recipientPreview?.count ?? '?'}</strong> active user
                {(recipientPreview?.count ?? 0) === 1 ? '' : 's'}.
              </span>
              {audienceMode === 'roles' && selectedRoles.length > 0 && (
                <span className="block text-xs">
                  Roles:{' '}
                  {selectedRoles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r).join(', ')}
                </span>
              )}
              {audienceMode === 'all_active' && (
                <span className="block text-xs">
                  Audience: all active members{excludeAdmins ? ' (admins excluded)' : ''}.
                </span>
              )}
              <span className="block">Each person gets a notification and an email.</span>
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
