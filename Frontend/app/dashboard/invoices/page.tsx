'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarIcon, CheckCircle2, Clock, ExternalLink, Receipt, Send, XCircle } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useApp } from '@/lib/app-context'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

const OSEN_ROLES = [
  { value: 'community_manager', label: 'Community Manager' },
  { value: 'design_team', label: 'Design team' },
  { value: 'video_editor', label: 'Video editor' },
  { value: 'evangelist', label: 'Evangelist' },
  { value: 'ambassador_lead', label: 'Ambassador lead' },
] as const

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
] as const

const MAX_AMOUNT = 1000

type InvoiceStatus = 'pending_admin' | 'pending_accounts' | 'paid' | 'rejected'

type InvoiceRecord = {
  _id: string
  fullName: string
  email: string
  phone: string
  osenRole: string
  eventName: string
  eventDate: string
  eventPreApproved: boolean
  roleAtEvent: string
  totalAmountClaimed: number
  budgetBreakdown: string
  billsDriveLink: string
  paymentMethod: 'upi' | 'bank_transfer'
  upiId?: string
  bankAccountHolderName?: string
  bankAccountNumber?: string
  bankIfscCode?: string
  notes?: string
  status: InvoiceStatus
  adminReviewNotes?: string
  accountsReviewNotes?: string
  adminReviewedBy?: { _id?: string; name?: string; email?: string }
  accountsReviewedBy?: { _id?: string; name?: string; email?: string }
  adminReviewedAt?: string
  accountsReviewedAt?: string
  paidAt?: string
  submittedBy?: { _id: string; name: string; email: string; role: string }
  createdAt: string
}

type InvoiceComment = {
  _id?: string
  author?: { _id?: string; name?: string; email?: string; avatar?: string; role?: string }
  role: string
  body: string
  createdAt: string
}

const defaultForm = {
  fullName: '',
  email: '',
  phone: '',
  osenRole: 'evangelist' as const,
  eventName: '',
  eventDate: '',
  eventPreApproved: true,
  roleAtEvent: '',
  totalAmountClaimed: '',
  budgetBreakdown: '',
  billsDriveLink: '',
  paymentMethod: 'upi' as const,
  upiId: '',
  bankAccountHolderName: '',
  bankAccountNumber: '',
  bankIfscCode: '',
  notes: '',
  confirmationChecked: false,
}

export default function InvoicesPage() {
  const { currentUser, refreshUser } = useApp()
  const role = currentUser?.role

  const isAdmin = role === 'admin'
  const isAccounts = role === 'accounts'
  const isEvangelist = role === 'evangelist'

  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])

  const [form, setForm] = useState(defaultForm)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [detailInvoice, setDetailInvoice] = useState<InvoiceRecord | null>(null)
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'paid' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)

  const [invoiceComments, setInvoiceComments] = useState<InvoiceComment[]>([])
  const [newCommentBody, setNewCommentBody] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  const title = useMemo(() => {
    if (isAdmin) return 'Admin Invoice Review'
    if (isAccounts) return 'Accounts Invoice Approval'
    return 'Raise Travel Reimbursement'
  }, [isAdmin, isAccounts])

  useEffect(() => {
    if (!currentUser?.id) return
    setLoading(true)
    apiFetch<InvoiceRecord[]>('/dashboard/invoices')
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return
    setForm((f) => ({
      ...f,
      fullName: currentUser.name || f.fullName,
      email: currentUser.email || f.email,
    }))
  }, [currentUser?.id])

  const pendingAdmin = invoices.filter((i) => i.status === 'pending_admin')
  const pendingAccounts = invoices.filter((i) => i.status === 'pending_accounts')
  const paidInvoices = invoices.filter((i) => i.status === 'paid')

  const myInvoices = invoices

  async function refresh() {
    const list = await apiFetch<InvoiceRecord[]>('/dashboard/invoices')
    setInvoices(list)
    await refreshUser().catch(() => undefined)
  }

  async function refreshComments(invoiceId: string) {
    try {
      const list = await apiFetch<InvoiceComment[]>(`/dashboard/invoices/${invoiceId}/comments`)
      setInvoiceComments(list ?? [])
    } catch {
      setInvoiceComments([])
    }
  }

  async function handleSubmitForm(e: FormEvent) {
    e.preventDefault()
    if (!isEvangelist) return

    const amount = Math.min(MAX_AMOUNT, Math.max(0, parseInt(form.totalAmountClaimed, 10) || 0))
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.eventName.trim() ||
      !form.eventDate ||
      !form.roleAtEvent.trim() ||
      !form.budgetBreakdown.trim() ||
      !form.billsDriveLink.trim() ||
      amount <= 0 ||
      !form.confirmationChecked
    ) {
      return
    }
    if (form.paymentMethod === 'upi' && !form.upiId.trim()) return
    if (form.paymentMethod === 'bank_transfer') {
      if (!form.bankAccountHolderName.trim() || !form.bankAccountNumber.trim() || !form.bankIfscCode.trim()) return
    }

    setSubmitting(true)
    try {
      await apiFetch('/dashboard/invoices', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          osenRole: form.osenRole,
          eventName: form.eventName.trim(),
          eventDate: form.eventDate,
          eventPreApproved: form.eventPreApproved,
          roleAtEvent: form.roleAtEvent.trim(),
          totalAmountClaimed: amount,
          budgetBreakdown: form.budgetBreakdown.trim(),
          billsDriveLink: form.billsDriveLink.trim(),
          paymentMethod: form.paymentMethod,
          upiId: form.paymentMethod === 'upi' ? form.upiId.trim() : undefined,
          bankAccountHolderName:
            form.paymentMethod === 'bank_transfer' ? form.bankAccountHolderName.trim() : undefined,
          bankAccountNumber: form.paymentMethod === 'bank_transfer' ? form.bankAccountNumber.trim() : undefined,
          bankIfscCode: form.paymentMethod === 'bank_transfer' ? form.bankIfscCode.trim() : undefined,
          notes: form.notes.trim() || undefined,
          confirmationChecked: true,
        }),
      })
      setSubmitted(true)
      setForm(defaultForm)
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  function openDetail(inv: InvoiceRecord) {
    setDetailInvoice(inv)
    setDecision(null)
    setReviewNotes('')
    setNewCommentBody('')
    setInvoiceComments([])
    refreshComments(inv._id).catch(() => undefined)
  }

  function canPostComment() {
    if (!detailInvoice) return false
    if (isAdmin && detailInvoice.status === 'pending_admin') return true
    if (isAccounts && detailInvoice.status === 'pending_accounts') return true
    return false
  }

  async function handleAddComment() {
    if (!detailInvoice) return
    if (!canPostComment()) return
    const trimmed = newCommentBody.trim()
    if (!trimmed) return
    setSavingComment(true)
    try {
      await apiFetch(`/dashboard/invoices/${detailInvoice._id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      })
      setNewCommentBody('')
      await refreshComments(detailInvoice._id)
    } finally {
      setSavingComment(false)
    }
  }

  async function confirmDecision() {
    if (!detailInvoice || !decision) return
    if (role === 'admin') {
      if (!['approved', 'rejected'].includes(decision)) return
      setSavingDecision(true)
      try {
        await apiFetch(`/dashboard/invoices/${detailInvoice._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ action: decision, reviewNotes: reviewNotes.trim() || undefined }),
        })
        setDetailInvoice(null)
        setDecision(null)
        setReviewNotes('')
        await refresh()
      } finally {
        setSavingDecision(false)
      }
      return
    }
    if (role === 'accounts') {
      if (!['paid', 'rejected'].includes(decision)) return
      setSavingDecision(true)
      try {
        await apiFetch(`/dashboard/invoices/${detailInvoice._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ action: decision, reviewNotes: reviewNotes.trim() || undefined }),
        })
        setDetailInvoice(null)
        setDecision(null)
        setReviewNotes('')
        await refresh()
      } finally {
        setSavingDecision(false)
      }
    }
  }

  function StatusBadge({ status }: { status: InvoiceStatus }) {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-600 text-xs px-2 py-0.5">
          <CheckCircle2 className="size-3" /> Paid
        </span>
      )
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 text-xs px-2 py-0.5">
          <XCircle className="size-3" /> Rejected
        </span>
      )
    }
    if (status === 'pending_accounts') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 text-xs px-2 py-0.5">
          <Clock className="size-3" /> Pending Accounts
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 text-xs px-2 py-0.5">
        <Clock className="size-3" /> Pending Admin
      </span>
    )
  }

  return (
    <div className="flex flex-col">
      <DashboardTopbar title={title} />
      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="glass rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-600">
            <Receipt className="size-4" /> OSEN Evangelist Travel Reimbursement
          </div>
          <p className="text-sm text-muted-foreground">
            Reimbursement up to <strong>₹{MAX_AMOUNT}</strong> per event (travel + food combined). Submit within 5 days of the event.
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            <li>Event must be pre-approved by OSEN Core Team</li>
            <li>Upload bills to Google Drive and share a public link</li>
            <li>Fake or edited bills will lead to immediate removal from the OSEN program</li>
          </ul>
        </div>

        {isEvangelist && (
          <>
            {submitted ? (
              <div className="glass rounded-xl border border-green-400/20 bg-green-400/5 p-8 text-center space-y-4">
                <CheckCircle2 className="size-12 text-green-400 mx-auto" />
                <h3 className="font-semibold">Submitted successfully</h3>
                <p className="text-sm text-muted-foreground">Admin will review your invoice first.</p>
                {myInvoices.length > 0 ? (
                  <div className="mx-auto max-w-md glass rounded-lg border border-border/40 p-3 flex flex-col gap-2 items-center">
                    <div className="text-xs text-muted-foreground">Latest invoice status</div>
                    <StatusBadge status={myInvoices[0].status} />
                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => openDetail(myInvoices[0])}>
                      View details
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Fetching your invoice…</p>
                )}
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Submit another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitForm} className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Full name *</label>
                    <Input
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="Enter your full name"
                      required
                      className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email *</label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                      className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Phone number *</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. 9307227251"
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">OSEN Role *</label>
                  <Select value={form.osenRole} onValueChange={(v: any) => setForm((f) => ({ ...f, osenRole: v }))}>
                    <SelectTrigger className="h-10 bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OSEN_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Event name *</label>
                  <Input
                    value={form.eventName}
                    onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
                    placeholder="e.g. Hackx"
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Event date *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal h-10 bg-background border border-border text-foreground',
                          !form.eventDate && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {form.eventDate
                          ? new Date(form.eventDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Pick event date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                      <Calendar
                        mode="single"
                        selected={form.eventDate ? new Date(form.eventDate) : undefined}
                        onSelect={(d) => setForm((f) => ({ ...f, eventDate: d ? d.toISOString().slice(0, 10) : '' }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Was this event pre-approved by OSEN Core Team? *</label>
                  <Select
                    value={form.eventPreApproved ? 'yes' : 'no'}
                    onValueChange={(v) => setForm((f) => ({ ...f, eventPreApproved: v === 'yes' }))}
                  >
                    <SelectTrigger className="h-10 bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Your role at the event *</label>
                  <Input
                    value={form.roleAtEvent}
                    onChange={(e) => setForm((f) => ({ ...f, roleAtEvent: e.target.value }))}
                    placeholder="e.g. Speaker / Mentor / Judge"
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Total amount claimed (max ₹{MAX_AMOUNT}) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={MAX_AMOUNT}
                    value={form.totalAmountClaimed}
                    onChange={(e) => setForm((f) => ({ ...f, totalAmountClaimed: e.target.value }))}
                    placeholder="e.g. 736"
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Budget breakdown *</label>
                  <Input
                    value={form.budgetBreakdown}
                    onChange={(e) => setForm((f) => ({ ...f, budgetBreakdown: e.target.value }))}
                    placeholder="e.g. 436 - food, 300 - travel"
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Bills – Drive link *</label>
                  <p className="text-xs text-muted-foreground">Use a public, publicly accessible link.</p>
                  <Input
                    type="url"
                    value={form.billsDriveLink}
                    onChange={(e) => setForm((f) => ({ ...f, billsDriveLink: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Preferred payment method *</label>
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(v: any) => setForm((f) => ({ ...f, paymentMethod: v }))}
                  >
                    <SelectTrigger className="h-10 bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.paymentMethod === 'upi' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">UPI ID *</label>
                    <Input
                      value={form.upiId}
                      onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                      placeholder="e.g. name@okaxis"
                      required
                      className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                )}

                {form.paymentMethod === 'bank_transfer' && (
                  <div className="grid gap-4 sm:grid-cols-1 space-y-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Account holder name *</label>
                      <Input
                        value={form.bankAccountHolderName}
                        onChange={(e) => setForm((f) => ({ ...f, bankAccountHolderName: e.target.value }))}
                        required
                        className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Account number *</label>
                      <Input
                        value={form.bankAccountNumber}
                        onChange={(e) => setForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                        required
                        className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">IFSC code *</label>
                      <Input
                        value={form.bankIfscCode}
                        onChange={(e) => setForm((f) => ({ ...f, bankIfscCode: e.target.value }))}
                        required
                        placeholder="e.g. SBIN0001234"
                        className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Anything else you'd like to share?</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className="min-h-20 bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
                  />
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
                  <Checkbox
                    id="confirm"
                    checked={form.confirmationChecked}
                    onCheckedChange={(c) => setForm((f) => ({ ...f, confirmationChecked: !!c }))}
                    className="size-5 shrink-0 mt-0.5 border-2 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="confirm" className="text-sm text-foreground cursor-pointer leading-snug">
                    I confirm bills are genuine and the total does not exceed ₹{MAX_AMOUNT}. *
                  </label>
                </div>

                <Button type="submit" disabled={submitting} className="gap-2 h-10">
                  <Send className="size-4" /> Submit reimbursement
                </Button>
              </form>
            )}

            <div className="glass rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">My submissions</h3>
                <span className="text-xs text-muted-foreground">{myInvoices.length}</span>
              </div>
              {myInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <div className="space-y-2">
                  {myInvoices.map((inv) => (
                    <div
                      key={inv._id}
                      className="flex items-center justify-between gap-4 glass rounded-lg border border-border/40 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{inv.eventName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(inv.eventDate).toLocaleDateString('en-IN')} · ₹{inv.totalAmountClaimed}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={inv.status} />
                        <Button size="sm" variant="ghost" onClick={() => openDetail(inv)}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {(isAdmin || isAccounts) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {isAdmin ? `Pending admin review (${pendingAdmin.length})` : `Raised invoices (${pendingAccounts.length} pending)`}
              </h3>
              {isAccounts && paidInvoices.length > 0 && (
                <span className="text-xs text-muted-foreground">Paid: {paidInvoices.length}</span>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-3">
                {(isAdmin ? pendingAdmin : pendingAccounts).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices in this stage.</p>
                ) : (
                  (isAdmin ? pendingAdmin : pendingAccounts).map((inv) => (
                    <div
                      key={inv._id}
                      className="glass rounded-xl border border-border/50 p-4 flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{inv.eventName}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.fullName} · {inv.email} · ₹{inv.totalAmountClaimed}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={inv.status} />
                        <Button size="sm" onClick={() => openDetail(inv)}>
                          Review
                        </Button>
                      </div>
                    </div>
                  ))
                )}

                {isAccounts && paidInvoices.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="text-sm font-semibold text-muted-foreground">Paid invoices</div>
                    {paidInvoices.map((inv) => (
                      <div
                        key={inv._id}
                        className="glass rounded-lg border border-border/40 p-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{inv.eventName}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.fullName} · ₹{inv.totalAmountClaimed}
                          </p>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Dialog open={!!detailInvoice} onOpenChange={(o) => !o && setDetailInvoice(null)}>
          {detailInvoice && (
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 flex flex-col">
              <div className="px-6 pt-6 pb-3 border-b border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-base">{detailInvoice.eventName}</DialogTitle>
                </DialogHeader>
              </div>

              <div className="px-6 py-4 border-b border-border/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Submitter</span>
                  <span className="min-w-0 truncate">{detailInvoice.fullName}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span className="min-w-0 truncate">{detailInvoice.email}</span>
                  <span className="text-muted-foreground">Admin approved by</span>
                  <span className="min-w-0 truncate">
                    {detailInvoice.adminReviewedBy?.name || detailInvoice.adminReviewedBy?.email || '—'}
                  </span>
                  <span className="text-muted-foreground">Accounts approved by</span>
                  <span className="min-w-0 truncate">
                    {detailInvoice.accountsReviewedBy?.name || detailInvoice.accountsReviewedBy?.email || '—'}
                  </span>
                  <span className="text-muted-foreground">Event date</span>
                  <span>{new Date(detailInvoice.eventDate).toLocaleDateString('en-IN')}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">₹{detailInvoice.totalAmountClaimed}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                <div>
                  <div className="text-sm font-semibold mb-1">Bills link</div>
                  <a
                    href={detailInvoice.billsDriveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all flex items-center gap-1"
                  >
                    {detailInvoice.billsDriveLink.slice(0, 60)}… <ExternalLink className="size-3" />
                  </a>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-semibold">Budget breakdown</div>
                  <div className="text-muted-foreground whitespace-pre-wrap">{detailInvoice.budgetBreakdown}</div>
                </div>

                {detailInvoice.notes && (
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Notes</div>
                    <div className="text-muted-foreground whitespace-pre-wrap">{detailInvoice.notes}</div>
                  </div>
                )}

                {(detailInvoice.adminReviewNotes || detailInvoice.accountsReviewNotes) && (
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Review notes</div>
                    <div className="text-muted-foreground whitespace-pre-wrap">
                      {detailInvoice.adminReviewNotes || detailInvoice.accountsReviewNotes}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="text-sm font-semibold">Review comments</div>
                  {invoiceComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {invoiceComments.map((c, idx) => {
                        const name = c.author?.name || c.author?.email || 'Reviewer'
                        const time = c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN') : ''
                        return (
                          <div key={c._id || `${detailInvoice._id}-${idx}`} className="glass rounded-lg border border-border/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-muted-foreground font-medium truncate">{name}</div>
                              <div className="text-[10px] text-muted-foreground shrink-0">{time}</div>
                            </div>
                            <div className="text-sm whitespace-pre-wrap mt-2">{c.body}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {canPostComment() && (
                    <div className="space-y-2 pt-2">
                      <Textarea
                        placeholder="Add a comment (visible to the other reviewer)"
                        value={newCommentBody}
                        onChange={(e) => setNewCommentBody(e.target.value)}
                        className="min-h-20"
                      />
                      <div className="flex items-center justify-end">
                        <Button onClick={handleAddComment} disabled={savingComment} className="gap-2">
                          {savingComment ? 'Adding…' : 'Add comment'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {isAdmin && detailInvoice.status === 'pending_admin' && (
                  <div className="pt-3 border-t border-border/50 space-y-3">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Admin decision (required)</div>
                      <Textarea
                        placeholder="Optional admin notes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="min-h-20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="bg-green-500/10 text-green-600 border-green-500/30"
                        onClick={() => setDecision('approved')}
                      >
                        <CheckCircle2 className="size-4 mr-1" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-red-500/10 text-red-600 border-red-500/30"
                        onClick={() => setDecision('rejected')}
                      >
                        <XCircle className="size-4 mr-1" /> Reject
                      </Button>
                    </div>
                    {decision && (
                      <DialogFooter>
                        <Button variant="ghost" disabled={savingDecision} onClick={() => setDecision(null)}>
                          Cancel
                        </Button>
                        <Button disabled={savingDecision} onClick={confirmDecision}>
                          Confirm
                        </Button>
                      </DialogFooter>
                    )}
                  </div>
                )}

                {isAccounts && detailInvoice.status === 'pending_accounts' && (
                  <div className="pt-3 border-t border-border/50 space-y-3">
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Accounts decision</div>
                      <Textarea
                        placeholder="Optional accounts notes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="min-h-20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="bg-green-500/10 text-green-600 border-green-500/30"
                        onClick={() => setDecision('paid')}
                      >
                        <CheckCircle2 className="size-4 mr-1" /> Approve & Pay
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-red-500/10 text-red-600 border-red-500/30"
                        onClick={() => setDecision('rejected')}
                      >
                        <XCircle className="size-4 mr-1" /> Reject
                      </Button>
                    </div>
                    {decision && (
                      <DialogFooter>
                        <Button variant="ghost" disabled={savingDecision} onClick={() => setDecision(null)}>
                          Cancel
                        </Button>
                        <Button disabled={savingDecision} onClick={confirmDecision}>
                          Confirm
                        </Button>
                      </DialogFooter>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-border/50 bg-muted/20 px-6 py-4">
                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={() => setDetailInvoice(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  )
}

