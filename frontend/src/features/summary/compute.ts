import type { Shift } from '@/features/shifts/api'
import type { TransactionCell } from '@/features/demand/api'
import type { Assignment } from '@/features/roster/api'

/**
 * Mirror of the auto-scheduler's demand model, so the summary calls an hour "understaffed" exactly when
 * the roster warnings do. N is `app.scheduler.transactions-per-staff-hour` and the ratio is
 * `shortfallWeight / idleWeight` from `SchedulerParams.defaults` (backend, autoschedule/engine).
 * No API exposes them yet; if the backend values change, change them here too.
 */
export const TRANSACTIONS_PER_STAFF_HOUR = 16
const SHORTFALL_RATIO = 2

/** An hour counts as quiet below half the target workload. This one is a display choice, not the scheduler's. */
export const QUIET_BELOW = TRANSACTIONS_PER_STAFF_HOUR / 2

/** Staff an hour needs: one per full N transactions, plus one if the leftover keeps them busy enough; at least one. */
export function needOf(transactions: number): number {
  const full = Math.floor(transactions / TRANSACTIONS_PER_STAFF_HOUR)
  const leftover = transactions % TRANSACTIONS_PER_STAFF_HOUR
  const extraPerson = leftover * (SHORTFALL_RATIO + 1) > TRANSACTIONS_PER_STAFF_HOUR
  return Math.max(1, full + (extraPerson ? 1 : 0))
}

export type Status = 'understaffed' | 'balanced' | 'quiet' | 'uncovered' | 'empty'

export interface Figures {
  transactions: number
  staffHours: number
  /** transactions / staffHours, or null when nobody is scheduled (division by zero guard). */
  perStaffHour: number | null
}

export interface SummaryCell extends Figures {
  day: number
  hour: number
  /** Staff the scheduler's rule asks for in this hour; 0 when no shift covers the hour. */
  needed: number
  status: Status
}

export interface Summary {
  days: number[]
  hours: number[]
  cell: (day: number, hour: number) => SummaryCell
  dayTotal: (day: number) => Figures
  hourTotal: (hour: number) => Figures
  week: Figures
  /** Mean of the hourly ratios, over hours that have staff. Differs from week.perStaffHour. */
  averagePerStaffHour: number | null
  /** Hourly cells only (not totals) per status. */
  counts: { understaffed: number; quiet: number; uncovered: number }
}

export function figures(transactions: number, staffHours: number): Figures {
  return { transactions, staffHours, perStaffHour: staffHours === 0 ? null : transactions / staffHours }
}

function isQuiet({ perStaffHour }: Figures) {
  return perStaffHour !== null && perStaffHour < QUIET_BELOW
}

/**
 * Status of one hour. Nobody scheduled in an hour that has demand or needs staff is "uncovered"
 * (the roster warnings call it understaffed, or "no shift covers it" for hours outside every shift).
 */
export function cellStatus(f: Figures, needed: number): Status {
  if (f.staffHours === 0) return f.transactions > 0 || needed > 0 ? 'uncovered' : 'empty'
  if (f.staffHours < needed) return 'understaffed'
  return isQuiet(f) ? 'quiet' : 'balanced'
}

/** Status of a day, hour-of-day or week total. Summed hours cannot be "understaffed" under the per-hour rule. */
export function totalStatus(f: Figures): Status {
  if (f.perStaffHour === null) return f.transactions > 0 ? 'uncovered' : 'empty'
  return isQuiet(f) ? 'quiet' : 'balanced'
}

const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7]

/**
 * Builds every number on the summary page from the three raw inputs. Hour h means the clock hour
 * [h, h+1); a shift [start, end) covers hours start..end-1, and an hour is open when any shift covers it.
 * Staff hours in a cell are the distinct people on shift in that hour, so a person double-booked
 * by a manual edit still counts once.
 */
export function buildSummary(cells: TransactionCell[], shifts: Shift[], assignments: Assignment[]): Summary {
  const transactionsAt = new Map(cells.map((c) => [`${c.day}-${c.hour}`, c.transactions]))
  const shiftById = new Map(shifts.map((s) => [s.id, s]))

  const openHours = new Set<number>()
  for (const { startHour, endHour } of shifts) {
    for (let hour = startHour; hour < endHour; hour++) openHours.add(hour)
  }

  const peopleAt = new Map<string, Set<number>>()
  for (const { day, shiftId, staffId } of assignments) {
    const shift = shiftById.get(shiftId)
    if (!shift) continue
    for (let hour = shift.startHour; hour < shift.endHour; hour++) {
      const key = `${day}-${hour}`
      const people = peopleAt.get(key) ?? new Set<number>()
      people.add(staffId)
      peopleAt.set(key, people)
    }
  }

  const usedHours = [...cells.map((c) => c.hour), ...openHours]
  const first = Math.min(...usedHours)
  const last = Math.max(...usedHours)
  const hours = usedHours.length === 0 ? [] : Array.from({ length: last - first + 1 }, (_, i) => first + i)

  const grid = new Map<string, SummaryCell>()
  const counts = { understaffed: 0, quiet: 0, uncovered: 0 }
  const ratios: number[] = []
  for (const day of DAY_VALUES) {
    for (const hour of hours) {
      const f = figures(transactionsAt.get(`${day}-${hour}`) ?? 0, peopleAt.get(`${day}-${hour}`)?.size ?? 0)
      const needed = openHours.has(hour) ? needOf(f.transactions) : 0
      const status = cellStatus(f, needed)
      grid.set(`${day}-${hour}`, { day, hour, needed, status, ...f })
      if (f.perStaffHour !== null) ratios.push(f.perStaffHour)
      if (status === 'understaffed' || status === 'quiet' || status === 'uncovered') counts[status]++
    }
  }

  const all = [...grid.values()]
  const total = (rows: SummaryCell[]) =>
    figures(
      rows.reduce((s, c) => s + c.transactions, 0),
      rows.reduce((s, c) => s + c.staffHours, 0),
    )

  return {
    days: DAY_VALUES,
    hours,
    cell: (day, hour) => grid.get(`${day}-${hour}`)!,
    dayTotal: (day) => total(all.filter((c) => c.day === day)),
    hourTotal: (hour) => total(all.filter((c) => c.hour === hour)),
    week: total(all),
    averagePerStaffHour: ratios.length === 0 ? null : ratios.reduce((s, r) => s + r, 0) / ratios.length,
    counts,
  }
}
