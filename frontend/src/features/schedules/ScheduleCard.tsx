import { CalendarDays, CircleCheck, CircleDashed, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { showError } from '@/lib/forms'
import { pluralize } from '@/lib/time'
import { useDeleteSchedule, type Schedule } from './api'
import { ScheduleFormDialog } from './ScheduleFormDialog'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const remove = useDeleteSchedule()

  return (
    <Card className="relative transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pr-10 text-base">
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <Link
            to={`/schedules/${schedule.id}`}
            className="truncate rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {schedule.name}
          </Link>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Created {dateFormat.format(new Date(schedule.createdAt))}
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge variant="secondary">{pluralize(schedule.staffCount, 'staff member')}</Badge>
        <Badge variant="secondary">{pluralize(schedule.shiftCount, 'shift')}</Badge>
        <Badge variant={schedule.hasTransactions ? 'secondary' : 'outline'} className="gap-1">
          {schedule.hasTransactions ? (
            <CircleCheck className="size-3 text-primary" aria-hidden />
          ) : (
            <CircleDashed className="size-3" aria-hidden />
          )}
          {schedule.hasTransactions ? 'Demand data uploaded' : 'No demand data'}
        </Badge>
      </CardContent>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-10"
            aria-label={`Actions for ${schedule.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ScheduleFormDialog open={renaming} onOpenChange={setRenaming} schedule={schedule} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete "${schedule.name}"?`}
        description="This permanently deletes the schedule with its staff, shifts and demand data. This can't be undone."
        confirmLabel="Delete schedule"
        onConfirm={() =>
          remove.mutate(schedule.id, {
            onSuccess: () => toast.success('Schedule deleted'),
            onError: showError,
          })
        }
      />
    </Card>
  )
}
