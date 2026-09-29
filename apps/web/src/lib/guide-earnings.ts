/** The fee Mshwar plans once online payments exist (docs/guide-experience-plan.md, section 3). */
export const PLANNED_FEE_PERCENT = 12;
/** Weeks in an average month. */
const WEEKS_PER_MONTH = 52 / 12;

export type EarningsInput = {
  /** Price of a tour per guest, in dollars. */
  tourPrice: number;
  guestsPerTour: number;
  toursPerWeek: number;
  /** Day rate when hired for a planned day, in dollars. */
  dayRate: number;
  hiredDaysPerWeek: number;
};

export type EarningsEstimate = { weekly: number; monthly: number; monthlyAfterPlannedFee: number };

const clean = (value: number, max: number) => (Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0);
const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * An illustrative estimate from the guide's own numbers: what their prices would bring in a
 * week and a month, today (no fee) and once the planned fee applies. Never a promise.
 */
export function estimateEarnings(input: EarningsInput): EarningsEstimate {
  const tours = clean(input.tourPrice, 10_000) * clean(input.guestsPerTour, 60) * clean(input.toursPerWeek, 56);
  const hired = clean(input.dayRate, 10_000) * clean(input.hiredDaysPerWeek, 7);
  const weekly = tours + hired;
  const monthly = weekly * WEEKS_PER_MONTH;
  return {
    weekly: cents(weekly),
    monthly: cents(monthly),
    monthlyAfterPlannedFee: cents(monthly * (1 - PLANNED_FEE_PERCENT / 100)),
  };
}
