import { redirect } from 'next/navigation'

/** Points payout is submitted from the Leaderboard (modal). Old URL keeps working. */
export default function PointsPayoutRedirectPage() {
  redirect('/dashboard/leaderboard?payout=1')
}
