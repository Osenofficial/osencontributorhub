'use client'

import { useEffect, useState } from 'react'
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
    'Event',
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

export default function InvoiceTrackingPage() {
  const { currentUser } = useApp()
  const currentUserId = currentUser?.id
  const role = currentUser?.role
  const [status, setStatus] = useState<string>('all')
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState<TrackingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<InvoiceRecord | null>(null)
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
    override?: Partial<{ name: string; dateFrom: string; dateTo: string; status: string }>,
  ) {
    if (!canAccess) return
    setLoading(true)
    setError(null)
    try {
      const nameVal = override?.name !== undefined ? override.name : name
      const fromVal = override?.dateFrom !== undefined ? override.dateFrom : dateFrom
      const toVal = override?.dateTo !== undefined ? override.dateTo : dateTo
      const statusVal = override?.status !== undefined ? override.status : status

      const params = new URLSearchParams()
      if (statusVal !== 'all') params.set('status', statusVal)
      if (nameVal.trim()) params.set('name', nameVal.trim())
      if (fromVal) params.set('dateFrom', fromVal)
      if (toVal) params.set('dateTo', toVal)
      const q = params.toString() ? `?${params}` : ''
      const data = await apiFetch<TrackingInvoice[]>(`/dashboard/invoices/tracking${q}`)
      setRows(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load invoices'
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
  }, [status, canAccess])

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
    setDetailInvoice(null)
    setDetailLoadError(null)
    setCommentsError(null)
    setInvoiceComments([])
    setNewCommentBody('')
    setDecision(null)
    setReviewNotes('')
  }

  async function openDetail(id: string) {
    setDetailId(id)
    setDetailLoading(true)
    setDetailLoadError(null)
    setCommentsError(null)
    setDetailInvoice(null)
    setInvoiceComments([])
    setNewCommentBody('')
    setDecision(null)
    setReviewNotes('')
    try {
      const inv = await apiFetch<InvoiceRecord>(`/dashboard/invoices/${id}`)
      setDetailInvoice(inv)
      try {
        const list = await apiFetch<InvoiceComment[]>(`/dashboard/invoices/${id}/comments`)
        setInvoiceComments(list ?? [])
      } catch {
        setCommentsError('Could not load the discussion thread.')
        setInvoiceComments([])
      }
    } catch (e: unknown) {
      setDetailLoadError(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshThreadComments(invoiceId?: string) {
    const id = invoiceId ?? detailInvoice?._id
    if (!id) return
    setCommentsError(null)
    try {
      const list = await apiFetch<InvoiceComment[]>(`/dashboard/invoices/${id}/comments`)
      setInvoiceComments(list ?? [])
    } catch {
      setCommentsError('Could not load the discussion thread.')
      setInvoiceComments([])
    }
  }

  function canPostComment() {
    if (!detailInvoice || !currentUserId) return false
    if (isAdmin) return true
    if (isAccounts) return true
    const sid = detailInvoice.submittedBy?._id
    return Boolean(sid && String(sid) === String(currentUserId))
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
      await refreshThreadComments()
    } finally {
      setSavingComment(false)
    }
  }

  async function confirmDecision() {
    if (!detailInvoice || !decision || !role) return
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
        await refreshThreadComments(updated._id)
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
        await refreshThreadComments(updated._id)
        void load()
      } finally {
        setSavingDecision(false)
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
                    {isFullListRole ? 'All invoices' : 'Your invoices'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isFullListRole
                      ? 'Search and filter the full list. Mail is available for admin & accounts.'
                      : 'Only your reimbursement submissions are shown.'}{' '}
                    Export downloads a CSV row for each entry.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  Name / event
                </Label>
                <Input
                  id="inv-search-name"
                  placeholder="Search name or event…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 bg-background"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-date-from" className="text-xs text-muted-foreground">
                  Event date from
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
                  Event date to
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
          </div>

          {error && <p className="px-4 py-2 text-xs text-destructive sm:px-5">{error}</p>}

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              {defaultFilters && !isFullListRole
                ? 'You have no reimbursement invoices yet.'
                : defaultFilters && isFullListRole
                  ? 'No invoices yet.'
                  : 'No invoices match your search or filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3 font-medium sm:px-4">Event</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Submitter</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Amount</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Payment</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Status</th>
                    <th className="px-3 py-3 font-medium sm:px-4">Submitted</th>
                    <th className="px-3 py-3 text-right font-medium sm:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((inv) => {
                    const mail = inv.submittedBy?.email || inv.email
                    return (
                      <tr key={inv._id} className="hover:bg-muted/30">
                        <td className="max-w-[10rem] px-3 py-3 sm:max-w-none sm:px-4">
                          <button
                            type="button"
                            className="max-w-full truncate text-left font-medium text-primary hover:underline decoration-primary/50"
                            onClick={() => void openDetail(inv._id)}
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
                              onClick={() => void openDetail(inv._id)}
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
            {detailLoading && !detailInvoice && !detailLoadError ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading invoice…</div>
            ) : detailLoadError && !detailInvoice ? (
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
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
