import { CalendarPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSchedules } from './api'
import { ScheduleCard } from './ScheduleCard'
import { ScheduleFormDialog } from './ScheduleFormDialog'

export function SchedulesPage() {
  const { data: schedules, isPending, isError, refetch } = useSchedules()
  const [creating, setCreating] = useState(false)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedules</h1>
          <p className="mt-1 text-muted-foreground">
            Each schedule plans one typical week: its team, shifts and expected demand.
          </p>
        </div>
        {schedules && schedules.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> New schedule
          </Button>
        )}
      </div>

      {isPending && (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading schedules"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load your schedules</AlertTitle>
          <AlertDescription>
            Check your connection and try again.{' '}
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {schedules && schedules.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <CalendarPlus className="size-6" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-medium">Plan your first week</h2>
            <p className="mx-auto mt-1 max-w-md text-muted-foreground">
              Create a schedule, add your team and shifts, then upload last week's transactions to see how
              busy each hour is.
            </p>
          </div>
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus /> New schedule
          </Button>
        </div>
      )}

      {schedules && schedules.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <ScheduleCard schedule={schedule} />
            </li>
          ))}
        </ul>
      )}

      <ScheduleFormDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
