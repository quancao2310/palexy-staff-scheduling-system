import { DAYS } from '@/lib/days'
import { formatHour12 } from '@/lib/time'
import { cn } from '@/lib/utils'
import { totalStatus, type Figures, type Status, type Summary } from './compute'
import { formatRatio, STATUS_LABEL, type Metric } from './metrics'

/** Shading is always about staffing pressure, whichever metric is shown as the big number. */
const STATUS_CELL: Record<Status, string> = {
  understaffed: 'bg-[color-mix(in_oklab,oklch(0.77_0.19_70)_25%,var(--background))]',
  balanced: '',
  quiet: 'bg-[color-mix(in_oklab,oklch(0.59_0.16_242)_12%,var(--background))]',
  uncovered: '',
  empty: '',
}
const HATCH =
  'repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in oklch, var(--destructive) 18%, transparent) 4px 8px)'

function hero(metric: Metric, f: Figures): { big: string; small: string } {
  switch (metric) {
    case 'perStaffHour':
      return { big: formatRatio(f.perStaffHour), small: `${f.transactions} ÷ ${f.staffHours}` }
    case 'transactions':
      return { big: String(f.transactions), small: `${f.staffHours} staff · ${formatRatio(f.perStaffHour)}` }
    case 'staffHours':
      return { big: String(f.staffHours), small: `${f.transactions} txns · ${formatRatio(f.perStaffHour)}` }
  }
}

function Figure({
  figures,
  metric,
  status,
  label,
  needed,
  dimmed = false,
  className,
}: {
  figures: Figures
  metric: Metric
  status: Status
  label: string
  /** Staff the scheduler asks for; only known for single hours, not totals. */
  needed?: number
  dimmed?: boolean
  className?: string
}) {
  const { big, small } = hero(metric, figures)
  const description = `${label}: ${formatRatio(figures.perStaffHour)} transactions per staff-hour (${figures.transactions} transactions, ${figures.staffHours} staff-hours), ${STATUS_LABEL[status]}${needed ? `, needs ${needed}, has ${figures.staffHours}` : ''}`
  return (
    <td
      aria-label={description}
      title={needed ? `Needs ${needed}, has ${figures.staffHours}` : undefined}
      className={cn(
        'border-b border-l bg-background px-2 py-1 text-right leading-tight transition-opacity',
        STATUS_CELL[status],
        dimmed && 'opacity-30',
        className,
      )}
      style={status === 'uncovered' ? { backgroundImage: HATCH } : undefined}
    >
      <div
        className={cn(
          'text-sm font-semibold',
          status === 'understaffed' && 'text-amber-900 dark:text-amber-200',
          (status === 'empty' || figures.perStaffHour === null) &&
            metric === 'perStaffHour' &&
            'text-muted-foreground',
        )}
      >
        {big}
      </div>
      <div className="text-[0.65rem] text-muted-foreground">{small}</div>
    </td>
  )
}

export function SummaryGrid({
  summary,
  metric,
  highlight,
}: {
  summary: Summary
  metric: Metric
  highlight: Status | null
}) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm tabular-nums">
        <caption className="sr-only">
          Transactions, staff hours and transactions per staff-hour for every hour of the week
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-30 border-b bg-muted px-3 py-2 text-left font-medium text-muted-foreground"
            >
              Hour
            </th>
            {DAYS.map((day) => (
              <th
                key={day.value}
                scope="col"
                className="sticky top-0 z-20 border-b bg-muted px-2 py-2 text-right font-medium"
              >
                <abbr title={day.long} className="no-underline">
                  {day.short}
                </abbr>
              </th>
            ))}
            <th
              scope="col"
              className="sticky top-0 z-20 border-b border-l-2 bg-muted px-2 py-2 text-right font-medium"
            >
              All days
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.hours.map((hour) => (
            <tr key={hour}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-b bg-background px-3 py-1 text-left font-normal text-muted-foreground"
              >
                {formatHour12(hour)}
              </th>
              {DAYS.map((day) => {
                const cell = summary.cell(day.value, hour)
                return (
                  <Figure
                    key={day.value}
                    figures={cell}
                    metric={metric}
                    status={cell.status}
                    needed={cell.needed}
                    label={`${day.long} ${formatHour12(hour)}`}
                    dimmed={highlight !== null && cell.status !== highlight}
                  />
                )
              })}
              {(() => {
                const total = summary.hourTotal(hour)
                return (
                  <Figure
                    figures={total}
                    metric={metric}
                    status={totalStatus(total)}
                    label={`All days ${formatHour12(hour)}`}
                    className="border-l-2"
                  />
                )
              })()}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <th
              scope="row"
              className="sticky bottom-0 left-0 z-20 border-t-2 border-b bg-muted px-3 py-1.5 text-left"
            >
              Day total
            </th>
            {DAYS.map((day) => {
              const total = summary.dayTotal(day.value)
              return (
                <Figure
                  key={day.value}
                  figures={total}
                  metric={metric}
                  status={totalStatus(total)}
                  label={`${day.long} total`}
                  className="sticky bottom-0 z-10 border-t-2"
                />
              )
            })}
            <Figure
              figures={summary.week}
              metric={metric}
              status={totalStatus(summary.week)}
              label="Whole week"
              className="sticky bottom-0 z-10 border-t-2 border-l-2"
            />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
