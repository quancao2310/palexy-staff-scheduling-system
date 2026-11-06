import { CalendarRange, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSchedule } from '@/features/schedules/api'
import { useScheduleId } from '@/features/schedules/useScheduleId'
import { useShifts } from '@/features/shifts/api'
import { useStaff } from '@/features/staff/api'
import { showError } from '@/lib/forms'
import { useAssignments, useAutoSchedule, type AutoScheduleResult } from './api'
import { AutoSchedulePanel } from './AutoSchedulePanel'
import { RosterGrid } from './RosterGrid'

export function RosterTab() {
  const scheduleId = useScheduleId()
  const { data: schedule } = useSchedule(scheduleId)
  const staff = useStaff(scheduleId)
  const shifts = useShifts(scheduleId)
  const assignments = useAssignments(scheduleId)
  const autoSchedule = useAutoSchedule(scheduleId)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<AutoScheduleResult | null>(null)

  const missing = schedule
    ? [
        schedule.staffCount === 0 && 'staff',
        schedule.shiftCount === 0 && 'shifts',
        !schedule.hasTransactions && 'demand data',
      ].filter((item): item is string => item !== false)
    : []
  const hasRoster = (assignments.data?.length ?? 0) > 0

  function run() {
    if (autoSchedule.isPending) return
    autoSchedule.mutate(undefined, { onSuccess: setResult, onError: showError })
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-medium">Roster</h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {missing.length > 0
              ? `Add ${missing.join(', ')} first, then the roster can be drafted.`
              : 'Draft a week from the demand data, then review it. Hours with more transactions get more people.'}
          </p>
        </div>
        <Button
          disabled={!schedule || assignments.data === undefined || missing.length > 0 || autoSchedule.isPending}
          onClick={() => (hasRoster ? setConfirming(true) : run())}
        >
          <Sparkles /> {autoSchedule.isPending ? 'Scheduling…' : 'Auto-schedule'}
        </Button>
      </div>

      {result && <AutoSchedulePanel result={result} />}

      {(staff.isError || shifts.isError || assignments.isError) && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load the roster</AlertTitle>
          <AlertDescription>Check your connection and reload the page.</AlertDescription>
        </Alert>
      )}

      {(staff.isPending || shifts.isPending || assignments.isPending) && (
        <Skeleton className="h-40 w-full rounded-xl" aria-label="Loading roster" />
      )}

      {staff.data && shifts.data && assignments.data && !hasRoster && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
          <CalendarRange className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">No roster yet</p>
          <p className="text-sm text-muted-foreground">Click Auto-schedule to draft the week.</p>
        </div>
      )}

      {staff.data && shifts.data && assignments.data && hasRoster && (
        <RosterGrid shifts={shifts.data} staff={staff.data} assignments={assignments.data} />
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Replace the current roster?"
        description="Auto-schedule drafts a new week and overwrites the roster you have now, including any changes you made by hand."
        confirmLabel="Replace roster"
        onConfirm={run}
      />
    </div>
  )
}
