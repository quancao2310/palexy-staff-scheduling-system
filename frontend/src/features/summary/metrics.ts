import type { Status } from './compute'

export type Metric = 'perStaffHour' | 'transactions' | 'staffHours'

export const METRICS: { value: Metric; label: string }[] = [
  { value: 'perStaffHour', label: 'Per staff-hour' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'staffHours', label: 'Staff hours' },
]

export const STATUS_LABEL: Record<Status, string> = {
  understaffed: 'understaffed',
  balanced: 'balanced',
  quiet: 'quiet',
  uncovered: 'nobody scheduled',
  empty: 'closed',
}

export function formatRatio(value: number | null) {
  return value === null ? '–' : value.toFixed(1)
}
