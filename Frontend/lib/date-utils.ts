/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function toIsoLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD or datetime-local into a local Date for calendar display. */
export function parseLocalDateInput(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const datePart = value.slice(0, 10)
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}
