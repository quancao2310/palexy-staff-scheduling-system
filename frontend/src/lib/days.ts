/** ISO weekday numbers, matching the API (1 = Monday ... 7 = Sunday). */
export const DAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 7, short: 'Sun', long: 'Sunday' },
] as const

export function dayName(value: number, form: 'short' | 'long' = 'long') {
  return DAYS.find((d) => d.value === value)?.[form] ?? ''
}
