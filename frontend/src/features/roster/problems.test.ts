import { describe, expect, it } from 'vitest'
import type { Shift } from '@/features/shifts/api'
import { buildSummary } from '@/features/summary/compute'
import type { Assignment } from './api'
import { countShiftConflicts, hoursByStaff, listProblems, overlapOf, shortHours } from './problems'

const morning: Shift = { id: 1, startHour: 7, endHour: 15 }
const evening: Shift = { id: 2, startHour: 15, endHour: 23 }
const midday: Shift = { id: 3, startHour: 11, endHour: 15 }
const shifts = [morning, evening, midday]

const at = (id: number, day: number, shiftId: number, staffId: number): Assignment => ({ id, day, shiftId, staffId })

describe('hoursByStaff', () => {
  it('adds up the length of each assigned shift', () => {
    const hours = hoursByStaff([at(1, 1, 1, 1), at(2, 2, 2, 1), at(3, 1, 3, 2)], shifts)
    expect(hours.get(1)).toBe(16)
    expect(hours.get(2)).toBe(4)
  })
})

describe('overlapOf', () => {
  it('finds a shift that shares an hour on the same day', () => {
    expect(overlapOf(midday, 1, 1, [at(1, 1, 1, 1)], shifts)).toBe(morning)
  })

  it('lets shifts that only touch sit back to back', () => {
    expect(overlapOf(evening, 1, 1, [at(1, 1, 1, 1)], shifts)).toBeUndefined()
  })

  it('ignores other days, other people and the shift itself', () => {
    const assignments = [at(1, 2, 1, 1), at(2, 1, 1, 2), at(3, 1, 3, 1)]
    expect(overlapOf(midday, 1, 1, assignments, shifts)).toBeUndefined()
  })
})

describe('problems in a summary', () => {
  // Monday 07:00 has 40 transactions: needs 3 people.
  const cells = [{ day: 1, hour: 7, transactions: 40 }]
  const staff = [
    { id: 1, name: 'Anna', maxWeeklyHours: 4 },
    { id: 2, name: 'Ben', maxWeeklyHours: 40 },
  ]

  it('separates understaffed hours from hours with nobody, using the summary counts', () => {
    const assignments = [at(1, 1, 1, 1), at(2, 1, 1, 2)]
    const summary = buildSummary(cells, [morning], assignments)
    const problems = listProblems(summary, staff, hoursByStaff(assignments, [morning]))

    expect(problems.understaffed).toContainEqual({ day: 1, hour: 7, needed: 3, scheduled: 2 })
    expect(problems.understaffed).toHaveLength(summary.counts.understaffed)
    expect(problems.nobody).toHaveLength(summary.counts.uncovered)
    expect(problems.nobody.every((gap) => gap.scheduled === 0)).toBe(true)
  })

  it('counts every open hour as short when the cell is empty, and names who is over their maximum', () => {
    const assignments = [at(1, 1, 1, 1)]
    const summary = buildSummary(cells, [morning], assignments)
    expect(shortHours(summary, 2, morning)).toHaveLength(8)
    expect(listProblems(summary, staff, hoursByStaff(assignments, [morning])).overMax).toEqual([
      { staffId: 1, name: 'Anna', hours: 8, maxHours: 4 },
    ])
  })
})

describe('countShiftConflicts', () => {
  it('reports double-booked people and people over their maximum', () => {
    const staff = [{ id: 1, name: 'Anna', maxWeeklyHours: 10 }]
    const result = countShiftConflicts([at(1, 1, 1, 1), at(2, 1, 3, 1)], shifts, staff)
    expect(result).toEqual({ overlapping: 1, overMax: 1 })
  })
})
