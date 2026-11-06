import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { dayName } from '@/lib/days'
import { formatClock, pluralize } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { HourGap, Problems } from './problems'

type Section = 'understaffed' | 'nobody' | 'overMax'

interface RosterStatusProps {
  problems: Problems
  staffHours: number
}

const SHOWN = 24

const when =(gap: HourGap) => `${dayName(gap.day, 'short')} ${formatClock(gap.hour)}`

/** One line under the grid that says what is wrong with the roster right now; each problem opens its details. */
export function RosterStatus({ problems, staffHours }: RosterStatusProps) {
  const [open, setOpen] = useState<Section | null>(null)
  const { understaffed, nobody, overMax } = problems

  const segments: { id: Section; label: string; items: string[] }[] = [
    {
      id: 'understaffed',
      label: pluralize(understaffed.length, 'understaffed hour'),
      items: understaffed.map((g) => `${when(g)} needs ${g.needed}, has ${g.scheduled}`),
    },
    {
      id: 'nobody',
      label: `${pluralize(nobody.length, 'hour')} with nobody scheduled`,
      items: nobody.map((g) =>
        g.needed === 0
          ? `${when(g)}: no shift covers this hour, add a shift`
          : `${when(g)} needs ${g.needed}, nobody scheduled`,
      ),
    },
    {
      id: 'overMax',
      label: overMax.length === 1 ? `${overMax[0].name} is over their maximum` : `${overMax.length} people over their maximum`,
      items: overMax.map((p) => `${p.name} works ${p.hours} of ${p.maxHours} h (${p.hours - p.maxHours} h over)`),
    },
  ]
  const shown = segments.filter((s) => s.items.length > 0)
  const expanded = shown.find((s) => s.id === open)

  return (
    <section aria-label="Roster check" className="grid gap-2 rounded-xl border px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-live="polite">
          {shown.length === 0 ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CircleCheck className="size-4 text-emerald-600" aria-hidden />
              No problems: every hour has enough people and nobody is over their maximum.
            </p>
          ) : (
            shown.map((segment) => (
              <button
                key={segment.id}
                type="button"
                aria-expanded={open === segment.id}
                onClick={() => setOpen(open === segment.id ? null : segment.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  segment.id === 'overMax'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300',
                  open === segment.id && 'ring-2 ring-ring/40',
                )}
              >
                <TriangleAlert className="size-3.5" aria-hidden />
                {segment.label}
              </button>
            ))
          )}
          <span className="text-muted-foreground tabular-nums">{staffHours} staff-hours scheduled</span>
        </div>
        <Link to="../summary" className="text-primary underline-offset-4 hover:underline">
          View summary →
        </Link>
      </div>

      {expanded && (
        <ul className="grid gap-0.5 border-t pt-2 text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          {expanded.items.slice(0, SHOWN).map((item) => (
            <li key={item}>{item}</li>
          ))}
          {expanded.items.length > SHOWN && <li>…and {expanded.items.length - SHOWN} more</li>}
        </ul>
      )}
    </section>
  )
}
