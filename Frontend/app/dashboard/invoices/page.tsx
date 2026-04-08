'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarIcon,
  CheckCircle2,
  Clock,
  ExternalLink,
  Receipt,
  Send,
  XCircle,
} from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { InvoiceHubNav } from '@/components/invoice-hub-nav'
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

const TRAVEL_MAX_AMOUNT = 1000

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

/** Points payout rows in admin / accounts queues (GET …/payout-requests/tracking?status=…). */
type QueuePayoutRow = {
  _id: string
  fullName: string
  email: string
  cycleLabel: string
  pointsAtSubmit: number
  requestedPayoutINR: number
  tierLabel: string
  status: InvoiceStatus
  createdAt: string
}

/** Full payout from GET /dashboard/payout-requests/:id */
type PayoutRecord = {
  _id: string
  fullName: string
  email: string
  phone: string
  pointsAtSubmit: number
  cycleLabel: string
  cycleSequence: number
  requestedPayoutINR: number
  tierLabel: string
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

type TravelOsenRole = (typeof OSEN_ROLES)[number]['value']

type TravelInvoiceForm = {
  fullName: string
  email: string
  phone: string
  osenRole: TravelOsenRole
  eventName: string
  eventDate: string
  eventPreApproved: boolean
  roleAtEvent: string
  totalAmountClaimed: string
  budgetBreakdown: string
  billsDriveLink: string
  paymentMethod: 'upi' | 'bank_transfer'
  upiId: string
  bankAccountHolderName: string
  bankAccountNumber: string
  bankIfscCode: string
  notes: string
  confirmationChecked: boolean
}

function emptyTravelForm(): TravelInvoiceForm {
  return {
    fullName: '',
    email: '',
    phone: '',
    osenRole: 'evangelist',
    eventName: '',
    eventDate: '',
    eventPreApproved: true,
    roleAtEvent: '',
    totalAmountClaimed: '',
    budgetBreakdown: '',
    billsDriveLink: '',
    paymentMethod: 'upi',
    upiId: '',
    bankAccountHolderName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    notes: '',
    confirmationChecked: false,
  }
}

export default function InvoicesPage() {
  const { currentUser, refreshUser } = useApp()
  const role = currentUser?.role

  const isAdmin = role === 'admin'
  const isAccounts = role === 'accounts'
  /** Submitters: everyone except admin & accounts (reviewers). */
  const canRaiseInvoice = Boolean(role && !['admin', 'accounts'].includes(role))

  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [queuePayouts, setQueuePayouts] = useState<QueuePayoutRow[]>([])

  const [travelForm, setTravelForm] = useState<TravelInvoiceForm>(() => emptyTravelForm())
  const [travelModalOpen, setTravelModalOpen] = useState(false)
  const [travelSubmitted, setTravelSubmitted] = useState(false)
  const [travelSubmitting, setTravelSubmitting] = useState(false)

  const [detailInvoice, setDetailInvoice] = useState<InvoiceRecord | null>(null)
  const [detailPayout, setDetailPayout] = useState<PayoutRecord | null>(null)
  const [payoutDetailLoading, setPayoutDetailLoading] = useState(false)
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'paid' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)

  const [invoiceComments, setInvoiceComments] = useState<InvoiceComment[]>([])
  const [newCommentBody, setNewCommentBody] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  const title = useMemo(() => {
    if (isAdmin) return 'Admin Invoice Review'
    if (isAccounts) return 'Accounts Invoice Approval'
    return 'Submit & review'
  }, [isAdmin, isAccounts])

  useEffect(() => {
    if (!currentUser?.id) return
    const payoutStatus = isAdmin ? 'pending_admin' : isAccounts ? 'pending_accounts' : null
    setLoading(true)
    const loadInvoices = apiFetch<InvoiceRecord[]>('/dashboard/invoices')
      .then(setInvoices)
      .catch(() => setInvoices([]))
    const loadPayouts = payoutStatus
      ? apiFetch<QueuePayoutRow[]>(`/dashboard/payout-requests/tracking?status=${payoutStatus}`)
          .then(setQueuePayouts)
          .catch(() => setQueuePayouts([]))
      : Promise.resolve().then(() => setQueuePayouts([]))
    void Promise.all([loadInvoices, loadPayouts]).finally(() => setLoading(false))
  }, [currentUser?.id, isAdmin, isAccounts])

  useEffect(() => {
    if (!currentUser?.id) return
    setTravelForm((f) => ({
      ...f,
      fullName: currentUser.name || f.fullName,
      email: currentUser.email || f.email,
    }))
  }, [currentUser?.id, currentUser?.name, currentUser?.email])

  function openTravelModal() {
    setTravelModalOpen(true)
    if (currentUser) {
      setTravelForm((f) => ({
        ...f,
        fullName: currentUser.name || f.fullName,
        email: currentUser.email || f.email,
      }))
    }
  }

  useEffect(() => {
    if (!canRaiseInvoice || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('raise') === '1'
    const fromHash = window.location.hash === '#raise-reimbursement'
    if (!fromQuery && !fromHash) return
    setTravelModalOpen(true)
    if (currentUser) {
      setTravelForm((f) => ({
        ...f,
        fullName: currentUser.name || f.fullName,
        email: currentUser.email || f.email,
      }))
    }
    window.history.replaceState(null, '', window.location.pathname)
  }, [canRaiseInvoice, currentUser?.id, currentUser?.name, currentUser?.email])

  const pendingAdmin = invoices.filter((i) => i.status === 'pending_admin')
  const pendingAccounts = invoices.filter((i) => i.status === 'pending_accounts')
  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const rejectedInvoices = invoices.filter((i) => i.status === 'rejected')

  const adminQueueItems = useMemo(() => {
    type QItem =
      | { kind: 'travel'; createdAt: string; inv: InvoiceRecord }
      | { kind: 'payout'; createdAt: string; payout: QueuePayoutRow }
    const travel: QItem[] = pendingAdmin.map((inv) => ({ kind: 'travel', createdAt: inv.createdAt, inv }))
    const payout: QItem[] = queuePayouts.map((p) => ({ kind: 'payout', createdAt: p.createdAt, payout: p }))
    return [...travel, ...payout].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [pendingAdmin, queuePayouts])

  const accountsQueueItems = useMemo(() => {
    type QItem =
      | { kind: 'travel'; createdAt: string; inv: InvoiceRecord }
      | { kind: 'payout'; createdAt: string; payout: QueuePayoutRow }
    const travel: QItem[] = pendingAccounts.map((inv) => ({ kind: 'travel', createdAt: inv.createdAt, inv }))
    const payout: QItem[] = queuePayouts.map((p) => ({ kind: 'payout', createdAt: p.createdAt, payout: p }))
    return [...travel, ...payout].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [pendingAccounts, queuePayouts])

  async function refresh() {
    const list = await apiFetch<InvoiceRecord[]>('/dashboard/invoices')
    setInvoices(list)
    const payoutStatus = isAdmin ? 'pending_admin' : isAccounts ? 'pending_accounts' : null
    if (payoutStatus) {
      try {
        const p = await apiFetch<QueuePayoutRow[]>(`/dashboard/payout-requests/tracking?status=${payoutStatus}`)
        setQueuePayouts(p)
      } catch {
        setQueuePayouts([])
      }
    } else {
      setQueuePayouts([])
    }
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

  async function refreshPayoutComments(payoutId: string) {
    try {
      const list = await apiFetch<InvoiceComment[]>(`/dashboard/payout-requests/${payoutId}/comments`)
      setInvoiceComments(list ?? [])
    } catch {
      setInvoiceComments([])
    }
  }

  function closeReviewModal() {
    setDetailInvoice(null)
    setDetailPayout(null)
    setPayoutDetailLoading(false)
    setDecision(null)
    setReviewNotes('')
    setNewCommentBody('')
    setInvoiceComments([])
  }

  async function handleSubmitTravel(e: FormEvent) {
    e.preventDefault()
    if (!canRaiseInvoice) return

    const amount = Math.min(TRAVEL_MAX_AMOUNT, Math.max(0, parseInt(travelForm.totalAmountClaimed, 10) || 0))
    if (
      !travelForm.fullName.trim() ||
      !travelForm.email.trim() ||
      !travelForm.phone.trim() ||
      !travelForm.eventName.trim() ||
      !travelForm.eventDate ||
      !travelForm.roleAtEvent.trim() ||
      !travelForm.budgetBreakdown.trim() ||
      !travelForm.billsDriveLink.trim() ||
      amount <= 0 ||
      !travelForm.confirmationChecked
    ) {
      return
    }
    if (travelForm.paymentMethod === 'upi' && !travelForm.upiId.trim()) return
    if (travelForm.paymentMethod === 'bank_transfer') {
      if (
        !travelForm.bankAccountHolderName.trim() ||
        !travelForm.bankAccountNumber.trim() ||
        !travelForm.bankIfscCode.trim()
      ) {
        return
      }
    }

    setTravelSubmitting(true)
    try {
      await apiFetch('/dashboard/invoices', {
        method: 'POST',
        body: JSON.stringify({
          fullName: travelForm.fullName.trim(),
          email: travelForm.email.trim(),
          phone: travelForm.phone.trim(),
          osenRole: travelForm.osenRole,
          eventName: travelForm.eventName.trim(),
          eventDate: travelForm.eventDate,
          eventPreApproved: travelForm.eventPreApproved,
          roleAtEvent: travelForm.roleAtEvent.trim(),
          totalAmountClaimed: amount,
          budgetBreakdown: travelForm.budgetBreakdown.trim(),
          billsDriveLink: travelForm.billsDriveLink.trim(),
          paymentMethod: travelForm.paymentMethod,
          upiId: travelForm.paymentMethod === 'upi' ? travelForm.upiId.trim() : undefined,
          bankAccountHolderName:
            travelForm.paymentMethod === 'bank_transfer' ? travelForm.bankAccountHolderName.trim() : undefined,
          bankAccountNumber:
            travelForm.paymentMethod === 'bank_transfer' ? travelForm.bankAccountNumber.trim() : undefined,
          bankIfscCode: travelForm.paymentMethod === 'bank_transfer' ? travelForm.bankIfscCode.trim() : undefined,
          notes: travelForm.notes.trim() || undefined,
          confirmationChecked: true,
        }),
      })
      setTravelSubmitted(true)
      setTravelModalOpen(false)
      const next = emptyTravelForm()
      if (currentUser) {
        next.fullName = currentUser.name || ''
        next.email = currentUser.email || ''
      }
      setTravelForm(next)
      await refresh()
    } finally {
      setTravelSubmitting(false)
    }
  }

  function openDetail(inv: InvoiceRecord) {
    setDetailPayout(null)
    setPayoutDetailLoading(false)
    setDetailInvoice(inv)
    setDecision(null)
    setReviewNotes('')
    setNewCommentBody('')
    setInvoiceComments([])
    refreshComments(inv._id).catch(() => undefined)
  }

  async function openDetailPayout(id: string) {
    setDetailInvoice(null)
    setDetailPayout(null)
    setDecision(null)
    setReviewNotes('')
    setNewCommentBody('')
    setInvoiceComments([])
    setPayoutDetailLoading(true)
    try {
      const p = await apiFetch<PayoutRecord>(`/dashboard/payout-requests/${id}`)
      setDetailPayout(p)
      try {
        const list = await apiFetch<InvoiceComment[]>(`/dashboard/payout-requests/${id}/comments`)
        setInvoiceComments(list ?? [])
      } catch {
        setInvoiceComments([])
      }
    } catch {
      setDetailPayout(null)
    } finally {
      setPayoutDetailLoading(false)
    }
  }

  function canPostComment() {
    if (!currentUser?.id) return false
    if (isAdmin) return true
    if (isAccounts) return true
    if (detailPayout) {
      const sid = detailPayout.submittedBy?._id
      return Boolean(sid && String(sid) === String(currentUser.id))
    }
    if (detailInvoice) {
      const sid = detailInvoice.submittedBy?._id
      return Boolean(sid && String(sid) === String(currentUser.id))
    }
    return false
  }

  async function handleAddComment() {
    const id = detailPayout?._id ?? detailInvoice?._id
    if (!id) return
    if (!canPostComment()) return
    const trimmed = newCommentBody.trim()
    if (!trimmed) return
    setSavingComment(true)
    try {
      const path = detailPayout
        ? `/dashboard/payout-requests/${id}/comments`
        : `/dashboard/invoices/${id}/comments`
      await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      })
      setNewCommentBody('')
      if (detailPayout) await refreshPayoutComments(id)
      else await refreshComments(id)
    } finally {
      setSavingComment(false)
    }
  }

  async function confirmDecision() {
    if (!decision || !role) return

    if (detailPayout) {
      if (role === 'admin') {
        if (!['approved', 'rejected'].includes(decision)) return
        setSavingDecision(true)
        try {
          const updated = await apiFetch<PayoutRecord>(`/dashboard/payout-requests/${detailPayout._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: decision, reviewNotes: reviewNotes.trim() || undefined }),
          })
          setDetailPayout(updated)
          setDecision(null)
          setReviewNotes('')
          await refreshPayoutComments(updated._id)
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
          const updated = await apiFetch<PayoutRecord>(`/dashboard/payout-requests/${detailPayout._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: decision, reviewNotes: reviewNotes.trim() || undefined }),
          })
          setDetailPayout(updated)
          setDecision(null)
          setReviewNotes('')
          await refreshPayoutComments(updated._id)
          await refresh()
        } finally {
          setSavingDecision(false)
        }
      }
      return
    }

    if (!detailInvoice) return
    if (role === 'admin') {
      if (!['approved', 'rejected'].includes(decision)) return
      setSavingDecision(true)
      try {
        const updated = await apiFetch<InvoiceRecord>(`/dashboard/invoices/${detailInvoice._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ action: decision, reviewNotes: reviewNotes.trim() || undefined }),
        })
        setDetailInvoice(updated)
        setDecision(null)
        setReviewNotes('')
        await refreshComments(updated._id)
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
        const updated = await apiFetch<InvoiceRecord>(`/dashboard/invoices/${detailInvoice._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ action: decision, reviewNotes: reviewNotes.trim() || undefined }),
        })
        setDetailInvoice(updated)
        setDecision(null)
        setReviewNotes('')
        await refreshComments(updated._id)
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
    <div className="flex min-h-0 flex-1 flex-col">
      <DashboardTopbar title={title} />
      <InvoiceHubNav />
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 md:py-8">
        <div
          id="raise-reimbursement"
          className="glass scroll-mt-24 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-amber-600">
                <Receipt className="size-4 shrink-0" /> OSEN travel reimbursement
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Up to <strong>₹{TRAVEL_MAX_AMOUNT}</strong> per event (travel + food). Submit bills via Drive link.
                Admin → accounts, tracked under <strong>Invoice tracking</strong>.
              </p>
              <ul className="mt-3 text-xs text-muted-foreground list-disc space-y-1 pl-4">
                <li>Event must be pre-approved by OSEN Core Team</li>
                <li>Fake or edited bills may result in removal from the program</li>
              </ul>
            </div>
            {canRaiseInvoice && (
              <Button
                type="button"
                onClick={openTravelModal}
                className="h-10 shrink-0 gap-2 self-start lg:self-center"
              >
                <Receipt className="size-4" />
                Raise travel invoice
              </Button>
            )}
          </div>
        </div>

        {canRaiseInvoice && (
          <>
            {travelSubmitted && (
              <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 text-sm text-emerald-800 dark:text-emerald-300/90">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Submitted. Admin will review your travel reimbursement. Track status on Invoice tracking (Travel
                    rows).
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/invoice-tracking">Invoice tracking</Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setTravelSubmitted(false)
                      openTravelModal()
                    }}
                  >
                    Submit another
                  </Button>
                </div>
              </div>
            )}

            <Dialog open={travelModalOpen} onOpenChange={setTravelModalOpen}>
              <DialogContent
                className="flex max-h-[92vh] max-w-xl flex-col gap-0 overflow-hidden border-border p-0 sm:max-w-xl"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="border-b border-border/60 px-6 pb-3 pt-5">
                  <DialogHeader>
                    <DialogTitle className="text-base">Raise travel reimbursement</DialogTitle>
                  </DialogHeader>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Name and email start from your account — edit if needed. Max ₹{TRAVEL_MAX_AMOUNT} per event.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <form onSubmit={handleSubmitTravel} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Full name *</label>
                        <Input
                          value={travelForm.fullName}
                          onChange={(e) => setTravelForm((f) => ({ ...f, fullName: e.target.value }))}
                          required
                          className="h-10 bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Email *</label>
                        <Input
                          type="email"
                          value={travelForm.email}
                          onChange={(e) => setTravelForm((f) => ({ ...f, email: e.target.value }))}
                          required
                          className="h-10 bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Phone number *</label>
                      <Input
                        value={travelForm.phone}
                        onChange={(e) => setTravelForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="e.g. 9307227251"
                        required
                        className="h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">OSEN role *</label>
                      <Select
                        value={travelForm.osenRole}
                        onValueChange={(v) =>
                          setTravelForm((f) => ({ ...f, osenRole: v as TravelOsenRole }))
                        }
                      >
                        <SelectTrigger className="h-10 bg-background">
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
                        value={travelForm.eventName}
                        onChange={(e) => setTravelForm((f) => ({ ...f, eventName: e.target.value }))}
                        placeholder="e.g. Hackx"
                        required
                        className="h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Event date *</label>
                      <Popover modal={false}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'h-10 w-full justify-start text-left font-normal bg-background',
                              !travelForm.eventDate && 'text-muted-foreground',
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {travelForm.eventDate
                              ? new Date(travelForm.eventDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Pick event date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={travelForm.eventDate ? new Date(travelForm.eventDate) : undefined}
                            onSelect={(d) =>
                              setTravelForm((f) => ({
                                ...f,
                                eventDate: d ? d.toISOString().slice(0, 10) : '',
                              }))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Was this event pre-approved by OSEN Core Team? *
                      </label>
                      <Select
                        value={travelForm.eventPreApproved ? 'yes' : 'no'}
                        onValueChange={(v) =>
                          setTravelForm((f) => ({ ...f, eventPreApproved: v === 'yes' }))
                        }
                      >
                        <SelectTrigger className="h-10 bg-background">
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
                        value={travelForm.roleAtEvent}
                        onChange={(e) => setTravelForm((f) => ({ ...f, roleAtEvent: e.target.value }))}
                        placeholder="e.g. Speaker / Mentor / Judge"
                        required
                        className="h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Total amount claimed (max ₹{TRAVEL_MAX_AMOUNT}) *
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={TRAVEL_MAX_AMOUNT}
                        value={travelForm.totalAmountClaimed}
                        onChange={(e) => setTravelForm((f) => ({ ...f, totalAmountClaimed: e.target.value }))}
                        placeholder="e.g. 736"
                        required
                        className="h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Budget breakdown *</label>
                      <Input
                        value={travelForm.budgetBreakdown}
                        onChange={(e) => setTravelForm((f) => ({ ...f, budgetBreakdown: e.target.value }))}
                        placeholder="e.g. 436 - food, 300 - travel"
                        required
                        className="h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Bills – Drive link *</label>
                      <p className="text-xs text-muted-foreground">Public, accessible link.</p>
                      <Input
                        type="url"
                        value={travelForm.billsDriveLink}
                        onChange={(e) => setTravelForm((f) => ({ ...f, billsDriveLink: e.target.value }))}
                        placeholder="https://drive.google.com/..."
                        required
                        className="h-10 bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Preferred payment method *</label>
                      <Select
                        value={travelForm.paymentMethod}
                        onValueChange={(v: 'upi' | 'bank_transfer') =>
                          setTravelForm((f) => ({ ...f, paymentMethod: v }))
                        }
                      >
                        <SelectTrigger className="h-10 bg-background">
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

                    {travelForm.paymentMethod === 'upi' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">UPI ID *</label>
                        <Input
                          value={travelForm.upiId}
                          onChange={(e) => setTravelForm((f) => ({ ...f, upiId: e.target.value }))}
                          placeholder="e.g. name@okaxis"
                          required
                          className="h-10 bg-background font-mono"
                        />
                      </div>
                    )}

                    {travelForm.paymentMethod === 'bank_transfer' && (
                      <div className="grid gap-4 space-y-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Account holder name *</label>
                          <Input
                            value={travelForm.bankAccountHolderName}
                            onChange={(e) =>
                              setTravelForm((f) => ({ ...f, bankAccountHolderName: e.target.value }))
                            }
                            required
                            className="h-10 bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Account number *</label>
                          <Input
                            value={travelForm.bankAccountNumber}
                            onChange={(e) =>
                              setTravelForm((f) => ({ ...f, bankAccountNumber: e.target.value }))
                            }
                            required
                            className="h-10 bg-background font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">IFSC code *</label>
                          <Input
                            value={travelForm.bankIfscCode}
                            onChange={(e) => setTravelForm((f) => ({ ...f, bankIfscCode: e.target.value }))}
                            required
                            placeholder="e.g. SBIN0001234"
                            className="h-10 bg-background font-mono"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Notes (optional)</label>
                      <Textarea
                        value={travelForm.notes}
                        onChange={(e) => setTravelForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional"
                        className="min-h-20 resize-none bg-background"
                      />
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <Checkbox
                        id="confirm-travel-modal"
                        checked={travelForm.confirmationChecked}
                        onCheckedChange={(c) =>
                          setTravelForm((f) => ({ ...f, confirmationChecked: !!c }))
                        }
                        className="mt-0.5 size-5 shrink-0"
                      />
                      <label htmlFor="confirm-travel-modal" className="cursor-pointer text-sm leading-snug">
                        I confirm bills are genuine and the total does not exceed ₹{TRAVEL_MAX_AMOUNT}. *
                      </label>
                    </div>

                    <Button type="submit" disabled={travelSubmitting} className="h-10 gap-2">
                      <Send className="size-4" /> Submit reimbursement
                    </Button>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {(isAdmin || isAccounts) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {isAdmin
                  ? `Pending admin review (${adminQueueItems.length})`
                  : `Raised invoices (${accountsQueueItems.length} pending)`}
              </h3>
              {isAccounts && paidInvoices.length > 0 && (
                <span className="text-xs text-muted-foreground">Paid: {paidInvoices.length}</span>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-3">
                {(isAdmin ? adminQueueItems : accountsQueueItems).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items in this stage.</p>
                ) : (
                  (isAdmin ? adminQueueItems : accountsQueueItems).map((item) =>
                    item.kind === 'travel' ? (
                      <div
                        key={item.inv._id}
                        className="glass rounded-xl border border-border/50 p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.inv.eventName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.inv.fullName} · {item.inv.email} · ₹{item.inv.totalAmountClaimed}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={item.inv.status} />
                          <Button size="sm" onClick={() => openDetail(item.inv)}>
                            Review
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.payout._id}
                        className="glass rounded-xl border border-border/50 p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">Points payout · {item.payout.cycleLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.payout.fullName} · {item.payout.email} · ₹{item.payout.requestedPayoutINR} ·{' '}
                            {item.payout.pointsAtSubmit} pts · {item.payout.tierLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={item.payout.status} />
                          <Button size="sm" onClick={() => void openDetailPayout(item.payout._id)}>
                            Review
                          </Button>
                        </div>
                      </div>
                    ),
                  )
                )}

                {isAccounts && rejectedInvoices.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="text-sm font-semibold text-muted-foreground">Rejected (view thread)</div>
                    {rejectedInvoices.map((inv) => (
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
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={inv.status} />
                          <Button size="sm" variant="outline" onClick={() => openDetail(inv)}>
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={inv.status} />
                          <Button size="sm" variant="outline" onClick={() => openDetail(inv)}>
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Dialog
          open={Boolean(detailInvoice || detailPayout || payoutDetailLoading)}
          onOpenChange={(o) => !o && closeReviewModal()}
        >
          {(detailInvoice || detailPayout || payoutDetailLoading) && (
            <DialogContent
              className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {payoutDetailLoading ? (
                <>
                  <DialogTitle className="sr-only">Loading review details</DialogTitle>
                  <div
                    className="px-6 py-12 text-center text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    Loading…
                  </div>
                </>
              ) : detailInvoice ? (
                <>
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

                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
                  <div className="text-sm font-semibold">Payment details (for payout)</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Method</span>
                    <span className="font-medium">
                      {detailInvoice.paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer'}
                    </span>
                    {detailInvoice.paymentMethod === 'upi' ? (
                      <>
                        <span className="text-muted-foreground">UPI ID</span>
                        <span className="font-mono text-primary break-all">
                          {detailInvoice.upiId || '—'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Account holder</span>
                        <span>{detailInvoice.bankAccountHolderName || '—'}</span>
                        <span className="text-muted-foreground">Account number</span>
                        <span className="font-mono">{detailInvoice.bankAccountNumber || '—'}</span>
                        <span className="text-muted-foreground">IFSC</span>
                        <span className="font-mono">{detailInvoice.bankIfscCode || '—'}</span>
                      </>
                    )}
                  </div>
                </div>

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

                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="text-sm font-semibold">Reviewer decisions and reasons</div>
                  {detailInvoice.status === 'rejected' && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3">
                      <p className="text-sm font-semibold text-destructive">Rejection reasons (shown above comments)</p>
                      {detailInvoice.adminReviewNotes && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Admin</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{detailInvoice.adminReviewNotes}</p>
                        </div>
                      )}
                      {detailInvoice.accountsReviewNotes && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Accounts</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{detailInvoice.accountsReviewNotes}</p>
                        </div>
                      )}
                      {!detailInvoice.adminReviewNotes && !detailInvoice.accountsReviewNotes && (
                        <p className="text-sm text-muted-foreground">No written rejection notes on file.</p>
                      )}
                    </div>
                  )}

                  {detailInvoice.status !== 'rejected' &&
                    (detailInvoice.adminReviewNotes || detailInvoice.accountsReviewNotes) && (
                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                        {detailInvoice.adminReviewNotes && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Admin review notes</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{detailInvoice.adminReviewNotes}</p>
                          </div>
                        )}
                        {detailInvoice.accountsReviewNotes && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Accounts review notes</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{detailInvoice.accountsReviewNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="text-sm font-semibold">Review thread (all comments)</div>
                  <p className="text-xs text-muted-foreground">
                    Admin, accounts, and the submitter can add notes here at any stage, including after paid or
                    rejected.
                  </p>
                  {invoiceComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No thread comments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {invoiceComments.map((c, idx) => {
                        const name = c.author?.name || c.author?.email || 'Reviewer'
                        const time = c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN') : ''
                        return (
                          <div
                            key={c._id ? String(c._id) : `${detailInvoice._id}-c-${idx}`}
                            className="rounded-lg border border-border bg-card p-3 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-muted-foreground font-medium truncate">
                                {name}
                                {c.role ? (
                                  <span className="ml-1 text-[10px] uppercase opacity-70">({c.role})</span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-muted-foreground shrink-0">{time}</div>
                            </div>
                            <div className="text-sm whitespace-pre-wrap mt-2 text-foreground">{c.body}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {canPostComment() && (
                    <div className="space-y-2 pt-2">
                      <Textarea
                        placeholder="Add a comment on this reimbursement…"
                        value={newCommentBody}
                        onChange={(e) => setNewCommentBody(e.target.value)}
                        className="min-h-20 bg-background"
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

              <div className="flex justify-end border-t border-border/50 bg-muted/10 px-6 py-3">
                <Button variant="ghost" size="sm" onClick={closeReviewModal}>
                  Close
                </Button>
              </div>
                </>
              ) : detailPayout ? (
                <>
                  <div className="border-b border-border/50 px-6 pb-3 pt-6">
                    <DialogHeader>
                      <DialogTitle className="text-base">Points payout · {detailPayout.cycleLabel}</DialogTitle>
                    </DialogHeader>
                  </div>

                  <div className="border-b border-border/50 px-6 py-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Submitter</span>
                      <span className="min-w-0 truncate">{detailPayout.fullName}</span>
                      <span className="text-muted-foreground">Email</span>
                      <span className="min-w-0 truncate">{detailPayout.email}</span>
                      <span className="text-muted-foreground">Phone</span>
                      <span className="min-w-0 truncate">{detailPayout.phone}</span>
                      <span className="text-muted-foreground">Points at submit</span>
                      <span>{detailPayout.pointsAtSubmit}</span>
                      <span className="text-muted-foreground">Tier</span>
                      <span>{detailPayout.tierLabel}</span>
                      <span className="text-muted-foreground">Admin approved by</span>
                      <span className="min-w-0 truncate">
                        {detailPayout.adminReviewedBy?.name || detailPayout.adminReviewedBy?.email || '—'}
                      </span>
                      <span className="text-muted-foreground">Accounts approved by</span>
                      <span className="min-w-0 truncate">
                        {detailPayout.accountsReviewedBy?.name || detailPayout.accountsReviewedBy?.email || '—'}
                      </span>
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">₹{detailPayout.requestedPayoutINR}</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                    <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
                      <div className="text-sm font-semibold">Payment details (for payout)</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-medium">
                          {detailPayout.paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer'}
                        </span>
                        {detailPayout.paymentMethod === 'upi' ? (
                          <>
                            <span className="text-muted-foreground">UPI ID</span>
                            <span className="break-all font-mono text-primary">{detailPayout.upiId || '—'}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted-foreground">Account holder</span>
                            <span>{detailPayout.bankAccountHolderName || '—'}</span>
                            <span className="text-muted-foreground">Account number</span>
                            <span className="font-mono">{detailPayout.bankAccountNumber || '—'}</span>
                            <span className="text-muted-foreground">IFSC</span>
                            <span className="font-mono">{detailPayout.bankIfscCode || '—'}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {detailPayout.notes && (
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">Notes</div>
                        <div className="whitespace-pre-wrap text-muted-foreground">{detailPayout.notes}</div>
                      </div>
                    )}

                    <div className="space-y-3 border-t border-border/50 pt-2">
                      <div className="text-sm font-semibold">Reviewer decisions and reasons</div>
                      {detailPayout.status === 'rejected' && (
                        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                          <p className="text-sm font-semibold text-destructive">
                            Rejection reasons (shown above comments)
                          </p>
                          {detailPayout.adminReviewNotes && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Admin</p>
                              <p className="whitespace-pre-wrap text-sm text-foreground">
                                {detailPayout.adminReviewNotes}
                              </p>
                            </div>
                          )}
                          {detailPayout.accountsReviewNotes && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Accounts</p>
                              <p className="whitespace-pre-wrap text-sm text-foreground">
                                {detailPayout.accountsReviewNotes}
                              </p>
                            </div>
                          )}
                          {!detailPayout.adminReviewNotes && !detailPayout.accountsReviewNotes && (
                            <p className="text-sm text-muted-foreground">No written rejection notes on file.</p>
                          )}
                        </div>
                      )}

                      {detailPayout.status !== 'rejected' &&
                        (detailPayout.adminReviewNotes || detailPayout.accountsReviewNotes) && (
                          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                            {detailPayout.adminReviewNotes && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Admin review notes</p>
                                <p className="whitespace-pre-wrap text-sm text-foreground">
                                  {detailPayout.adminReviewNotes}
                                </p>
                              </div>
                            )}
                            {detailPayout.accountsReviewNotes && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Accounts review notes</p>
                                <p className="whitespace-pre-wrap text-sm text-foreground">
                                  {detailPayout.accountsReviewNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    <div className="space-y-2 border-t border-border/50 pt-2">
                      <div className="text-sm font-semibold">Discussion (all comments)</div>
                      <p className="text-xs text-muted-foreground">
                        Admin, accounts, and the submitter can post at any stage, including after paid or rejected.
                      </p>
                      {invoiceComments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No thread comments yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {invoiceComments.map((c, idx) => {
                            const name = c.author?.name || c.author?.email || 'Reviewer'
                            const time = c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN') : ''
                            return (
                              <div
                                key={c._id ? String(c._id) : `${detailPayout._id}-c-${idx}`}
                                className="rounded-lg border border-border bg-card p-3 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="truncate text-xs font-medium text-muted-foreground">
                                    {name}
                                    {c.role ? (
                                      <span className="ml-1 text-[10px] uppercase opacity-70">({c.role})</span>
                                    ) : null}
                                  </div>
                                  <div className="shrink-0 text-[10px] text-muted-foreground">{time}</div>
                                </div>
                                <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">{c.body}</div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {canPostComment() && (
                        <div className="space-y-2 pt-2">
                          <Textarea
                            placeholder="Add a comment on this payout request…"
                            value={newCommentBody}
                            onChange={(e) => setNewCommentBody(e.target.value)}
                            className="min-h-20 bg-background"
                          />
                          <div className="flex items-center justify-end">
                            <Button onClick={() => void handleAddComment()} disabled={savingComment} className="gap-2">
                              {savingComment ? 'Adding…' : 'Add comment'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {isAdmin && detailPayout.status === 'pending_admin' && (
                      <div className="space-y-3 border-t border-border/50 pt-3">
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">Admin decision</div>
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
                            className="border-green-500/30 bg-green-500/10 text-green-600"
                            onClick={() => setDecision('approved')}
                          >
                            <CheckCircle2 className="mr-1 size-4" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-500/30 bg-red-500/10 text-red-600"
                            onClick={() => setDecision('rejected')}
                          >
                            <XCircle className="mr-1 size-4" /> Reject
                          </Button>
                        </div>
                        {decision && (
                          <DialogFooter>
                            <Button variant="ghost" disabled={savingDecision} onClick={() => setDecision(null)}>
                              Cancel
                            </Button>
                            <Button disabled={savingDecision} onClick={() => void confirmDecision()}>
                              Confirm
                            </Button>
                          </DialogFooter>
                        )}
                      </div>
                    )}

                    {isAccounts && detailPayout.status === 'pending_accounts' && (
                      <div className="space-y-3 border-t border-border/50 pt-3">
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
                            className="border-green-500/30 bg-green-500/10 text-green-600"
                            onClick={() => setDecision('paid')}
                          >
                            <CheckCircle2 className="mr-1 size-4" /> Approve & Pay
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-500/30 bg-red-500/10 text-red-600"
                            onClick={() => setDecision('rejected')}
                          >
                            <XCircle className="mr-1 size-4" /> Reject
                          </Button>
                        </div>
                        {decision && (
                          <DialogFooter>
                            <Button variant="ghost" disabled={savingDecision} onClick={() => setDecision(null)}>
                              Cancel
                            </Button>
                            <Button disabled={savingDecision} onClick={() => void confirmDecision()}>
                              Confirm
                            </Button>
                          </DialogFooter>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-border/50 bg-muted/10 px-6 py-3">
                    <Button variant="ghost" size="sm" onClick={closeReviewModal}>
                      Close
                    </Button>
                  </div>
                </>
              ) : null}
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  )
}

