import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { scheduleKeys } from '@/features/schedules/api'

/** One person working one shift on one day (day: 1 = Monday ... 7 = Sunday). */
export interface Assignment {
  id: number
  day: number
  shiftId: number
  staffId: number
}

export type WarningType = 'UNDERSTAFFED' | 'UNCOVERED_HOUR' | 'UNDER_UTILISED'

export interface RosterWarning {
  type: WarningType
  day: number | null
  hour: number | null
  staffId: number | null
  needed: number | null
  scheduled: number | null
  /** A sentence ready to show. */
  message: string
}

export interface StaffLoad {
  staffId: number
  name: string
  hours: number
  maxHours: number
  utilisation: number
}

export interface RosterStats {
  shortfallStaffHours: number
  unmetTransactions: number
  idleStaffHours: number
  score: number
  staff: StaffLoad[]
}

export interface AutoScheduleResult {
  assignments: Assignment[]
  warnings: RosterWarning[]
  stats: RosterStats
}

export function useAssignments(scheduleId: number) {
  return useQuery({
    queryKey: scheduleKeys.assignments(scheduleId),
    queryFn: () => api<Assignment[]>(`/schedules/${scheduleId}/assignments`),
  })
}

/** Drafts a roster, replacing the current one. */
export function useAutoSchedule(scheduleId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<AutoScheduleResult>(`/schedules/${scheduleId}/auto-schedule`, { method: 'POST' }),
    onSuccess: (result) => queryClient.setQueryData(scheduleKeys.assignments(scheduleId), result.assignments),
  })
}
