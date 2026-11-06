import { describe, expect, it } from 'vitest'
import { buildSummary, needOf } from './compute'

describe('needOf (mirrors the scheduler: one per 16 transactions, +1 if the leftover is 6 or more)', () => {
  it.each([
    [0, 1],
    [15, 1],
    [21, 1],
    [22, 2],
    [32, 2],
    [57, 4],
    [64, 4],
    [70, 5],
  ])('%i transactions need %i', (transactions, needed) => {
    expect(needOf(transactions)).toBe(needed)
  })
})

describe('buildSummary', () => {
  const shifts = [
    { id: 1, startHour: 9, endHour: 11 },
    { id: 2, startHour: 10, endHour: 11 },
  ]
  const cells = [
    { day: 1, hour: 9, transactions: 10 },
    { day: 1, hour: 10, transactions: 40 },
  ]
  // Monday: two people 09-11, a third joins for the busy 10-11 hour.
  const assignments = [
    { id: 1, day: 1, shiftId: 1, staffId: 1 },
    { id: 2, day: 1, shiftId: 1, staffId: 2 },
    { id: 3, day: 1, shiftId: 2, staffId: 3 },
  ]

  it('counts the people on shift in each clock hour', () => {
    const summary = buildSummary(cells, shifts, assignments)

    expect(summary.hours).toEqual([9, 10])
    expect(summary.cell(1, 9).staffHours).toBe(2)
    expect(summary.cell(1, 10).staffHours).toBe(3)
    expect(summary.dayTotal(1)).toMatchObject({ transactions: 50, staffHours: 5 })
    expect(summary.hourTotal(10)).toMatchObject({ transactions: 40, staffHours: 3 })
  })

  it('counts a person double-booked in the same hour once', () => {
    const doubled = [...assignments, { id: 4, day: 1, shiftId: 2, staffId: 1 }]

    expect(buildSummary(cells, shifts, doubled).cell(1, 10).staffHours).toBe(3)
  })

  it('shows no ratio instead of dividing by zero when nobody is scheduled', () => {
    const summary = buildSummary(cells, shifts, assignments)

    expect(summary.cell(2, 9)).toMatchObject({ staffHours: 0, perStaffHour: null })
  })

  it('reports the overall ratio and the average of the hourly ratios separately', () => {
    const { week, averagePerStaffHour } = buildSummary(cells, shifts, assignments)

    expect(week).toMatchObject({ transactions: 50, staffHours: 5 })
    expect(week.perStaffHour).toBe(10) // 50 / 5
    expect(averagePerStaffHour).toBeCloseTo((5 + 40 / 3) / 2) // mean of 10/2 and 40/3, ignoring hours with no staff
  })

  it('classifies hours: quiet, balanced, understaffed against the need rule, uncovered', () => {
    const summary = buildSummary(
      [
        { day: 1, hour: 7, transactions: 12 }, // 3 staff, need 1: quiet (4.0 per staff-hour)
        { day: 1, hour: 9, transactions: 57 }, // 3 staff, need 4: understaffed, though only 19.0 per staff-hour
        { day: 2, hour: 13, transactions: 64 }, // 4 staff, need 4: balanced
        { day: 1, hour: 23, transactions: 10 }, // no shift covers it, nobody there
      ],
      [{ id: 1, startHour: 7, endHour: 15 }],
      [
        ...[1, 2, 3].map((staffId) => ({ id: staffId, day: 1, shiftId: 1, staffId })),
        ...[1, 2, 3, 4].map((staffId) => ({ id: 10 + staffId, day: 2, shiftId: 1, staffId })),
      ],
    )

    expect(summary.cell(1, 7)).toMatchObject({ status: 'quiet', needed: 1 })
    expect(summary.cell(1, 9)).toMatchObject({ status: 'understaffed', needed: 4, staffHours: 3 })
    expect(summary.cell(1, 9).perStaffHour).toBe(19)
    expect(summary.cell(2, 13)).toMatchObject({ status: 'balanced', needed: 4 })
    expect(summary.cell(1, 23)).toMatchObject({ status: 'uncovered', needed: 0 })
  })

  it('counts statuses over hourly cells only', () => {
    // Monday 09 is quiet (10 over 2 staff = 5); every other day's two open hours have nobody.
    expect(buildSummary(cells, shifts, assignments).counts).toEqual({
      understaffed: 0,
      quiet: 1,
      uncovered: 12,
    })
  })

  it('ignores assignments to shifts that no longer exist', () => {
    const summary = buildSummary(cells, shifts, [{ id: 9, day: 1, shiftId: 99, staffId: 1 }])

    expect(summary.week.staffHours).toBe(0)
  })
})
