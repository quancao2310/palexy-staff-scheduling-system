import { CalendarX2, FileSpreadsheet } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions, type TransactionCell } from '@/features/demand/api'
import { useAssignments, type Assignment } from '@/features/roster/api'
import { useScheduleId } from '@/features/schedules/useScheduleId'
import { useShifts, type Shift } from '@/features/shifts/api'
import { useStaff } from '@/features/staff/api'
import { cn } from '@/lib/utils'
import { buildSummary, type Status } from './compute'
import { formatRatio, METRICS, type Metric } from './metrics'
import { SummaryGrid } from './SummaryGrid'

export function SummaryTab() {
  const scheduleId = useScheduleId()
  const transactions = useTransactions(scheduleId)
  const shifts = useShifts(scheduleId)
  const staff = useStaff(scheduleId)
  const assignments = useAssignments(scheduleId)
  const queries = [transactions, shifts, staff, assignments]

  if (queries.some((q) => q.isError)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load the summary</AlertTitle>
        <AlertDescription>
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => queries.forEach((q) => q.isError && q.refetch())}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!transactions.data || !shifts.data || !staff.data || !assignments.data) {
    return <Skeleton className="h-96 w-full rounded-xl" aria-label="Loading summary" />
  }

  if (!transactions.data.hasData) {
    return (
      <EmptyState
        icon={<FileSpreadsheet className="size-6" aria-hidden />}
        title="Add demand data first"
        text="The summary compares how busy the store is with how many people are scheduled, so it needs a transaction report."
        action={
          <Button variant="outline" asChild>
            <Link to="../demand">Go to demand data</Link>
          </Button>
        }
      />
    )
  }

  if (assignments.data.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX2 className="size-6" aria-hidden />}
        title="Nobody is scheduled yet"
        text="Once there is a roster, this page shows how well staffing matches demand for every hour of the week. Auto-schedule on the Roster tab drafts one from your demand data."
        action={
          <Button asChild>
            <Link to="../roster">Go to the roster</Link>
          </Button>
        }
      />
    )
  }

  return (
    <SummaryView
      cells={transactions.data.cells}
      shifts={shifts.data}
      assignments={assignments.data}
      availableHours={staff.data.reduce((sum, member) => sum + member.maxWeeklyHours, 0)}
    />
  )
}

const CHIPS: {
  status: Extract<Status, 'understaffed' | 'quiet' | 'uncovered'>
  label: (n: number) => string
  swatch: string
}[] = [
  {
    status: 'understaffed',
    label: (n) => `${n} understaffed ${n === 1 ? 'hour' : 'hours'}`,
    swatch: 'bg-amber-500/40',
  },
  { status: 'quiet', label: (n) => `${n} quiet ${n === 1 ? 'hour' : 'hours'}`, swatch: 'bg-sky-600/20' },
  { status: 'uncovered', label: (n) => `${n} uncovered`, swatch: 'bg-destructive/25' },
]

function SummaryView({
  cells,
  shifts,
  assignments,
  availableHours,
}: {
  cells: TransactionCell[]
  shifts: Shift[]
  assignments: Assignment[]
  availableHours: number
}) {
  const summary = useMemo(() => buildSummary(cells, shifts, assignments), [cells, shifts, assignments])
  const [metric, setMetric] = useState<Metric>('perStaffHour')
  const [highlight, setHighlight] = useState<Status | null>(null)
  const { week } = summary

  return (
    <div className="grid gap-4">
      <dl className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total staff hours"
          value={String(week.staffHours)}
          detail={`of ${availableHours} available`}
        />
        <Stat
          label="Total transactions"
          value={week.transactions.toLocaleString()}
          detail="from the uploaded report"
        />
        <Stat
          label="Per staff-hour, overall"
          value={formatRatio(week.perStaffHour)}
          detail={`${week.transactions.toLocaleString()} ÷ ${week.staffHours}`}
        />
        <Stat
          label="Per staff-hour, average"
          value={formatRatio(summary.averagePerStaffHour)}
          detail="mean of the hourly figures"
        />
      </dl>
      <p className="text-sm text-muted-foreground">
        Overall divides the week's totals. The average treats every hour equally, so a quiet hour counts as
        much as a rush. They drift apart when busy and quiet hours are staffed differently.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Highlight hours by status">
          {CHIPS.map(({ status, label, swatch }) => {
            const count = summary.counts[status]
            const active = highlight === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                disabled={count === 0}
                onClick={() => setHighlight(active ? null : status)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
                  active ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className={cn('size-2.5 rounded-[3px] border', swatch)} aria-hidden />
                {label(count)}
              </button>
            )
          })}
        </div>

        <ToggleGroup.Root
          type="single"
          value={metric}
          onValueChange={(value) => value && setMetric(value as Metric)}
          aria-label="Number to show in each cell"
          className="inline-flex overflow-hidden rounded-lg border"
        >
          {METRICS.map(({ value, label }) => (
            <ToggleGroup.Item
              key={value}
              value={value}
              className="px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>

      <SummaryGrid summary={summary} metric={metric} highlight={highlight} />

      <p className="text-sm text-muted-foreground">
        Each cell shows the number you picked, with the other two underneath (for "Per staff-hour":
        transactions ÷ staff). Shading: amber means fewer people than the scheduler asks for (one per 16
        transactions, hover a cell to see the numbers), blue is under 8 transactions per staff-hour, hatched
        means nobody is scheduled.
      </p>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-sm text-muted-foreground">{detail}</dd>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode
  title: string
  text: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
      <div className="max-w-lg">
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="mt-1 text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  )
}
