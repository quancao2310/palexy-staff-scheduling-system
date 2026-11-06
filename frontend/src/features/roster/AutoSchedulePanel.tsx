import { CircleAlert, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { pluralize } from '@/lib/time'
import type { AutoScheduleResult, RosterWarning, WarningType } from './api'

const GROUPS: { type: WarningType; title: string; hint: string }[] = [
  {
    type: 'UNCOVERED_HOUR',
    title: 'Hours no shift covers',
    hint: 'Only a new shift can fix these.',
  },
  {
    type: 'UNDERSTAFFED',
    title: 'Understaffed hours',
    hint: 'Fewer people than the demand calls for (one per 16 transactions).',
  },
  {
    type: 'UNDER_UTILISED',
    title: 'Under-used staff',
    hint: 'Far fewer hours than the team average.',
  },
]

const SHOWN_PER_GROUP = 8

/** What the last auto-schedule run did: the totals, each person's load, and everything that needs attention. */
export function AutoSchedulePanel({ result }: { result: AutoScheduleResult }) {
  const { stats, warnings } = result
  const byType = (type: WarningType): RosterWarning[] => warnings.filter((w) => w.type === type)
  const nobodyScheduled = result.assignments.length === 0
  const hoursLeftWhileShort = stats.shortfallStaffHours > 0 && stats.staff.some((p) => p.hours < p.maxHours)

  return (
    <section aria-label="Auto-schedule result" className="grid gap-4 rounded-xl border p-4">
      <div>
        <h3 className="font-medium">{nobodyScheduled ? 'Nobody could be scheduled' : 'Draft ready'}</h3>
        <p className="text-sm text-muted-foreground">
          {nobodyScheduled
            ? 'No one has enough weekly hours for even the shortest shift. See below.'
            : warnings.length === 0
              ? 'Every hour is covered. Review it below and adjust as needed.'
              : `${pluralize(warnings.length, 'thing')} to look at. Review the roster below and adjust as needed.`}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Short by" value={`${stats.shortfallStaffHours} staff-hours`} />
        <Stat label="Transactions beyond capacity" value={String(stats.unmetTransactions)} />
        <Stat label="Unused capacity" value={`${stats.idleStaffHours} staff-hours`} />
      </dl>

      {hoursLeftWhileShort && (
        <p className="text-sm text-muted-foreground">
          Some people still have hours left while other hours are short. Shifts are fixed blocks, so another person on a
          long shift would sit idle for most of it. A shorter shift over the busy hours (add one on the Shifts tab) lets
          the scheduler cover them.
        </p>
      )}

      <div className="grid gap-2">
        <h4 className="text-sm font-medium">Hours per person</h4>
        <ul className="grid gap-2 sm:grid-cols-2">
          {stats.staff.map((person) => (
            <li key={person.staffId} className="grid gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <span>{person.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {person.hours} / {person.maxHours} h
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${person.name} hours`}
                aria-valuemin={0}
                aria-valuemax={person.maxHours}
                aria-valuenow={person.hours}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, person.utilisation * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {GROUPS.map(({ type, title, hint }) => {
        const items = byType(type)
        if (items.length === 0) return null
        const Icon = type === 'UNCOVERED_HOUR' ? CircleAlert : TriangleAlert
        return (
          <Alert key={type} variant={type === 'UNDER_UTILISED' ? 'default' : 'destructive'}>
            <Icon aria-hidden />
            <AlertTitle>
              {title} ({items.length})
            </AlertTitle>
            <AlertDescription>
              <p>{hint}</p>
              <ul className="mt-1 list-disc pl-4">
                {items.slice(0, SHOWN_PER_GROUP).map((w) => (
                  <li key={`${w.type}-${w.day}-${w.hour}-${w.staffId}`}>{w.message}</li>
                ))}
              </ul>
              {items.length > SHOWN_PER_GROUP && (
                <p className="mt-1">and {items.length - SHOWN_PER_GROUP} more</p>
              )}
            </AlertDescription>
          </Alert>
        )
      })}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
