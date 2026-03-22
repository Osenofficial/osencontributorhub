'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Mail, RefreshCw, Search } from 'lucide-react'
import { DashboardTopbar } from '@/components/dashboard-topbar'
import { InvoiceHubNav } from '@/components/invoice-hub-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [status, setStatus] = useState<string>('all')
  const [name, setName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState<TrackingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canAccess = Boolean(currentUser)
  const isFullListRole = currentUser?.role === 'admin' || currentUser?.role === 'accounts'
  const canUseMail = isFullListRole

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
                        <td className="max-w-[10rem] px-3 py-3 font-medium sm:max-w-none sm:px-4">
                          {inv.eventName}
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
      </div>
    </div>
  )
}
