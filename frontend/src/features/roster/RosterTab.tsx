import { CalendarRange, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/features/demand/api'
import { useSchedule } from '@/features/schedules/api'
import { useScheduleId } from '@/features/schedules/useScheduleId'
import { useShifts } from '@/features/shifts/api'
import { useStaff } from '@/features/staff/api'
import { buildSummary } from '@/features/summary/compute'
import { dayName } from '@/lib/days'
import { showError } from '@/lib/forms'
import { formatShift } from '@/lib/time'
import {
  useAddAssignment,
  useAssignments,
  useAutoSchedule,
  useRemoveAssignment,
  type Assignment,
  type AssignmentSlot,
  type AutoScheduleResult,
} from './api'
import { AutoSchedulePanel } from './AutoSchedulePanel'
import { hoursByStaff, listProblems } from './problems'
import { RosterGrid } from './RosterGrid'
import { RosterStatus } from './RosterStatus'

export function RosterTab() {
  const scheduleId = useScheduleId()
  const { data: schedule } = useSchedule(scheduleId)
  const staff = useStaff(scheduleId)
  const shifts = useShifts(scheduleId)
  const assignments = useAssignments(scheduleId)
  const transactions = useTransactions(scheduleId)
  const autoSchedule = useAutoSchedule(scheduleId)
  const addAssignment = useAddAssignment(scheduleId)
  const removeAssignment = useRemoveAssignment(scheduleId)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<AutoScheduleResult | null>(null)

  const loaded = useMemo(
    () =>
      staff.data && shifts.data && assignments.data && transactions.data
        ? { staff: staff.data, shifts: shifts.data, assignments: assignments.data, cells: transactions.data.cells }
        : null,
    [staff.data, shifts.data, assignments.data, transactions.data],
  )
  const view = useMemo(() => {
    if (!loaded) return null
    const summary = buildSummary(loaded.cells, loaded.shifts, loaded.assignments)
    const hours = hoursByStaff(loaded.assignments, loaded.shifts)
    return { summary, hours, problems: listProblems(summary, loaded.staff, hours) }
  }, [loaded])

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

  // The drafted result's warnings describe the draft, not the roster once it is edited by hand.
  function add(slot: AssignmentSlot) {
    setResult(null)
    addAssignment.mutate(slot, { onError: showError })
  }

  function remove(assignment: Assignment) {
    setResult(null)
    removeAssignment.mutate(assignment, { onError: showError })
    const person = staff.data?.find((p) => p.id === assignment.staffId)
    const shift = shifts.data?.find((s) => s.id === assignment.shiftId)
    if (!person || !shift) return
    const { day, shiftId, staffId } = assignment
    toast(`Removed ${person.name} from ${dayName(day, 'short')} ${formatShift(shift.startHour, shift.endHour)}`, {
      action: { label: 'Undo', onClick: () => addAssignment.mutate({ day, shiftId, staffId }, { onError: showError }) },
    })
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-medium">Roster</h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {missing.length > 0
              ? `Add ${missing.join(', ')} first, then the roster can be drafted.`
              : 'Draft a week from the demand data, then adjust it: click a cell to add or remove people.'}
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

      {(staff.isError || shifts.isError || assignments.isError || transactions.isError) && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load the roster</AlertTitle>
          <AlertDescription>Check your connection and reload the page.</AlertDescription>
        </Alert>
      )}

      {!loaded && !(staff.isError || shifts.isError || assignments.isError || transactions.isError) && (
        <Skeleton className="h-40 w-full rounded-xl" aria-label="Loading roster" />
      )}

      {loaded && view && (
        <>
          {!hasRoster && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="size-4" aria-hidden />
              No roster yet. Click Auto-schedule to draft the week, or fill the cells yourself.
            </p>
          )}
          {loaded.shifts.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              Add a shift first: the roster has a row for each shift.
            </div>
          ) : (
            <RosterGrid
              shifts={loaded.shifts}
              staff={loaded.staff}
              assignments={loaded.assignments}
              summary={view.summary}
              hours={view.hours}
              onAdd={add}
              onRemove={remove}
            />
          )}
          {loaded.shifts.length > 0 && (
            <RosterStatus problems={view.problems} staffHours={view.summary.week.staffHours} />
          )}
        </>
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
