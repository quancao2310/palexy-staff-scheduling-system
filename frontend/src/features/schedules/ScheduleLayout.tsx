import { ArrowLeft, CircleCheck, CircleDashed, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { showError } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useDeleteSchedule, useSchedule, type Schedule } from './api'
import { ScheduleFormDialog } from './ScheduleFormDialog'
import { useScheduleId } from './useScheduleId'

interface Step {
  to: string
  label: string
  count?: number
  /** Setup steps show a done / not-done icon; views like the summary have none. */
  done?: boolean
}

function stepsOf(schedule: Schedule): Step[] {
  return [
    { to: 'staff', label: 'Staff', count: schedule.staffCount, done: schedule.staffCount > 0 },
    { to: 'shifts', label: 'Shifts', count: schedule.shiftCount, done: schedule.shiftCount > 0 },
    { to: 'demand', label: 'Demand data', done: schedule.hasTransactions },
    { to: 'roster', label: 'Roster' },
  ]
}

export function ScheduleLayout() {
  const id = useScheduleId()
  const { data: schedule, isPending, error, refetch } = useSchedule(id)

  if (!Number.isInteger(id) || (error instanceof ApiError && error.status === 404)) {
    return <NotFoundPage what="schedule" />
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load this schedule</AlertTitle>
        <AlertDescription>
          Check your connection and try again.{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (isPending) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Loading schedule">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const steps = stepsOf(schedule)
  const missing = steps.filter((step) => step.done === false).map((step) => step.label.toLowerCase())

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> All schedules
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{schedule.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {missing.length === 0
                ? 'Setup complete. Ready for auto-scheduling.'
                : `Still needed before auto-scheduling: ${missing.join(', ')}.`}
            </p>
          </div>
          <ScheduleMenu schedule={schedule} />
        </div>
      </div>

      <nav aria-label="Schedule setup" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 border-b">
          {steps.map((step) => (
            <li key={step.to}>
              <NavLink
                to={step.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 rounded-t-md px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                    isActive
                      ? 'text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {step.done === true && <CircleCheck className="size-4 text-primary" aria-label="Done" />}
                {step.done === false && <CircleDashed className="size-4" aria-label="Not done yet" />}
                {step.label}
                {step.count !== undefined && (
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{step.count}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  )
}

function ScheduleMenu({ schedule }: { schedule: Schedule }) {
  const navigate = useNavigate()
  const remove = useDeleteSchedule()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Schedule actions">
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
            onSuccess: () => {
              toast.success('Schedule deleted')
              navigate('/')
            },
            onError: showError,
          })
        }
      />
    </>
  )
}
