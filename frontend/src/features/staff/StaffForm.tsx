import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { showSubmitError } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { staffSchema, type StaffFormValues } from './schema'

interface StaffFormProps {
  idPrefix: string
  defaultValues?: Partial<StaffFormValues>
  submitLabel: string
  layout: 'inline' | 'stacked'
  onSubmit: (values: StaffFormValues) => Promise<unknown>
  onCancel?: () => void
}

export function StaffForm({
  idPrefix,
  defaultValues,
  submitLabel,
  layout,
  onSubmit,
  onCancel,
}: StaffFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isSubmitSuccessful, submitCount },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', ...defaultValues },
  })

  const inline = layout === 'inline'

  // reset() drops RHF's field refs until the next render, so focus has to wait for that render.
  useEffect(() => {
    if (inline && isSubmitSuccessful) setFocus('name')
  }, [inline, isSubmitSuccessful, submitCount, setFocus])

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
      if (inline) reset({ name: '', maxWeeklyHours: undefined })
    } catch (error) {
      showSubmitError(error, setError)
    }
  })

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn('grid gap-4', inline && 'sm:grid-cols-[1fr_11rem_auto] sm:items-start')}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          autoComplete="off"
          autoFocus={!inline}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id={`${idPrefix}-name-error`} role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-hours`}>Max hours per week</Label>
        <Input
          id={`${idPrefix}-hours`}
          type="number"
          inputMode="numeric"
          min={1}
          max={168}
          aria-invalid={!!errors.maxWeeklyHours}
          aria-describedby={errors.maxWeeklyHours ? `${idPrefix}-hours-error` : undefined}
          {...register('maxWeeklyHours', { valueAsNumber: true })}
        />
        {errors.maxWeeklyHours && (
          <p id={`${idPrefix}-hours-error`} role="alert" className="text-sm text-destructive">
            {errors.maxWeeklyHours.message}
          </p>
        )}
      </div>
      <div className={cn('flex justify-end gap-2', inline && 'sm:mt-[1.375rem]')}>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} size={inline ? 'lg' : 'default'}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
