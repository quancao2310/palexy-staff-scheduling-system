import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { refreshSummary, scheduleKeys } from '@/features/schedules/api'

export interface StaffMember {
  id: number
  name: string
  maxWeeklyHours: number
}

export interface StaffInput {
  name: string
  maxWeeklyHours: number
}

export function useStaff(scheduleId: number) {
  return useQuery({
    queryKey: scheduleKeys.staff(scheduleId),
    queryFn: () => api<StaffMember[]>(`/schedules/${scheduleId}/staff`),
  })
}

function useStaffMutation<TVariables>(
  scheduleId: number,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.staff(scheduleId) }),
        refreshSummary(queryClient, scheduleId),
      ]),
  })
}

export function useAddStaff(scheduleId: number) {
  return useStaffMutation(scheduleId, (input: StaffInput) =>
    api<StaffMember>(`/schedules/${scheduleId}/staff`, { method: 'POST', body: JSON.stringify(input) }),
  )
}

export function useUpdateStaff(scheduleId: number) {
  return useStaffMutation(scheduleId, ({ id, ...input }: StaffInput & { id: number }) =>
    api<StaffMember>(`/schedules/${scheduleId}/staff/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  )
}

export function useRemoveStaff(scheduleId: number) {
  return useStaffMutation(scheduleId, (id: number) =>
    api<void>(`/schedules/${scheduleId}/staff/${id}`, { method: 'DELETE' }),
  )
}
