export type ContributorPeriodRow = {
  _id: string
  sequence: number
  label: string
  startedAt: string
  endedAt: string | null
  isActive: boolean
}

export type ContributorPeriodsResponse = {
  periods: ContributorPeriodRow[]
}

export type LeaderboardPeriodPayload = {
  id: string
  sequence: number
  label: string
  startedAt: string
  endedAt: string | null
  isActive: boolean
}

export type LeaderboardResponse = {
  period: LeaderboardPeriodPayload
  leaderboard: unknown[]
}

export function leaderboardUrl(periodId: string | null | undefined): string {
  if (periodId) return `/dashboard/leaderboard?periodId=${encodeURIComponent(periodId)}`
  return '/dashboard/leaderboard'
}

/** Prefer the open cycle; else most recent by sequence. */
export function pickDefaultPeriodId(periods: ContributorPeriodRow[]): string | null {
  const active = periods.find((p) => p.isActive)
  if (active) return String(active._id)
  if (periods[0]) return String(periods[0]._id)
  return null
}
