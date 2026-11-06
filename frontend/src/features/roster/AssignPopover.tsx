import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Shift } from '@/features/shifts/api'
import type { StaffMember } from '@/features/staff/api'
import { dayName } from '@/lib/days'
import { formatShift } from '@/lib/time'
import { cn } from '@/lib/utils'
import { isSaving, type Assignment } from './api'
import { overlapOf } from './problems'

/** With a short team the list is quicker to scan than to search. */
const FILTER_FROM = 9

interface AssignPopoverProps {
  day: number
  shift: Shift
  shifts: Shift[]
  staff: StaffMember[]
  assignments: Assignment[]
  hours: Map<number, number>
  onAdd: (person: StaffMember) => void
  onRemove: (assignment: Assignment) => void
  onDone: () => void
}

/** The team as a checklist for one day and shift: tick to assign, untick to remove. Hours show the result of the tick. */
export function AssignPopover({
  day,
  shift,
  shifts,
  staff,
  assignments,
  hours,
  onAdd,
  onRemove,
  onDone,
}: AssignPopoverProps) {
  const [filter, setFilter] = useState('')
  const length = shift.endHour - shift.startHour
  const people = [...staff]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((person) => person.name.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <div className="grid gap-3">
      <h4 className="font-medium">
        {dayName(day)} {formatShift(shift.startHour, shift.endHour)}
      </h4>

      {staff.length >= FILTER_FROM && (
        <Input
          type="search"
          aria-label="Find a person"
          placeholder="Find a person"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      )}

      <ul className="grid gap-0.5" aria-label="Team">
        {people.map((person) => {
          const current = assignments.find(
            (a) => a.day === day && a.shiftId === shift.id && a.staffId === person.id,
          )
          const worked = hours.get(person.id) ?? 0
          const conflict = current ? undefined : overlapOf(shift, day, person.id, assignments, shifts)
          const total = current ? worked : worked + length
          const over = total - person.maxWeeklyHours
          const disabled = conflict !== undefined || (current !== undefined && isSaving(current))

          return (
            <li key={person.id}>
              <label
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                  disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={current !== undefined}
                  disabled={disabled}
                  onChange={() => (current ? onRemove(current) : onAdd(person))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{person.name}</span>
                  {conflict && (
                    <span className="block text-xs text-muted-foreground">
                      Already on {formatShift(conflict.startHour, conflict.endHour)} this day
                    </span>
                  )}
                </span>
                {!conflict && (
                  <span
                    className={cn(
                      'text-xs tabular-nums text-muted-foreground',
                      over > 0 && 'font-medium text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {total} / {person.maxWeeklyHours} h{over > 0 && ` · +${over} h over`}
                  </span>
                )}
              </label>
            </li>
          )
        })}
        {people.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">Nobody matches.</li>}
      </ul>

      <Button size="sm" onClick={onDone} className="justify-self-end">
        Done
      </Button>
    </div>
  )
}
