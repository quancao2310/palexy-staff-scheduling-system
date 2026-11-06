import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { showSubmitError } from '@/lib/forms'
import { useCreateSchedule, useRenameSchedule, type Schedule } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100, 'Use at most 100 characters'),
})
type Values = z.infer<typeof schema>

interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: Schedule
}

export function ScheduleFormDialog({ open, onOpenChange, schedule }: ScheduleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <ScheduleForm schedule={schedule} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({ schedule, onDone }: { schedule?: Schedule; onDone: () => void }) {
  const navigate = useNavigate()
  const create = useCreateSchedule()
  const rename = useRenameSchedule(schedule?.id ?? 0)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: schedule?.name ?? '' } })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (schedule) {
        await rename.mutateAsync(values)
        toast.success('Schedule renamed')
        onDone()
      } else {
        const created = await create.mutateAsync(values)
        onDone()
        navigate(`/schedules/${created.id}`)
      }
    } catch (error) {
      showSubmitError(error, setError)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{schedule ? 'Rename schedule' : 'New schedule'}</DialogTitle>
        <DialogDescription>
          {schedule
            ? 'Give this schedule a clearer name.'
            : 'A schedule plans one typical week. Name it after the store or the period, e.g. "Downtown – autumn".'}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="schedule-name">Name</Label>
        <Input
          id="schedule-name"
          autoFocus
          autoComplete="off"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'schedule-name-error' : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p id="schedule-name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {schedule ? 'Save' : 'Create schedule'}
        </Button>
      </DialogFooter>
    </form>
  )
}
