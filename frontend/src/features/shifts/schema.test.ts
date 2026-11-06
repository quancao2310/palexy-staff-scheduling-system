import { describe, expect, it } from 'vitest'
import { shiftSchema } from './schema'

describe('shift schema', () => {
  it('accepts whole-hour shifts within a day, including ending at midnight', () => {
    expect(shiftSchema.safeParse({ startHour: 7, endHour: 15 }).success).toBe(true)
    expect(shiftSchema.safeParse({ startHour: 18, endHour: 24 }).success).toBe(true)
  })

  it('requires the end to be after the start and reports it on the end field', () => {
    for (const shift of [
      { startHour: 15, endHour: 15 },
      { startHour: 15, endHour: 7 },
    ]) {
      const result = shiftSchema.safeParse(shift)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['endHour'])
    }
  })

  it('rejects hours outside the day', () => {
    expect(shiftSchema.safeParse({ startHour: 24, endHour: 24 }).success).toBe(false)
    expect(shiftSchema.safeParse({ startHour: 0, endHour: 25 }).success).toBe(false)
  })
})
