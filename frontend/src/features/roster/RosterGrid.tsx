import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Shift } from '@/features/shifts/api'
import type { StaffMember } from '@/features/staff/api'
import { DAYS } from '@/lib/days'
import { formatShift } from '@/lib/time'
import type { Assignment } from './api'

interface RosterGridProps {
  shifts: Shift[]
  staff: StaffMember[]
  assignments: Assignment[]
}

/** Read-only week view: a row per shift, a column per day, the people on that shift in each cell. */
export function RosterGrid({ shifts, staff, assignments }: RosterGridProps) {
  const nameOf = new Map(staff.map((person) => [person.id, person.name]))

  function peopleOn(day: number, shiftId: number) {
    return assignments
      .filter((a) => a.day === day && a.shiftId === shiftId)
      .map((a) => nameOf.get(a.staffId) ?? 'Unknown')
      .sort((a, b) => a.localeCompare(b))
  }

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
              {DAYS.map((day) => {
                const people = peopleOn(day.value, shift.id)
                return (
                  <TableCell key={day.value} className="align-top">
                    {people.length === 0 ? (
                      <span className="text-muted-foreground" aria-label="Nobody">
                        –
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {people.map((name) => (
                          <li key={name}>
                            <Badge variant="secondary">{name}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
