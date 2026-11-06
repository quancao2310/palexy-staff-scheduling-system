import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { refreshSummary, scheduleKeys } from '@/features/schedules/api'

export interface Shift {
  id: number
  startHour: number
  endHour: number
}

export interface ShiftInput {
  startHour: number
  endHour: number
}

export function useShifts(scheduleId: number) {
  return useQuery({
    queryKey: scheduleKeys.shifts(scheduleId),
    queryFn: () => api<Shift[]>(`/schedules/${scheduleId}/shifts`),
  })
}

function useShiftMutation<TVariables>(
  scheduleId: number,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.shifts(scheduleId) }),
        refreshSummary(queryClient, scheduleId),
      ]),
  })
}

export function useAddShift(scheduleId: number) {
  return useShiftMutation(scheduleId, (input: ShiftInput) =>
    api<Shift>(`/schedules/${scheduleId}/shifts`, { method: 'POST', body: JSON.stringify(input) }),
  )
}

export function useUpdateShift(scheduleId: number) {
  return useShiftMutation(scheduleId, ({ id, ...input }: ShiftInput & { id: number }) =>
    api<Shift>(`/schedules/${scheduleId}/shifts/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  )
}

export function useRemoveShift(scheduleId: number) {
  return useShiftMutation(scheduleId, (id: number) =>
    api<void>(`/schedules/${scheduleId}/shifts/${id}`, { method: 'DELETE' }),
  )
}
