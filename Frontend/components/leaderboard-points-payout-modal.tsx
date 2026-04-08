'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Coins, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api'

type PayoutMeta = {
  fullName: string
  email: string
  points: number
  requestedPayoutINR: number
  tierLabel: string
  eligible: boolean
  minPoints: number
  /** Period these points / tier / amount are computed for */
  contributorPeriodId: string
  cycleLabel: string
  periods: { _id: string; sequence: number; label: string; isActive: boolean }[]
  suggestedPeriodId: string | null
}

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Leaderboard cycle selection — preselects contributor period in the form */
  selectedPeriodId: string | null
  canSubmit: boolean
  onSubmitted?: () => void
}

export function LeaderboardPointsPayoutModal({
  open,
  onOpenChange,
  selectedPeriodId,
  canSubmit,
  onSubmitted,
}: Props) {
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [meta, setMeta] = useState<PayoutMeta | null>(null)

  const [periodId, setPeriodId] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank_transfer'>('upi')
  const [upiId, setUpiId] = useState('')
  const [bankAccountHolderName, setBankAccountHolderName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankIfscCode, setBankIfscCode] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmationChecked, setConfirmationChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !canSubmit) return
    let cancelled = false
    const forPeriod = periodId.trim() || selectedPeriodId?.trim() || ''
    const url =
      forPeriod !== ''
        ? `/dashboard/payout-requests/meta?contributorPeriodId=${encodeURIComponent(forPeriod)}`
        : '/dashboard/payout-requests/meta'
    setMetaLoading(true)
    setMetaError(null)
    apiFetch<PayoutMeta>(url)
      .then((data) => {
        if (cancelled) return
        setMeta(data)
        const ids = new Set(data.periods.map((p) => p._id))
        setPeriodId((prev) => {
          if (prev && ids.has(prev)) return prev
          const prefer =
            selectedPeriodId && ids.has(selectedPeriodId) ? selectedPeriodId : null
          return (
            prefer ??
            data.contributorPeriodId ??
            data.suggestedPeriodId ??
            data.periods[0]?._id ??
            ''
          )
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setMetaError(e instanceof Error ? e.message : 'Could not load payout form')
        setMeta(null)
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, canSubmit, periodId, selectedPeriodId])

  useEffect(() => {
    if (!open) {
      setMetaError(null)
      setMeta(null)
      setPeriodId('')
      setConfirmationChecked(false)
      setPhone('')
      setUpiId('')
      setBankAccountHolderName('')
      setBankAccountNumber('')
      setBankIfscCode('')
      setNotes('')
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !meta?.eligible || !periodId) return
    if (!phone.trim() || !confirmationChecked) return
    if (paymentMethod === 'upi' && !upiId.trim()) return
    if (
      paymentMethod === 'bank_transfer' &&
      (!bankAccountHolderName.trim() || !bankAccountNumber.trim() || !bankIfscCode.trim())
    ) {
      return
    }

    setSubmitting(true)
    try {
      await apiFetch('/dashboard/payout-requests', {
        method: 'POST',
        body: JSON.stringify({
          contributorPeriodId: periodId,
          fullName: meta.fullName,
          email: meta.email,
          phone: phone.trim(),
          paymentMethod,
          upiId: paymentMethod === 'upi' ? upiId.trim() : undefined,
          bankAccountHolderName: paymentMethod === 'bank_transfer' ? bankAccountHolderName.trim() : undefined,
          bankAccountNumber: paymentMethod === 'bank_transfer' ? bankAccountNumber.trim() : undefined,
          bankIfscCode: paymentMethod === 'bank_transfer' ? bankIfscCode.trim() : undefined,
          notes: notes.trim() || undefined,
          confirmationChecked: true,
        }),
      })
      onOpenChange(false)
      onSubmitted?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border/60 px-6 pb-3 pt-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Coins className="size-4 text-violet-500" />
              Points tier payout
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-xs text-muted-foreground">
            Points, tier, and amount are for the <strong>contributor cycle</strong> you select (same as the leaderboard
            for that cycle). Full detail stays under <strong>Invoice tracking</strong>.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {!canSubmit ? (
            <p className="text-sm text-muted-foreground">Only contributors can submit points payouts from here.</p>
          ) : metaLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : metaError ? (
            <p className="text-sm text-destructive">{metaError}</p>
          ) : meta && !meta.eligible ? (
            <p className="text-sm text-muted-foreground">
              You need at least <strong>{meta.minPoints}</strong> completed points. You have <strong>{meta.points}</strong>.
            </p>
          ) : meta ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                <div className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-2">
                  <span className="text-muted-foreground">Cycle</span>
                  <span className="font-medium">{meta.cycleLabel}</span>
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{meta.fullName}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span className="truncate">{meta.email}</span>
                  <span className="text-muted-foreground">Points</span>
                  <span className="font-mono">{meta.points}</span>
                  <span className="text-muted-foreground">Tier</span>
                  <span>{meta.tierLabel}</span>
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">₹{meta.requestedPayoutINR}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Contributor cycle *</label>
                <Select value={periodId} onValueChange={setPeriodId} required>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta.periods.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.label}
                        {p.isActive ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone *</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-10 bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment *</label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as 'upi' | 'bank_transfer')}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'upi' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">UPI ID *</label>
                  <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} required className="h-10 bg-background font-mono" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account holder *</label>
                    <Input
                      value={bankAccountHolderName}
                      onChange={(e) => setBankAccountHolderName(e.target.value)}
                      required
                      className="h-10 bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account number *</label>
                    <Input
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      required
                      className="h-10 bg-background font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IFSC *</label>
                    <Input
                      value={bankIfscCode}
                      onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                      required
                      className="h-10 bg-background font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 bg-background" />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <Checkbox
                  id="lb-payout-confirm"
                  checked={confirmationChecked}
                  onCheckedChange={(c) => setConfirmationChecked(c === true)}
                  className="mt-0.5 size-5 shrink-0 border-2 border-border bg-background shadow-sm data-[state=unchecked]:border-muted-foreground/50"
                />
                <label
                  htmlFor="lb-payout-confirm"
                  className="cursor-pointer text-sm leading-snug text-foreground"
                >
                  I confirm payout details are accurate and I am authorized to receive this payment. *
                </label>
              </div>

              <Button type="submit" disabled={submitting || !periodId} className="w-full gap-2 sm:w-auto">
                <Send className="size-4" />
                {submitting ? 'Submitting…' : 'Submit payout request'}
              </Button>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
