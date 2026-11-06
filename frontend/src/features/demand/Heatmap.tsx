import { DAYS } from '@/lib/days'
import { formatHour12 } from '@/lib/time'
import type { TransactionCell } from './api'

const MAX_SHADE_PERCENT = 55

export function Heatmap({ cells }: { cells: TransactionCell[] }) {
  const counts = new Map(cells.map((cell) => [`${cell.day}-${cell.hour}`, cell.transactions]))
  const hours = cells.map((cell) => cell.hour)
  const firstHour = Math.min(...hours)
  const lastHour = Math.max(...hours)
  const peak = Math.max(...cells.map((cell) => cell.transactions), 1)
  const rows = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i)

  const dayTotal = (day: number) =>
    cells.filter((cell) => cell.day === day).reduce((s, c) => s + c.transactions, 0)

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[32rem] border-collapse text-sm tabular-nums">
        <caption className="sr-only">Transactions per hour for each day of the week</caption>
        <thead>
          <tr className="border-b bg-muted/40">
            <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
              Hour
            </th>
            {DAYS.map((day) => (
              <th key={day.value} scope="col" className="px-3 py-2 text-right font-medium">
                <abbr title={day.long} className="no-underline">
                  {day.short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((hour) => (
            <tr key={hour} className="border-b last:border-b-0">
              <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">
                {formatHour12(hour)}
              </th>
              {DAYS.map((day) => {
                const value = counts.get(`${day.value}-${hour}`) ?? 0
                const shade = Math.round((value / peak) * MAX_SHADE_PERCENT)
                return (
                  <td
                    key={day.value}
                    className="px-3 py-1.5 text-right"
                    style={{ backgroundColor: `color-mix(in oklch, var(--primary) ${shade}%, transparent)` }}
                  >
                    {value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40 font-medium">
            <th scope="row" className="px-3 py-2 text-left">
              Total
            </th>
            {DAYS.map((day) => (
              <td key={day.value} className="px-3 py-2 text-right">
                {dayTotal(day.value)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
