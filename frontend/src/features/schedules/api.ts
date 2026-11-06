import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Schedule {
  id: number
  name: string
  createdAt: string
  updatedAt: string
  staffCount: number
  shiftCount: number
  hasTransactions: boolean
  transactionsFileName: string | null
  transactionsUploadedAt: string | null
}

export interface ScheduleInput {
  name: string
}

export const scheduleKeys = {
  list: ['schedules'] as const,
  detail: (id: number) => ['schedules', id] as const,
  staff: (id: number) => ['schedules', id, 'staff'] as const,
  shifts: (id: number) => ['schedules', id, 'shifts'] as const,
  transactions: (id: number) => ['schedules', id, 'transactions'] as const,
  assignments: (id: number) => ['schedules', id, 'assignments'] as const,
}

export function refreshSummary(queryClient: QueryClient, id: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: scheduleKeys.list, exact: true }),
    queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(id), exact: true }),
  ])
}

export function useSchedules() {
  return useQuery({ queryKey: scheduleKeys.list, queryFn: () => api<Schedule[]>('/schedules') })
}

export function useSchedule(id: number) {
  return useQuery({
    queryKey: scheduleKeys.detail(id),
    queryFn: () => api<Schedule>(`/schedules/${id}`),
    retry: false,
  })
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ScheduleInput) =>
      api<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.list, exact: true }),
  })
}

export function useRenameSchedule(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ScheduleInput) =>
      api<Schedule>(`/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => refreshSummary(queryClient, id),
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/schedules/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: scheduleKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: scheduleKeys.list, exact: true })
    },
  })
}
