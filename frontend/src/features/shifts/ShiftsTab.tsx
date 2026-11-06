import { Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useScheduleId } from '@/features/schedules/useScheduleId'
import { showError } from '@/lib/forms'
import { formatShift, pluralize } from '@/lib/time'
import { useAddShift, useRemoveShift, useShifts, useUpdateShift, type Shift } from './api'
import { ShiftDialog } from './ShiftDialog'

const AXIS_HOURS = [0, 6, 12, 18, 24]

export function ShiftsTab() {
  const scheduleId = useScheduleId()
  const { data: shifts, isPending, isError, refetch } = useShifts(scheduleId)
  const add = useAddShift(scheduleId)
  const update = useUpdateShift(scheduleId)
  const remove = useRemoveShift(scheduleId)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [removing, setRemoving] = useState<Shift | null>(null)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-medium">Shifts</h2>
          <p className="text-sm text-muted-foreground">
            The work periods people can be assigned to. Each runs on whole hours within one day.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus /> Add shift
        </Button>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load the shifts</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isPending && <Skeleton className="h-32 w-full rounded-xl" aria-label="Loading shifts" />}

      {shifts && shifts.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
          <Clock className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">No shifts yet</p>
          <p className="text-sm text-muted-foreground">Add at least one shift so staff can be scheduled.</p>
        </div>
      )}

      {shifts && shifts.length > 0 && (
        <div className="rounded-xl border">
          <div
            className="hidden grid-cols-[11rem_1fr_6rem] items-end gap-4 px-4 pt-3 pb-1 sm:grid"
            aria-hidden
          >
            <span />
            <div className="relative h-4 text-xs text-muted-foreground">
              {AXIS_HOURS.map((hour) => (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {String(hour).padStart(2, '0')}
                </span>
              ))}
            </div>
            <span />
          </div>
          <ul className="divide-y">
            {shifts.map((shift) => (
              <li
                key={shift.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[11rem_1fr_6rem]"
              >
                <div>
                  <p className="font-medium tabular-nums">{formatShift(shift.startHour, shift.endHour)}</p>
                  <p className="text-sm text-muted-foreground">
                    {pluralize(shift.endHour - shift.startHour, 'hour')}
                  </p>
                </div>
                <div className="order-last col-span-2 sm:order-none sm:col-span-1" aria-hidden>
                  <div className="relative h-3 rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 rounded-full bg-primary"
                      style={{
                        left: `${(shift.startHour / 24) * 100}%`,
                        width: `${((shift.endHour - shift.startHour) / 24) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit shift ${formatShift(shift.startHour, shift.endHour)}`}
                    onClick={() => setEditing(shift)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete shift ${formatShift(shift.startHour, shift.endHour)}`}
                    onClick={() => setRemoving(shift)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ShiftDialog
        open={adding}
        onOpenChange={setAdding}
        onSubmit={async (values) => {
          await add.mutateAsync(values)
          toast.success(`Added shift ${formatShift(values.startHour, values.endHour)}`)
          setAdding(false)
        }}
      />
      <ShiftDialog
        key={editing?.id}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        shift={editing ?? undefined}
        onSubmit={async (values) => {
          if (!editing) return
          await update.mutateAsync({ id: editing.id, ...values })
          toast.success('Shift updated')
          setEditing(null)
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={
          removing ? `Delete shift ${formatShift(removing.startHour, removing.endHour)}?` : 'Delete shift?'
        }
        description="Anyone assigned to this shift will be unassigned from it."
        confirmLabel="Delete shift"
        onConfirm={() => {
          if (!removing) return
          remove.mutate(removing.id, {
            onSuccess: () => toast.success('Shift deleted'),
            onError: showError,
          })
        }}
      />
    </div>
  )
}
