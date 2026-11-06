import { describe, expect, it } from 'vitest'
import { formatClock, formatHour12, formatShift, pluralize } from './time'

describe('time formatting', () => {
  it('formats clock times, including midnight at the end of the day', () => {
    expect(formatClock(7)).toBe('07:00')
    expect(formatClock(24)).toBe('24:00')
    expect(formatShift(7, 15)).toBe('07:00 – 15:00')
  })

  it('formats hour labels the way the transaction report does', () => {
    expect([0, 7, 11, 12, 13, 22, 24].map(formatHour12)).toEqual([
      '12am',
      '7am',
      '11am',
      '12pm',
      '1pm',
      '10pm',
      '12am',
    ])
  })

  it('pluralizes', () => {
    expect(pluralize(1, 'shift')).toBe('1 shift')
    expect(pluralize(2, 'shift')).toBe('2 shifts')
    expect(pluralize(0, 'person', 'people')).toBe('0 people')
  })
})
