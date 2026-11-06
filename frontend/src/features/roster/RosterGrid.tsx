import { Plus, TriangleAlert, X } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Shift } from '@/features/shifts/api'
import type { StaffMember } from '@/features/staff/api'
import type { Summary } from '@/features/summary/compute'
import { DAYS, dayName } from '@/lib/days'
import { formatClock, formatShift, pluralize } from '@/lib/time'
import { cn } from '@/lib/utils'
import { isSaving, type Assignment, type AssignmentSlot } from './api'
import { AssignPopover } from './AssignPopover'
import { shortHours } from './problems'

interface RosterGridProps {
  shifts: Shift[]
  staff: StaffMember[]
  assignments: Assignment[]
  summary: Summary
  /** Weekly hours per person (see `hoursByStaff`). */
  hours: Map<number, number>
  onAdd: (slot: AssignmentSlot) => void
  onRemove: (assignment: Assignment) => void
}

/** The week: a row per shift, a column per day. Each cell lists who works it and opens a checklist to change that. */
export function RosterGrid({ shifts, staff, assignments, summary, hours, onAdd, onRemove }: RosterGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table aria-label="Weekly roster">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">Shift</TableHead>
            {DAYS.map((day) => (
              <TableHead key={day.value}>{day.short}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => (
            <TableRow key={shift.id}>
              <TableHead scope="row" className="font-medium whitespace-nowrap">
                {formatShift(shift.startHour, shift.endHour)}
              </TableHead>
              {DAYS.map((day) => (
                <TableCell key={day.value} className="min-w-36 align-top whitespace-normal">
                  <RosterCell
                    day={day.value}
                    shift={shift}
                    shifts={shifts}
                    staff={staff}
                    assignments={assignments}
                    summary={summary}
                    hours={hours}
                    onAdd={onAdd}
                    onRemove={onRemove}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

interface RosterCellProps extends Omit<RosterGridProps, 'shifts'> {
  day: number
  shift: Shift
  shifts: Shift[]
}

function RosterCell({ day, shift, shifts, staff, assignments, summary, hours, onAdd, onRemove }: RosterCellProps) {
  const [open, setOpen] = useState(false)
  const label = `${dayName(day)} ${formatShift(shift.startHour, shift.endHour)}`
  const nameOf = new Map(staff.map((person) => [person.id, person]))

  const here = assignments
    .filter((a) => a.day === day && a.shiftId === shift.id)
    .map((a) => ({ assignment: a, person: nameOf.get(a.staffId) }))
    .sort((a, b) => (a.person?.name ?? '').localeCompare(b.person?.name ?? ''))
  const gaps = shortHours(summary, day, shift)

  // Clicking empty space in the cell opens it too. Clicks inside the popover bubble through React's tree
  // but are not inside this element in the DOM, and buttons handle themselves.
  function openFromCell(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (!event.currentTarget.contains(target) || target.closest('button')) return
    setOpen(true)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          onClick={openFromCell}
          className={cn(
            'flex min-h-20 cursor-pointer flex-col gap-1.5 rounded-lg border p-1.5 transition-colors hover:bg-muted/50',
            gaps.length > 0 && 'border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/15',
          )}
        >
          {here.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label={`People on ${label}`}>
              {here.map(({ assignment, person }) => {
                const name = person?.name ?? 'Unknown'
                const worked = hours.get(assignment.staffId) ?? 0
                const over = person !== undefined && worked > person.maxWeeklyHours
                return (
                  <li
                    key={assignment.id}
                    title={over ? `${name} works ${worked} of ${person.maxWeeklyHours} h this week` : undefined}
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full py-0.5 pr-0.5 pl-2.5 text-xs font-medium',
                      over
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-secondary text-secondary-foreground',
                      isSaving(assignment) && 'opacity-60',
                    )}
                  >
                    {over && <TriangleAlert className="mr-1 size-3" aria-hidden />}
                    <span>
                      {name}
                      {over && <span className="sr-only"> (over their maximum hours)</span>}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${name} from ${label}`}
                      disabled={isSaving(assignment)}
                      onClick={() => onRemove(assignment)}
                      className="rounded-full p-1 outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Add people to ${label}`}
              className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden /> Add
            </button>
          </PopoverTrigger>

          {gaps.length > 0 && (
            <p
              className="mt-auto flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300"
              title={gaps
                .map((g) =>
                  g.scheduled === 0
                    ? `${formatClock(g.hour)} needs ${g.needed}, nobody scheduled`
                    : `${formatClock(g.hour)} needs ${g.needed}, has ${g.scheduled}`,
                )
                .join('\n')}
            >
              <TriangleAlert className="size-3 shrink-0" aria-hidden />
              {pluralize(gaps.length, 'hour')} short
            </p>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent>
        <AssignPopover
          day={day}
          shift={shift}
          shifts={shifts}
          staff={staff}
          assignments={assignments}
          hours={hours}
          onAdd={(person) => onAdd({ day, shiftId: shift.id, staffId: person.id })}
          onRemove={onRemove}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
