import type { OccurrenceItem } from "@/types";

/** Jobs that fire more than this many times per day on average are "noisy". */
export const NOISY_THRESHOLD = 5;

/**
 * Returns the set of schedule strings that are considered noisy
 * (fire more than NOISY_THRESHOLD times per day on average over the given window).
 */
export function getNoisySchedules(
  occurrences: OccurrenceItem[],
  windowDays: number
): Set<string> {
  const counts = new Map<string, number>();
  for (const occ of occurrences) {
    counts.set(occ.schedule, (counts.get(occ.schedule) ?? 0) + 1);
  }
  const noisy = new Set<string>();
  const days = Math.max(windowDays, 1);
  for (const [schedule, count] of counts) {
    if (count / days > NOISY_THRESHOLD) noisy.add(schedule);
  }
  return noisy;
}
