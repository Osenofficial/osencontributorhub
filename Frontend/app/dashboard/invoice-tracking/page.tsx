'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  MessageSquareText,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { InvoiceHubNav } from '@/components/invoice-hub-nav'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApp } from '@/lib/app-context'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

type InvoiceStatus = 'pending_admin' | 'pending_accounts' | 'paid' | 'rejected'

type TrackingInvoice = {
  _id: string
  fullName: string
  email: string
  eventName: string
  eventDate: string
  totalAmountClaimed: number
  paymentMethod: string
  status: InvoiceStatus
  paidAt?: string
  submittedBy?: { name?: string; email?: string }
  createdAt: string
}

/** Full invoice from GET /dashboard/invoices/:id (detail + thread). */
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

type TrackingPayout = {
  _id: string
  fullName: string
  email: string
  cycleLabel: string
  pointsAtSubmit: number
  requestedPayoutINR: number
  tierLabel: string
  paymentMethod: string
  status: InvoiceStatus
  paidAt?: string
  submittedBy?: { name?: string; email?: string }
  createdAt: string
}

type TrackingRow = ({ kind: 'travel' } & TrackingInvoice) | ({ kind: 'payout' } & TrackingPayout)

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
  contributorPeriod?: { sequence: number; label: string }
}

const STATUS_LABEL: Record<string, string> = {
  all: 'All statuses',
  pending_admin: 'Pending admin',
  pending_accounts: 'Pending accounts',
  paid: 'Paid',
  rejected: 'Rejected',
}

function escapeCsvCell(v: unknown): string {
  const s = String(v ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function mailtoInvoice(inv: TrackingInvoice) {
  const email = inv.submittedBy?.email || inv.email
  if (!email?.trim()) return
  const subject = encodeURIComponent(`Update on Reimbursement for ${inv.eventName}`)
  const body = encodeURIComponent(
    `Hello,\n\nReimbursement reference:\n• Event: ${inv.eventName}\n• Event date: ${new Date(inv.eventDate).toLocaleDateString('en-IN')}\n• Amount: ₹${inv.totalAmountClaimed}\n• Status: ${STATUS_LABEL[inv.status] || inv.status}\n\nRegards,`,
  )
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
}

function exportInvoiceRow(inv: TrackingInvoice) {
  const header = [
    'Type',
    'Subject',
    'Submitter',
    'Email',
    'Amount (INR)',
    'Payment',
    'Status',
    'Submitted',
    'Event date',
    'Paid date',
  ]
  const name = inv.submittedBy?.name || inv.fullName
  const email = inv.submittedBy?.email || inv.email
  const row = [
    'Travel',
    inv.eventName,
    name,
    email,
    String(inv.totalAmountClaimed),
    inv.paymentMethod,
    inv.status,
    new Date(inv.createdAt).toISOString().slice(0, 10),
    new Date(inv.eventDate).toLocaleDateString('en-IN'),
    inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-IN') : '',
  ]
  const csv = '\ufeff' + header.map(escapeCsvCell).join(',') + '\n' + row.map(escapeCsvCell).join(',')
  downloadCsv(`invoice-${String(inv._id).slice(-8)}.csv`, csv)
}

function mailtoPayout(p: TrackingPayout) {
  const email = p.submittedBy?.email || p.email
  if (!email?.trim()) return
  const subject = encodeURIComponent(`Update on points payout — ${p.cycleLabel}`)
  const body = encodeURIComponent(
    `Hello,\n\nPoints payout reference:\n• Cycle: ${p.cycleLabel}\n• Points at submit: ${p.pointsAtSubmit}\n• Tier: ${p.tierLabel}\n• Amount: ₹${p.requestedPayoutINR}\n• Status: ${STATUS_LABEL[p.status] || p.status}\n\nRegards,`,
  )
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
}

function exportPayoutRow(p: TrackingPayout) {
  const header = [
    'Type',
    'Cycle',
    'Submitter',
    'Email',
    'Points',
    'Tier',
    'Amount (INR)',
    'Payment',
    'Status',
    'Submitted',
    'Paid date',
  ]
  const name = p.submittedBy?.name || p.fullName
  const email = p.submittedBy?.email || p.email
  const row = [
    'Points payout',
    p.cycleLabel,
    name,
    email,
    String(p.pointsAtSubmit),
    p.tierLabel,
    String(p.requestedPayoutINR),
    p.paymentMethod,
    p.status,
    new Date(p.createdAt).toISOString().slice(0, 10),
    p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '',
  ]
  const csv = '\ufeff' + header.map(escapeCsvCell).join(',') + '\n' + row.map(escapeCsvCell).join(',')
  downloadCsv(`payout-${String(p._id).slice(-8)}.csv`, csv)
}

export default function InvoiceTrackingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser } = useApp()
  const currentUserId = currentUser?.id
  const role = currentUser?.role
  const [trackingView, setTrackingView] = useState<'all' | 'travel' | 'payout'>('all')
  const [status, setStatus] = useState<string>('all')
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState<TrackingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailKind, setDetailKind] = useState<'travel' | 'payout' | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<InvoiceRecord | null>(null)
  const [detailPayout, setDetailPayout] = useState<PayoutRecord | null>(null)
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [invoiceComments, setInvoiceComments] = useState<InvoiceComment[]>([])
  const [newCommentBody, setNewCommentBody] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'paid' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)

  const canAccess = Boolean(currentUser)
  const isFullListRole = currentUser?.role === 'admin' || currentUser?.role === 'accounts'
  const canUseMail = isFullListRole
  const isAdmin = role === 'admin'
  const isAccounts = role === 'accounts'

  async function load(
    override?: Partial<{
      name: string
      dateFrom: string
      dateTo: string
      status: string
      trackingView: 'all' | 'travel' | 'payout'
    }>,
  ) {
    if (!canAccess) return
    setLoading(true)
    setError(null)
    try {
      const nameVal = override?.name !== undefined ? override.name : name
      const fromVal = override?.dateFrom !== undefined ? override.dateFrom : dateFrom
      const toVal = override?.dateTo !== undefined ? override.dateTo : dateTo
      const statusVal = override?.status !== undefined ? override.status : status
      const viewVal = override?.trackingView !== undefined ? override.trackingView : trackingView

      const params = new URLSearchParams()
      if (statusVal !== 'all') params.set('status', statusVal)
      if (nameVal.trim()) params.set('name', nameVal.trim())
      if (fromVal) params.set('dateFrom', fromVal)
      if (toVal) params.set('dateTo', toVal)
      const q = params.toString() ? `?${params}` : ''

      const needTravel = viewVal !== 'payout'
      const needPayout = viewVal !== 'travel'

      const [travelData, payoutData] = await Promise.all([
        needTravel
          ? apiFetch<TrackingInvoice[]>(`/dashboard/invoices/tracking${q}`).catch(() => [] as TrackingInvoice[])
          : Promise.resolve([] as TrackingInvoice[]),
        needPayout
          ? apiFetch<TrackingPayout[]>(`/dashboard/payout-requests/tracking${q}`).catch(() => [] as TrackingPayout[])
          : Promise.resolve([] as TrackingPayout[]),
      ])

      const travelRows: TrackingRow[] = travelData.map((inv) => ({ kind: 'travel' as const, ...inv }))
      const payoutRows: TrackingRow[] = payoutData.map((p) => ({ kind: 'payout' as const, ...p }))

      if (viewVal === 'all') {
        const merged = [...travelRows, ...payoutRows].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        setRows(merged)
      } else if (viewVal === 'travel') {
        setRows(travelRows)
      } else {
        setRows(payoutRows)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load tracking data'
      setError(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canAccess) {
      setLoading(false)
      return
    }
    void load()
  }, [status, canAccess, trackingView])

  function handleSearch() {
    void load()
  }

  function handleClearAll() {
    setName('')
    setDateFrom('')
    setDateTo('')
    setStatus('all')
    void load({ name: '', dateFrom: '', dateTo: '', status: 'all' })
  }

  const defaultFilters = !name.trim() && !dateFrom && !dateTo && status === 'all'

  function closeDetail() {
    setDetailId(null)
    setDetailKind(null)
    setDetailInvoice(null)
    setDetailPayout(null)
    setDetailLoadError(null)
    setCommentsError(null)
    setInvoiceComments([])
    setNewCommentBody('')
    setDecision(null)
    setReviewNotes('')
  }

  const openDetail = useCallback(async (id: string, kind: 'travel' | 'payout') => {
    setDetailId(id)
    setDetailKind(kind)
    setDetailLoading(true)
    setDetailLoadError(null)
    setCommentsError(null)
    setDetailInvoice(null)
    setDetailPayout(null)
    setInvoiceComments([])
    setNewCommentBody('')
    setDecision(null)
    setReviewNotes('')
    try {
      if (kind === 'travel') {
        const inv = await apiFetch<InvoiceRecord>(`/dashboard/invoices/${id}`)
        setDetailInvoice(inv)
        try {
          const list = await apiFetch<InvoiceComment[]>(`/dashboard/invoices/${id}/comments`)
          setInvoiceComments(list ?? [])
        } catch {
          setCommentsError('Could not load the discussion thread.')
          setInvoiceComments([])
        }
      } else {
        const p = await apiFetch<PayoutRecord>(`/dashboard/payout-requests/${id}`)
        setDetailPayout(p)
        try {
          const list = await apiFetch<InvoiceComment[]>(`/dashboard/payout-requests/${id}/comments`)
          setInvoiceComments(list ?? [])
        } catch {
          setCommentsError('Could not load the discussion thread.')
          setInvoiceComments([])
        }
      }
    } catch (e: unknown) {
      setDetailLoadError(e instanceof Error ? e.message : 'Failed to load record')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = searchParams.get('openPayout')
    if (!id || !canAccess) return
    void (async () => {
      await openDetail(id, 'payout')
      router.replace('/dashboard/invoice-tracking', { scroll: false })
    })()
  }, [searchParams, canAccess, router, openDetail])

  async function refreshThreadComments(recordId?: string, kind?: 'travel' | 'payout' | null) {
    const id = recordId ?? (detailKind === 'payout' ? detailPayout?._id : detailInvoice?._id)
    const k = kind ?? detailKind
    if (!id || !k) return
    setCommentsError(null)
    try {
      const path =
        k === 'travel' ? `/dashboard/invoices/${id}/comments` : `/dashboard/payout-requests/${id}/comments`
      const list = await apiFetch<InvoiceComment[]>(path)
      setInvoiceComments(list ?? [])
    } catch {
      setCommentsError('Could not load the discussion thread.')
      setInvoiceComments([])
    }
  }

  function canPostComment() {
    if (!currentUserId) return false
    if (isAdmin) return true
    if (isAccounts) return true
    if (detailKind === 'travel' && detailInvoice) {
      const sid = detailInvoice.submittedBy?._id
      return Boolean(sid && String(sid) === String(currentUserId))
    }
    if (detailKind === 'payout' && detailPayout) {
      const sid = detailPayout.submittedBy?._id
      return Boolean(sid && String(sid) === String(currentUserId))
    }
    return false
  }

  async function handleAddComment() {
    const id = detailKind === 'payout' ? detailPayout?._id : detailInvoice?._id
    if (!id || !detailKind) return
    if (!canPostComment()) return
    const trimmed = newCommentBody.trim()
    if (!trimmed) return
    setSavingComment(true)
    try {
      const path =
        detailKind === 'travel'
          ? `/dashboard/invoices/${id}/comments`
          : `/dashboard/payout-requests/${id}/comments`
      await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      })
      setNewCommentBody('')
      await refreshThreadComments(id, detailKind)
    } finally {
      setSavingComment(false)
    }
  }

  async function confirmDecision() {
    if (!decision || !role) return
    if (detailKind === 'travel' && detailInvoice) {
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
          await refreshThreadComments(updated._id, 'travel')
          void load()
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
          await refreshThreadComments(updated._id, 'travel')
          void load()
        } finally {
          setSavingDecision(false)
        }
      }
      return
    }
    if (detailKind === 'payout' && detailPayout) {
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
          await refreshThreadComments(updated._id, 'payout')
          void load()
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
          await refreshThreadComments(updated._id, 'payout')
          void load()
        } finally {
          setSavingDecision(false)
        }
      }
    }
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DashboardTopbar title="Invoice tracking" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DashboardTopbar title="Invoice tracking" />
      <InvoiceHubNav />
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6 md:py-8">
        <div className="glass overflow-hidden rounded-2xl border">
          <div className="flex flex-col gap-4 border-b border-border/50 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">
                    {isFullListRole ? 'Travel & points payouts' : 'Your requests'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isFullListRole
                      ? 'Travel reimbursements and tier points payouts share this tracker. Mail is available for admin & accounts.'
                      : 'Your travel reimbursements and points payout requests appear here.'}{' '}
                    Export downloads a CSV row per entry.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-border/60 bg-background p-0.5 text-xs font-medium">
                  {(['all', 'travel', 'payout'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTrackingView(v)}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 transition-colors',
                        trackingView === v
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {v === 'all' ? 'All' : v === 'travel' ? 'Travel' : 'Points'}
                    </button>
                  ))}
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[min(100%,11rem)] bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => load()}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="inv-search-name" className="text-xs text-muted-foreground">
                  Name / subject
                </Label>
                <Input
                  id="inv-search-name"
                  placeholder="Name, email, event, or cycle…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 bg-background"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-date-from" className="text-xs text-muted-foreground">
                  Date from
                </Label>
                <Input
                  id="inv-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-date-to" className="text-xs text-muted-foreground">
                  Date to
                </Label>
                <Input
                  id="inv-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 bg-background"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                <Button type="button" size="sm" className="gap-1.5" onClick={handleSearch} disabled={loading}>
                  <Search className="size-3.5" />
                  Search
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleClearAll} disabled={loading}>
                  All
                </Button>
              </div>
            </div>
            <p className="px-4 pb-2 text-[11px] text-muted-foreground sm:px-5">
              Travel rows filter by <span className="font-medium text-foreground">event date</span>. Points payout rows
              filter by <span className="font-medium text-foreground">submitted date</span> (same date pickers).
            </p>
          </div>

          {error && <p className="px-4 py-2 text-xs text-destructive sm:px-5">{error}</p>}

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              {defaultFilters && !isFullListRole
                ? 'You have no travel or points payout requests yet.'
                : defaultFilters && isFullListRole
                  ? 'No entries yet.'
                  : 'Nothing matches your search or filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3 font-medium sm:px-4">Type</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Subject</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Submitter</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Amount</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Payment</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Status</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Submitted</th>
                    <th className="px-3 py-3 text-right font-medium sm:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((row) => {
                    if (row.kind === 'travel') {
                      const inv = row
                      const mail = inv.submittedBy?.email || inv.email
                      return (
                        <tr key={`t-${inv._id}`} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-3 py-3 text-xs sm:px-4">
                            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                              Travel
                            </span>
                          </td>
                          <td className="max-w-[10rem] px-3 py-3 sm:max-w-none sm:px-4">
                            <button
                              type="button"
                              className="max-w-full truncate text-left font-medium text-primary hover:underline decoration-primary/50"
                              onClick={() => void openDetail(inv._id, 'travel')}
                            >
                              {inv.eventName}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground sm:px-4">
                            <div>{inv.submittedBy?.name || inv.fullName}</div>
                            <div className="text-xs">{mail}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 sm:px-4">₹{inv.totalAmountClaimed}</td>
                          <td className="px-3 py-3 text-xs uppercase sm:px-4">
                            {inv.paymentMethod === 'upi' ? 'UPI' : 'Bank'}
                          </td>
                          <td className="px-3 py-3 sm:px-4">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                inv.status === 'paid' && 'bg-green-500/15 text-green-600',
                                inv.status === 'rejected' && 'bg-red-500/15 text-red-600',
                                inv.status === 'pending_admin' && 'bg-amber-500/15 text-amber-600',
                                inv.status === 'pending_accounts' && 'bg-blue-500/15 text-blue-600',
                              )}
                            >
                              {STATUS_LABEL[inv.status] || inv.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground sm:px-4">
                            {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-right sm:px-4">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2"
                                title="Details, rejection notes, and full discussion"
                                onClick={() => void openDetail(inv._id, 'travel')}
                              >
                                <MessageSquareText className="size-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              {canUseMail && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 px-2"
                                  disabled={!mail?.trim()}
                                  title={mail?.trim() ? 'Email submitter (Gmail / default mail)' : 'No email'}
                                  onClick={() => mailtoInvoice(inv)}
                                >
                                  <Mail className="size-3.5" />
                                  <span className="hidden sm:inline">Mail</span>
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2"
                                title="Download this row as CSV"
                                onClick={() => exportInvoiceRow(inv)}
                              >
                                <Download className="size-3.5" />
                                <span className="hidden sm:inline">Export</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    const p = row
                    const mail = p.submittedBy?.email || p.email
                    return (
                      <tr key={`p-${p._id}`} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-3 py-3 text-xs sm:px-4">
                          <span className="rounded-md bg-violet-500/15 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-400">
                            Points
                          </span>
                        </td>
                        <td className="max-w-[12rem] px-3 py-3 sm:max-w-none sm:px-4">
                          <button
                            type="button"
                            className="max-w-full truncate text-left font-medium text-primary hover:underline decoration-primary/50"
                            onClick={() => void openDetail(p._id, 'payout')}
                          >
                            {p.cycleLabel}
                          </button>
                          <div className="text-[11px] text-muted-foreground">
                            {p.pointsAtSubmit} pts · {p.tierLabel}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground sm:px-4">
                          <div>{p.submittedBy?.name || p.fullName}</div>
                          <div className="text-xs">{mail}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">₹{p.requestedPayoutINR}</td>
                        <td className="px-3 py-3 text-xs uppercase sm:px-4">
                          {p.paymentMethod === 'upi' ? 'UPI' : 'Bank'}
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              p.status === 'paid' && 'bg-green-500/15 text-green-600',
                              p.status === 'rejected' && 'bg-red-500/15 text-red-600',
                              p.status === 'pending_admin' && 'bg-amber-500/15 text-amber-600',
                              p.status === 'pending_accounts' && 'bg-blue-500/15 text-blue-600',
                            )}
                          >
                            {STATUS_LABEL[p.status] || p.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground sm:px-4">
                          {new Date(p.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-3 text-right sm:px-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2"
                              title="Details and discussion"
                              onClick={() => void openDetail(p._id, 'payout')}
                            >
                              <MessageSquareText className="size-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                            {canUseMail && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2"
                                disabled={!mail?.trim()}
                                title={mail?.trim() ? 'Email submitter' : 'No email'}
                                onClick={() => mailtoPayout(p)}
                              >
                                <Mail className="size-3.5" />
                                <span className="hidden sm:inline">Mail</span>
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 px-2"
                              title="Download this row as CSV"
                              onClick={() => exportPayoutRow(p)}
                            >
                              <Download className="size-3.5" />
                              <span className="hidden sm:inline">Export</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={detailId !== null} onOpenChange={(o) => !o && closeDetail()}>
          <DialogContent
            className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {detailLoading && !detailInvoice && !detailPayout && !detailLoadError ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : detailLoadError && !detailInvoice && !detailPayout ? (
              <div className="space-y-4 px-6 py-6">
                <p className="text-sm text-destructive">{detailLoadError}</p>
                <Button variant="outline" size="sm" onClick={closeDetail}>
                  Close
                </Button>
              </div>
            ) : detailInvoice ? (
              <>
                <div className="border-b border-border/50 px-6 pb-3 pt-6">
                  <DialogHeader>
                    <DialogTitle className="text-base">{detailInvoice.eventName}</DialogTitle>
                  </DialogHeader>
                </div>

                <div className="border-b border-border/50 px-6 py-4">
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

                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                  <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
                    <div className="text-sm font-semibold">Payment details (for payout)</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Method</span>
                      <span className="font-medium">
                        {detailInvoice.paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer'}
                      </span>
                      {detailInvoice.paymentMethod === 'upi' ? (
                        <>
                          <span className="text-muted-foreground">UPI ID</span>
                          <span className="break-all font-mono text-primary">{detailInvoice.upiId || '—'}</span>
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
                    <div className="mb-1 text-sm font-semibold">Bills link</div>
                    <a
                      href={detailInvoice.billsDriveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 break-all text-primary hover:underline"
                    >
                      {detailInvoice.billsDriveLink.slice(0, 60)}… <ExternalLink className="size-3" />
                    </a>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Budget breakdown</div>
                    <div className="whitespace-pre-wrap text-muted-foreground">{detailInvoice.budgetBreakdown}</div>
                  </div>

                  {detailInvoice.notes && (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Notes</div>
                      <div className="whitespace-pre-wrap text-muted-foreground">{detailInvoice.notes}</div>
                    </div>
                  )}

                  <div className="space-y-3 border-t border-border/50 pt-2">
                    <div className="text-sm font-semibold">Reviewer decisions and reasons</div>
                    {detailInvoice.status === 'rejected' && (
                      <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                        <p className="text-sm font-semibold text-destructive">
                          Rejection reasons (shown above comments)
                        </p>
                        {detailInvoice.adminReviewNotes && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Admin</p>
                            <p className="whitespace-pre-wrap text-sm text-foreground">
                              {detailInvoice.adminReviewNotes}
                            </p>
                          </div>
                        )}
                        {detailInvoice.accountsReviewNotes && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Accounts</p>
                            <p className="whitespace-pre-wrap text-sm text-foreground">
                              {detailInvoice.accountsReviewNotes}
                            </p>
                          </div>
                        )}
                        {!detailInvoice.adminReviewNotes && !detailInvoice.accountsReviewNotes && (
                          <p className="text-sm text-muted-foreground">No written rejection notes on file.</p>
                        )}
                      </div>
                    )}

                    {detailInvoice.status !== 'rejected' &&
                      (detailInvoice.adminReviewNotes || detailInvoice.accountsReviewNotes) && (
                        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                          {detailInvoice.adminReviewNotes && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Admin review notes</p>
                              <p className="whitespace-pre-wrap text-sm text-foreground">
                                {detailInvoice.adminReviewNotes}
                              </p>
                            </div>
                          )}
                          {detailInvoice.accountsReviewNotes && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Accounts review notes</p>
                              <p className="whitespace-pre-wrap text-sm text-foreground">
                                {detailInvoice.accountsReviewNotes}
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
                    {commentsError && <p className="text-xs text-destructive">{commentsError}</p>}
                    {invoiceComments.length === 0 && !commentsError ? (
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
                          placeholder="Add a comment on this reimbursement…"
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

                  {isAdmin && detailInvoice.status === 'pending_admin' && (
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

                  {isAccounts && detailInvoice.status === 'pending_accounts' && (
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
                  <Button variant="ghost" size="sm" onClick={closeDetail}>
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
                    {commentsError && <p className="text-xs text-destructive">{commentsError}</p>}
                    {invoiceComments.length === 0 && !commentsError ? (
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
                  <Button variant="ghost" size="sm" onClick={closeDetail}>
                    Close
                  </Button>
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
