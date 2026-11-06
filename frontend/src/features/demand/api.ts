import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { refreshSummary, scheduleKeys } from '@/features/schedules/api'

export interface TransactionCell {
  day: number
  hour: number
  transactions: number
}

export interface Transactions {
  hasData: boolean
  fileName: string | null
  uploadedAt: string | null
  cells: TransactionCell[]
  total: number
  peak: TransactionCell | null
  warnings: string[]
}

export function useTransactions(scheduleId: number) {
  return useQuery({
    queryKey: scheduleKeys.transactions(scheduleId),
    queryFn: () => api<Transactions>(`/schedules/${scheduleId}/transactions`),
  })
}

export function useUploadTransactions(scheduleId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api<Transactions>(`/schedules/${scheduleId}/transactions`, { method: 'PUT', body })
    },
    onSuccess: (data) => {
      queryClient.setQueryData(scheduleKeys.transactions(scheduleId), { ...data, warnings: [] })
      return refreshSummary(queryClient, scheduleId)
    },
  })
}

export function useClearTransactions(scheduleId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/schedules/${scheduleId}/transactions`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.transactions(scheduleId) }),
        refreshSummary(queryClient, scheduleId),
      ]),
  })
}
