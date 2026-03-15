'use client'

import { useEffect, useState } from 'react'
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  CalendarIcon,
} from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

type InvoiceStatus = 'pending' | 'approved' | 'rejected'

interface InvoiceRecord {
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
  paymentMethod: string
  upiId?: string
  bankAccountHolderName?: string
  bankAccountNumber?: string
  bankIfscCode?: string
  notes?: string
  status: InvoiceStatus
  reviewNotes?: string
  reviewedAt?: string
  submittedBy?: { _id: string; name: string; email: string }
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
  const { currentUser } = useApp()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [viewTab, setViewTab] = useState<'form' | 'mine' | 'review'>('form')
  const [detailInvoice, setDetailInvoice] = useState<InvoiceRecord | null>(null)
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const isFinanceOrAdmin = currentUser?.role === 'finance' || currentUser?.role === 'admin'

  useEffect(() => {
    apiFetch<InvoiceRecord[]>('/dashboard/invoices')
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }, [currentUser?.id])

  useEffect(() => {
    if (currentUser && !form.fullName) {
      setForm((f) => ({
        ...f,
        fullName: currentUser.name || '',
        email: currentUser.email || '',
      }))
    }
  }, [currentUser])

  const pendingInvoices = invoices.filter((i) => i.status === 'pending')
  const myInvoices = isFinanceOrAdmin ? invoices : invoices

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    const amount = Math.min(MAX_AMOUNT, Math.max(0, parseInt(form.totalAmountClaimed, 10) || 0))
    if (
      !form.fullName?.trim() ||
      !form.email?.trim() ||
      !form.phone?.trim() ||
      !form.eventName?.trim() ||
      !form.eventDate ||
      !form.roleAtEvent?.trim() ||
      !form.budgetBreakdown?.trim() ||
      !form.billsDriveLink?.trim() ||
      amount <= 0 ||
      !form.confirmationChecked
    ) {
      return
    }
    if (form.paymentMethod === 'upi' && !form.upiId?.trim()) return
    if (form.paymentMethod === 'bank_transfer') {
      if (!form.bankAccountHolderName?.trim() || !form.bankAccountNumber?.trim() || !form.bankIfscCode?.trim())
        return
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
          upiId: form.paymentMethod === 'upi' ? form.upiId?.trim() : undefined,
          bankAccountHolderName: form.paymentMethod === 'bank_transfer' ? form.bankAccountHolderName?.trim() : undefined,
          bankAccountNumber: form.paymentMethod === 'bank_transfer' ? form.bankAccountNumber?.trim() : undefined,
          bankIfscCode: form.paymentMethod === 'bank_transfer' ? form.bankIfscCode?.trim() : undefined,
          notes: form.notes?.trim() || undefined,
          confirmationChecked: true,
        }),
      })
      setSubmitted(true)
      setForm(defaultForm)
      const list = await apiFetch<InvoiceRecord[]>('/dashboard/invoices')
      setInvoices(list)
    } catch {
      setSubmitting(false)
    }
    setSubmitting(false)
  }

  async function handleApproveReject() {
    if (!detailInvoice || !reviewStatus) return
    try {
      const updated = await apiFetch<InvoiceRecord>(`/dashboard/invoices/${detailInvoice._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: reviewStatus, reviewNotes: reviewNotes.trim() || undefined }),
      })
      setInvoices((prev) => prev.map((i) => (i._id === updated._id ? updated : i)))
      setDetailInvoice(null)
      setReviewStatus(null)
      setReviewNotes('')
    } catch {}
  }

  function openDetail(inv: InvoiceRecord) {
    setDetailInvoice(inv)
    setReviewStatus(null)
    setReviewNotes('')
  }

  return (
    <div className="flex flex-col min-h-full">
      <DashboardTopbar title="Submit Invoices" />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Info box */}
        <div className="glass rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
            <Receipt className="size-4" /> OSEN Evangelist Travel Reimbursement
          </div>
          <p className="text-sm text-muted-foreground">
            Reimbursement up to <strong>₹{MAX_AMOUNT}</strong> per event (travel + food combined). Submit within 5 days of the event.
            Upload bills to Google Drive and share a <strong>publicly accessible link</strong> below.
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            <li>Event must be pre-approved by OSEN Core Team</li>
            <li>Submit within 5 days of the event</li>
            <li>Fake or edited bills will lead to immediate removal from the program</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Payment queries: osen.bills@gmail.com (CC: vikashfromosen@gmail.com)
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border/60 pb-2">
          <button
            type="button"
            onClick={() => setViewTab('form')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              viewTab === 'form' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            New submission
          </button>
          <button
            type="button"
            onClick={() => setViewTab('mine')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              viewTab === 'mine' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            {isFinanceOrAdmin ? 'All submissions' : 'My submissions'} ({myInvoices.length})
          </button>
          {isFinanceOrAdmin && (
            <button
              type="button"
              onClick={() => setViewTab('review')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                viewTab === 'review' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              Pending review ({pendingInvoices.length})
            </button>
          )}
        </div>

        {viewTab === 'form' && (
          <>
            {submitted ? (
              <div className="glass rounded-xl border border-green-400/20 bg-green-400/5 p-8 text-center space-y-4">
                <CheckCircle2 className="size-12 text-green-400 mx-auto" />
                <h3 className="font-semibold">Submitted successfully</h3>
                <p className="text-sm text-muted-foreground">
                  Your reimbursement request has been submitted. Finance will review and notify you.
                </p>
                <Button variant="outline" onClick={() => setSubmitted(false)}>Submit another</Button>
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
                      placeholder="Enter Email ID"
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
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
                        onSelect={(d) =>
                          setForm((f) => ({ ...f, eventDate: d ? d.toISOString().slice(0, 10) : '' }))
                        }
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
                    placeholder="e.g. Speaker / Mentor / Judge / Distributed swags"
                    required
                    className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Total amount claimed (max ₹{MAX_AMOUNT}) *</label>
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
                  <p className="text-xs text-muted-foreground">
                    Please upload your bills to Google Drive (or similar) and provide a publicly accessible link.
                  </p>
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
                    onValueChange={(v: 'upi' | 'bank_transfer') => setForm((f) => ({ ...f, paymentMethod: v }))}
                  >
                    <SelectTrigger className="h-10 bg-background border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
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
                        placeholder="e.g. SBIN0001234"
                        required
                        className="h-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Anything else you’d like to share?</label>
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
                    I confirm that all submitted bills are genuine, the expenses were for an approved OSEN event,
                    the total does not exceed ₹{MAX_AMOUNT}, and I understand that fake submissions lead to permanent disqualification. *
                  </label>
                </div>
                <Button type="submit" disabled={submitting} className="gap-2 h-10">
                  <Send className="size-4" /> Submit reimbursement
                </Button>
              </form>
            )}
          </>
        )}

        {viewTab === 'mine' && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : myInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              myInvoices.map((inv) => (
                <div
                  key={inv._id}
                  className="glass rounded-xl border border-border/50 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">{inv.eventName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(inv.eventDate).toLocaleDateString('en-IN')} · ₹{inv.totalAmountClaimed}
                      {inv.submittedBy && isFinanceOrAdmin && (
                        <> · {inv.submittedBy.name}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inv.status} />
                    <Button variant="ghost" size="sm" onClick={() => openDetail(inv)}>View</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {viewTab === 'review' && isFinanceOrAdmin && (
          <div className="space-y-3">
            {pendingInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invoices.</p>
            ) : (
              pendingInvoices.map((inv) => (
                <div
                  key={inv._id}
                  className="glass rounded-xl border border-amber-500/20 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">{inv.eventName}</p>
                    <p className="text-sm text-muted-foreground">
                      {inv.fullName} · {inv.email} · ₹{inv.totalAmountClaimed}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openDetail(inv)}>Review</Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Detail / Review dialog */}
      <Dialog open={!!detailInvoice} onOpenChange={(o) => !o && setDetailInvoice(null)}>
        {detailInvoice && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailInvoice.eventName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Name</span><span>{detailInvoice.fullName}</span>
                <span className="text-muted-foreground">Email</span><span>{detailInvoice.email}</span>
                <span className="text-muted-foreground">Phone</span><span>{detailInvoice.phone}</span>
                <span className="text-muted-foreground">OSEN Role</span>
                <span>{OSEN_ROLES.find((r) => r.value === detailInvoice.osenRole)?.label ?? detailInvoice.osenRole}</span>
                <span className="text-muted-foreground">Event date</span>
                <span>{new Date(detailInvoice.eventDate).toLocaleDateString('en-IN')}</span>
                <span className="text-muted-foreground">Pre-approved</span>
                <span>{detailInvoice.eventPreApproved ? 'Yes' : 'No'}</span>
                <span className="text-muted-foreground">Role at event</span><span>{detailInvoice.roleAtEvent}</span>
                <span className="text-muted-foreground">Amount</span><span className="font-semibold">₹{detailInvoice.totalAmountClaimed}</span>
                <span className="text-muted-foreground">Breakdown</span><span>{detailInvoice.budgetBreakdown}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Bills link</span>
                <a
                  href={detailInvoice.billsDriveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {detailInvoice.billsDriveLink.slice(0, 50)}… <ExternalLink className="size-3" />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Payment</span>
                <span>{detailInvoice.paymentMethod === 'upi' ? `UPI: ${detailInvoice.upiId}` : 'Bank transfer'}</span>
                {detailInvoice.paymentMethod === 'bank_transfer' && (
                  <>
                    <span className="text-muted-foreground">Account</span>
                    <span>{detailInvoice.bankAccountHolderName} · {detailInvoice.bankAccountNumber} · {detailInvoice.bankIfscCode}</span>
                  </>
                )}
              </div>
              {detailInvoice.notes && (
                <div>
                  <span className="text-muted-foreground block mb-1">Notes</span>
                  <p className="text-muted-foreground">{detailInvoice.notes}</p>
                </div>
              )}
              {detailInvoice.status !== 'pending' && detailInvoice.reviewNotes && (
                <div>
                  <span className="text-muted-foreground block mb-1">Review notes</span>
                  <p className="text-muted-foreground">{detailInvoice.reviewNotes}</p>
                </div>
              )}
              {isFinanceOrAdmin && detailInvoice.status === 'pending' && (
                <div className="space-y-3 pt-2 border-t">
                  <label className="text-sm font-medium">Review notes (optional)</label>
                  <Textarea
                    placeholder="Add notes for the submitter..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="min-h-20"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="bg-green-500/10 text-green-600 border-green-500/30"
                      onClick={() => setReviewStatus('approved')}
                    >
                      <CheckCircle2 className="size-4 mr-1" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-red-500/10 text-red-600 border-red-500/30"
                      onClick={() => setReviewStatus('rejected')}
                    >
                      <XCircle className="size-4 mr-1" /> Reject
                    </Button>
                  </div>
                  {reviewStatus && (
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setReviewStatus(null)}>Cancel</Button>
                      <Button onClick={handleApproveReject}>
                        Confirm {reviewStatus === 'approved' ? 'approval' : 'rejection'}
                      </Button>
                    </DialogFooter>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === 'approved')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-600 text-xs px-2 py-0.5">
        <CheckCircle2 className="size-3" /> Approved
      </span>
    )
  if (status === 'rejected')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 text-xs px-2 py-0.5">
        <XCircle className="size-3" /> Rejected
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 text-xs px-2 py-0.5">
      <Clock className="size-3" /> Pending
    </span>
  )
}
