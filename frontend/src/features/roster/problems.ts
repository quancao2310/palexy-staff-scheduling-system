import type { Shift } from '@/features/shifts/api'
import type { StaffMember } from '@/features/staff/api'
import type { Summary } from '@/features/summary/compute'
import type { Assignment } from './api'

const lengthOf = (shift: Shift) => shift.endHour - shift.startHour

/**
 * Weekly hours per person: the sum of their assigned shift lengths. This is the scheduler's own rule, so a
 * person double-booked by a later shift-time edit counts both shifts, which is what flags them as a problem.
 */
export function hoursByStaff(assignments: Assignment[], shifts: Shift[]): Map<number, number> {
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const hours = new Map<number, number>()
  for (const { shiftId, staffId } of assignments) {
    const shift = shiftById.get(shiftId)
    if (shift) hours.set(staffId, (hours.get(staffId) ?? 0) + lengthOf(shift))
  }
  return hours
}

/** True when two shifts share at least one clock hour. Shifts that only touch (15:00 end, 15:00 start) do not overlap. */
export function overlaps(a: Shift, b: Shift): boolean {
  return a.startHour < b.endHour && b.startHour < a.endHour
}

/** Another shift this person already works on `day` that overlaps `shift`, if any. */
export function overlapOf(
  shift: Shift,
  day: number,
  staffId: number,
  assignments: Assignment[],
  shifts: Shift[],
): Shift | undefined {
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  for (const a of assignments) {
    if (a.day !== day || a.staffId !== staffId || a.shiftId === shift.id) continue
    const other = shiftById.get(a.shiftId)
    if (other && overlaps(shift, other)) return other
  }
  return undefined
}

export interface HourGap {
  day: number
  hour: number
  needed: number
  scheduled: number
}

/** Hours of this shift on this day with fewer people than the demand calls for (including nobody at all). */
export function shortHours(summary: Summary, day: number, shift: Shift): HourGap[] {
  const gaps: HourGap[] = []
  for (let hour = shift.startHour; hour < shift.endHour; hour++) {
    const cell = summary.cell(day, hour)
    if (cell && cell.staffHours < cell.needed) {
      gaps.push({ day, hour, needed: cell.needed, scheduled: cell.staffHours })
    }
  }
  return gaps
}

export interface OverMax {
  staffId: number
  name: string
  hours: number
  maxHours: number
}

export interface Problems {
  /** Some people on shift, but fewer than needed. Same hours as the Summary tab's "understaffed" count. */
  understaffed: HourGap[]
  /** Nobody on shift in an hour with demand. `needed === 0` means no shift covers the hour at all. */
  nobody: HourGap[]
  overMax: OverMax[]
}

export function overMaxOf(staff: StaffMember[], hours: Map<number, number>): OverMax[] {
  return staff
    .map((person) => ({
      staffId: person.id,
      name: person.name,
      hours: hours.get(person.id) ?? 0,
      maxHours: person.maxWeeklyHours,
    }))
    .filter((person) => person.hours > person.maxHours)
}

/** Everything the warnings strip lists. The two hour lists come straight from the summary's own statuses. */
export function listProblems(summary: Summary, staff: StaffMember[], hours: Map<number, number>): Problems {
  const understaffed: HourGap[] = []
  const nobody: HourGap[] = []
  for (const day of summary.days) {
    for (const hour of summary.hours) {
      const cell = summary.cell(day, hour)
      const gap = { day, hour, needed: cell.needed, scheduled: cell.staffHours }
      if (cell.status === 'understaffed') understaffed.push(gap)
      else if (cell.status === 'uncovered') nobody.push(gap)
    }
  }
  return { understaffed, nobody, overMax: overMaxOf(staff, hours) }
}

/** People working two overlapping shifts on one day, and people over their maximum: what a shift-time edit can cause. */
export function countShiftConflicts(assignments: Assignment[], shifts: Shift[], staff: StaffMember[]) {
  const doubleBooked = new Set<number>()
  for (const a of assignments) {
    const shift = shifts.find((s) => s.id === a.shiftId)
    if (shift && overlapOf(shift, a.day, a.staffId, assignments, shifts)) doubleBooked.add(a.staffId)
  }
  return {
    overlapping: doubleBooked.size,
    overMax: overMaxOf(staff, hoursByStaff(assignments, shifts)).length,
  }
}
