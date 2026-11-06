import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from './api'

export function showSubmitError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (error instanceof ApiError && error.problem?.errors) {
    const entries = Object.entries(error.problem.errors)
    if (entries.length > 0) {
      for (const [field, message] of entries) {
        setError(field as FieldPath<T>, { type: 'server', message })
      }
      return
    }
  }
  toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
}

export function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
}
