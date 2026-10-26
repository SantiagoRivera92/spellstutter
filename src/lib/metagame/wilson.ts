/**
 * Wilson score interval for a binomial proportion.
 *
 * Estimates the range the true win rate most plausibly lies in, given the
 * number of decided games. Unlike the raw win rate it widens for small
 * samples, so 60% over 20 games is not treated the same as 60% over 20,000.
 */
export interface WilsonInterval {
  low: number;
  high: number;
  /** Interval centre: the sample proportion shrunk toward 0.5. */
  center: number;
}

/**
 * @param wins   games won
 * @param losses games lost
 * @param z      normal quantile (1.96 = 95% confidence, the default)
 * @returns the interval, or null when there are no decided games
 */
export function wilsonScoreInterval(
  wins: number,
  losses: number,
  z = 1.96,
): WilsonInterval | null {
  const n = wins + losses;
  if (n <= 0) return null;

  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin =
    (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    center,
  };
}
