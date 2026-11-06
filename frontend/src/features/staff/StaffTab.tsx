import { Pencil, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { showError } from '@/lib/forms'
import { pluralize } from '@/lib/time'
import { useScheduleId } from '@/features/schedules/useScheduleId'
import { useAddStaff, useRemoveStaff, useStaff, useUpdateStaff, type StaffMember } from './api'
import { StaffForm } from './StaffForm'

export function StaffTab() {
  const scheduleId = useScheduleId()
  const { data: staff, isPending, isError, refetch } = useStaff(scheduleId)
  const add = useAddStaff(scheduleId)
  const update = useUpdateStaff(scheduleId)
  const remove = useRemoveStaff(scheduleId)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [removing, setRemoving] = useState<StaffMember | null>(null)

  const capacity = staff?.reduce((sum, member) => sum + member.maxWeeklyHours, 0) ?? 0

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-3">
          <div>
            <h2 className="font-medium">Add a team member</h2>
            <p className="text-sm text-muted-foreground">
              The maximum is the most hours they can work in a week. Press Enter to add and keep going.
            </p>
          </div>
          <StaffForm
            idPrefix="add-staff"
            layout="inline"
            submitLabel="Add"
            onSubmit={(values) => add.mutateAsync(values)}
          />
        </CardContent>
      </Card>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load the team</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isPending && <Skeleton className="h-40 w-full rounded-xl" aria-label="Loading team" />}

      {staff && staff.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
          <Users className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">No one on the team yet</p>
          <p className="text-sm text-muted-foreground">Add your first team member above.</p>
        </div>
      )}

      {staff && staff.length > 0 && (
        <section aria-labelledby="team-heading" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="team-heading" className="font-medium">
              Team
            </h2>
            <p className="text-sm text-muted-foreground">
              {pluralize(staff.length, 'person', 'people')} · {capacity} hours/week available in total
            </p>
          </div>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Max hours / week</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{member.maxWeeklyHours}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${member.name}`}
                          onClick={() => setEditing(member)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => setRemoving(member)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit {editing.name}</DialogTitle>
                <DialogDescription>Changes apply to this schedule only.</DialogDescription>
              </DialogHeader>
              <StaffForm
                idPrefix="edit-staff"
                layout="stacked"
                submitLabel="Save"
                defaultValues={{ name: editing.name, maxWeeklyHours: editing.maxWeeklyHours }}
                onCancel={() => setEditing(null)}
                onSubmit={async (values) => {
                  await update.mutateAsync({ id: editing.id, ...values })
                  toast.success(`Saved ${values.name}`)
                  setEditing(null)
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? 'this person'}?`}
        description="They will be taken off this schedule, including any shifts they were assigned to."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removing) return
          remove.mutate(removing.id, {
            onSuccess: () => toast.success(`Removed ${removing.name}`),
            onError: showError,
          })
        }}
      />
    </div>
  )
}
