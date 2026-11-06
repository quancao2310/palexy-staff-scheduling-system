import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp, stubApi } from '@/test/render'

const schedule = {
  id: 1,
  name: 'Downtown',
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  staffCount: 3,
  shiftCount: 2,
  hasTransactions: true,
  transactionsFileName: 'week.csv',
  transactionsUploadedAt: '2026-11-01T09:00:00Z',
}
const staff = [1, 2, 3].map((id) => ({ id, name: `Person ${id}`, maxWeeklyHours: 30 }))
const shifts = [
  { id: 1, startHour: 9, endHour: 11 },
  { id: 2, startHour: 10, endHour: 11 },
]
const transactions = (cells: { day: number; hour: number; transactions: number }[]) => ({
  hasData: true,
  fileName: 'week.csv',
  uploadedAt: null,
  cells,
  total: cells.reduce((sum, cell) => sum + cell.transactions, 0),
  peak: null,
  warnings: [],
})

const quietWeek = {
  cells: [
    { day: 1, hour: 9, transactions: 10 },
    { day: 1, hour: 10, transactions: 40 },
  ],
  assignments: [
    { id: 1, day: 1, shiftId: 1, staffId: 1 },
    { id: 2, day: 1, shiftId: 1, staffId: 2 },
    { id: 3, day: 1, shiftId: 2, staffId: 3 },
  ],
}

function stubSummary({
  cells,
  assignments,
  assignmentsStatus,
}: {
  cells: { day: number; hour: number; transactions: number }[]
  assignments: object[]
  assignmentsStatus?: number
}) {
  return stubApi(({ url }) => {
    if (url.endsWith('/assignments')) {
      return assignmentsStatus
        ? { status: assignmentsStatus, body: { detail: 'down' } }
        : { body: assignments }
    }
    if (url.endsWith('/transactions')) return { body: transactions(cells) }
    if (url.endsWith('/staff')) return { body: staff }
    if (url.endsWith('/shifts')) return { body: shifts }
    return { body: schedule }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('summary tab', () => {
  it('shows the four weekly figures, with overall and average side by side', async () => {
    stubSummary(quietWeek)
    renderApp('/schedules/1/summary')

    const tile = async (label: string) => (await screen.findByText(label)).parentElement
    expect(await tile('Total staff hours')).toHaveTextContent('5')
    expect(await tile('Total staff hours')).toHaveTextContent('of 90 available')
    expect(await tile('Total transactions')).toHaveTextContent('50')
    expect(await tile('Per staff-hour, overall')).toHaveTextContent('10.0')
    expect(await tile('Per staff-hour, overall')).toHaveTextContent('50 ÷ 5')
    expect(await tile('Per staff-hour, average')).toHaveTextContent('9.2')
  })

  it('flags an hour the scheduler would call understaffed, and says what it needs', async () => {
    stubSummary({
      cells: [
        { day: 1, hour: 9, transactions: 57 },
        { day: 1, hour: 10, transactions: 10 },
      ],
      assignments: [
        { id: 1, day: 1, shiftId: 1, staffId: 1 },
        { id: 2, day: 1, shiftId: 1, staffId: 2 },
      ],
    })
    renderApp('/schedules/1/summary')

    expect(await screen.findByRole('button', { name: '1 understaffed hour' })).toBeEnabled()
    expect(screen.getByRole('cell', { name: /Monday 9am.*needs 4, has 2/ })).toHaveAttribute(
      'title',
      'Needs 4, has 2',
    )
  })

  it('highlights one status at a time with the chips', async () => {
    const user = userEvent.setup()
    stubSummary(quietWeek)
    renderApp('/schedules/1/summary')

    const chip = await screen.findByRole('button', { name: '1 quiet hour' })
    await user.click(chip)

    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the number shown in each cell', async () => {
    const user = userEvent.setup()
    stubSummary(quietWeek)
    renderApp('/schedules/1/summary')

    const cell = () => screen.getByRole('cell', { name: /^Monday 10am/ })
    await screen.findByRole('cell', { name: /^Monday 10am/ })
    expect(cell()).toHaveTextContent('13.3') // 40 / 3

    await user.click(screen.getByRole('radio', { name: 'Staff hours' }))
    await waitFor(() => expect(cell().firstElementChild).toHaveTextContent('3'))
  })

  it('points to the roster when nobody is scheduled', async () => {
    stubSummary({ ...quietWeek, assignments: [] })
    renderApp('/schedules/1/summary')

    expect(await screen.findByText('Nobody is scheduled yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the roster' })).toHaveAttribute(
      'href',
      '/schedules/1/roster',
    )
  })

  it('offers a retry when the roster cannot be loaded', async () => {
    stubSummary({ ...quietWeek, assignmentsStatus: 500 })
    renderApp('/schedules/1/summary')

    expect(await screen.findByText("Couldn't load the summary")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
