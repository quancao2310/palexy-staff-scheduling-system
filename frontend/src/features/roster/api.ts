import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
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

/** Where an assignment goes: one person on one shift on one day. */
export interface AssignmentSlot {
  day: number
  shiftId: number
  staffId: number
}

/** Rows that exist only on this screen until the server answers have a negative id. */
export const isSaving = (assignment: Assignment) => assignment.id < 0

let nextTempId = -1

function useAssignmentEdits(scheduleId: number) {
  const queryClient = useQueryClient()
  const key = scheduleKeys.assignments(scheduleId)
  const mutationKey = ['assignments', scheduleId]

  const change = (update: (rows: Assignment[]) => Assignment[]) =>
    queryClient.setQueryData<Assignment[]>(key, (rows) => update(rows ?? []))

  // Rapid clicks run several edits at once; only the last one to finish re-reads the server,
  // otherwise an early answer would briefly undo the edits still in flight.
  const settle = () =>
    queryClient.isMutating({ mutationKey }) === 1 ? queryClient.invalidateQueries({ queryKey: key }) : undefined

  return { mutationKey, change, settle, cancel: () => queryClient.cancelQueries({ queryKey: key }) }
}

/** Puts a person on a shift. The roster updates at once and is rolled back if the server refuses. */
export function useAddAssignment(scheduleId: number) {
  const { mutationKey, change, settle, cancel } = useAssignmentEdits(scheduleId)
  return useMutation({
    mutationKey,
    mutationFn: async (slot: AssignmentSlot) => {
      try {
        return await api<Assignment>(`/schedules/${scheduleId}/assignments`, {
          method: 'POST',
          body: JSON.stringify(slot),
        })
      } catch (error) {
        // Already there (409): the goal is met; the refetch after the edits brings the real row.
        if (error instanceof ApiError && error.status === 409) return undefined
        throw error
      }
    },
    onMutate: async (slot) => {
      await cancel()
      const tempId = nextTempId--
      change((rows) => [...rows, { id: tempId, ...slot }])
      return { tempId }
    },
    onSuccess: (saved, _slot, context) => {
      if (saved) change((rows) => rows.map((row) => (row.id === context.tempId ? saved : row)))
    },
    onError: (_error, _slot, context) => {
      if (context) change((rows) => rows.filter((row) => row.id !== context.tempId))
    },
    onSettled: settle,
  })
}

/** Takes a person off a shift. The roster updates at once and is rolled back if the server refuses. */
export function useRemoveAssignment(scheduleId: number) {
  const { mutationKey, change, settle, cancel } = useAssignmentEdits(scheduleId)
  return useMutation({
    mutationKey,
    mutationFn: async (assignment: Assignment) => {
      try {
        await api<void>(`/schedules/${scheduleId}/assignments/${assignment.id}`, { method: 'DELETE' })
      } catch (error) {
        // Already gone (404): the goal is met.
        if (!(error instanceof ApiError && error.status === 404)) throw error
      }
    },
    onMutate: async (assignment) => {
      await cancel()
      change((rows) => rows.filter((row) => row.id !== assignment.id))
    },
    onError: (_error, assignment) => change((rows) => [...rows, assignment]),
    onSettled: settle,
  })
}
