/** Mirrors Frontend/lib/data.ts — server-side validation. */

/** Cycle 1 (original): top tier at exactly 100 pts; points above 100 count as 100 for tier lookup. */
export const PAYOUT_TIERS_CYCLE1: { min: number; max: number; amount: number }[] = [
  { min: 10, max: 20, amount: 500 },
  { min: 21, max: 40, amount: 1000 },
  { min: 41, max: 60, amount: 2000 },
  { min: 61, max: 80, amount: 3000 },
  { min: 81, max: 99, amount: 4000 },
  { min: 100, max: 100, amount: 5000 },
];

export const MONTHLY_POINT_CAP_CYCLE1 = 100;

/** Cycle 2+ — tiered monthly payout (min 10 pts). Max ₹5000 at 181+ pts. */
export const PAYOUT_TIERS: { min: number; max: number; amount: number }[] = [
  { min: 10, max: 20, amount: 500 },
  { min: 21, max: 50, amount: 1000 },
  { min: 51, max: 80, amount: 2000 },
  { min: 81, max: 120, amount: 3000 },
  { min: 121, max: 180, amount: 4000 },
  { min: 181, max: Number.MAX_SAFE_INTEGER, amount: 5000 },
];

export const MONTHLY_POINT_CAP = 181;

export const MIN_POINTS_FOR_PAYOUT = 10;

function payoutTierDisplayRange(t: { min: number; max: number }): string {
  if (t.max >= 1_000_000) return `${t.min}+`;
  if (t.min === t.max) return String(t.min);
  return `${t.min}-${t.max}`;
}

/**
 * @param cycleSequence Contributor period `sequence` from DB. Use `1` for legacy cycle 1 rules; omit or any other value uses cycle 2+ rules.
 */
export function getPayoutForPoints(
  points: number,
  cycleSequence?: number,
): { amount: number; tierLabel: string } {
  const useCycle1 = cycleSequence === 1;
  const tiers = useCycle1 ? PAYOUT_TIERS_CYCLE1 : PAYOUT_TIERS;
  const cap = useCycle1 ? MONTHLY_POINT_CAP_CYCLE1 : MONTHLY_POINT_CAP;

  if (points < MIN_POINTS_FOR_PAYOUT) {
    return { amount: 0, tierLabel: `Below ${MIN_POINTS_FOR_PAYOUT} pts (no payout)` };
  }
  const pts = useCycle1 ? Math.min(Math.floor(points), cap) : Math.floor(points);
  const tier = tiers.find((t) => pts >= t.min && pts <= t.max);
  if (!tier) return { amount: 0, tierLabel: "" };
  return { amount: tier.amount, tierLabel: `${payoutTierDisplayRange(tier)} pts` };
}
