import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { showSubmitError } from '@/lib/forms'
import { formatClock, formatShift, pluralize } from '@/lib/time'
import type { Shift } from './api'
import { HOURS_OF_DAY, shiftSchema, type ShiftFormValues } from './schema'

interface ShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: Shift
  onSubmit: (values: ShiftFormValues) => Promise<unknown>
}

export function ShiftDialog({ open, onOpenChange, shift, onSubmit }: ShiftDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <ShiftForm shift={shift} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

interface ShiftFormProps {
  shift?: Shift
  onSubmit: (values: ShiftFormValues) => Promise<unknown>
  onCancel: () => void
}

function ShiftForm({ shift, onSubmit, onCancel }: ShiftFormProps) {
  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { startHour: shift?.startHour ?? 9, endHour: shift?.endHour ?? 17 },
  })
  const startHour = useWatch({ control, name: 'startHour' })
  const endHour = useWatch({ control, name: 'endHour' })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (error) {
      showSubmitError(error, setError)
    }
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{shift ? 'Edit shift' : 'Add a shift'}</DialogTitle>
        <DialogDescription>
          Shifts run on whole hours within a single day. Pick when people start and finish.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="shift-start">Starts</Label>
          <Controller
            control={control}
            name="startHour"
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(value) => {
                  const start = Number(value)
                  field.onChange(start)
                  if (endHour <= start) setValue('endHour', Math.min(start + 1, 24))
                }}
              >
                <SelectTrigger id="shift-start" className="w-full" aria-label="Start time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS_OF_DAY.map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatClock(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="shift-end">Ends</Label>
          <Controller
            control={control}
            name="endHour"
            render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                <SelectTrigger
                  id="shift-end"
                  className="w-full"
                  aria-label="End time"
                  aria-invalid={!!errors.endHour}
                  aria-describedby={errors.endHour ? 'shift-end-error' : undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS_OF_DAY.filter((hour) => hour + 1 > startHour).map((hour) => (
                    <SelectItem key={hour + 1} value={String(hour + 1)}>
                      {formatClock(hour + 1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {errors.endHour && (
        <p id="shift-end-error" role="alert" className="-mt-2 text-sm text-destructive">
          {errors.endHour.message}
        </p>
      )}
      {endHour > startHour && (
        <p className="text-sm text-muted-foreground">
          {formatShift(startHour, endHour)} · {pluralize(endHour - startHour, 'hour')}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {shift ? 'Save' : 'Add shift'}
        </Button>
      </DialogFooter>
    </form>
  )
}
