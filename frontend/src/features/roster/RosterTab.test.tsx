import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp, stubApi } from '@/test/render'

const schedule = {
  id: 1,
  name: 'Downtown',
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  staffCount: 2,
  shiftCount: 2,
  hasTransactions: true,
  transactionsFileName: 'week.csv',
  transactionsUploadedAt: '2026-11-01T09:00:00Z',
}
const staff = [
  { id: 1, name: 'Anna', maxWeeklyHours: 40 },
  { id: 2, name: 'Ben', maxWeeklyHours: 40 },
]
const shifts = [
  { id: 1, startHour: 7, endHour: 15 },
  { id: 2, startHour: 15, endHour: 23 },
]
const demand = {
  hasData: true,
  fileName: 'week.csv',
  uploadedAt: null,
  cells: [],
  total: 0,
  peak: null,
  warnings: [],
}
const drafted = {
  assignments: [
    { id: 10, day: 1, shiftId: 1, staffId: 1 },
    { id: 11, day: 2, shiftId: 2, staffId: 2 },
  ],
  warnings: [
    {
      type: 'UNDERSTAFFED',
      day: 5,
      hour: 13,
      staffId: null,
      needed: 4,
      scheduled: 2,
      message: 'Friday 13:00 needs 4 people, has 2',
    },
  ],
  stats: {
    shortfallStaffHours: 2,
    unmetTransactions: 32,
    idleStaffHours: 1.5,
    score: -100,
    staff: [
      { staffId: 1, name: 'Anna', hours: 8, maxHours: 40, utilisation: 0.2 },
      { staffId: 2, name: 'Ben', hours: 8, maxHours: 40, utilisation: 0.2 },
    ],
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubRoster(
  options: { existing?: typeof drafted.assignments; schedule?: object; postStatus?: number } = {},
) {
  return stubApi(({ method, url }) => {
    if (method === 'POST' && url.endsWith('/auto-schedule')) {
      return options.postStatus
        ? {
            status: options.postStatus,
            body: { detail: 'Add at least one staff member before auto-scheduling', errors: { staff: 'x' } },
          }
        : { body: drafted }
    }
    if (url.endsWith('/assignments')) return { body: options.existing ?? [] }
    if (url.endsWith('/transactions')) return { body: demand }
    if (url.endsWith('/staff')) return { body: staff }
    if (url.endsWith('/shifts')) return { body: shifts }
    return { body: options.schedule ?? schedule }
  })
}

/** The Auto-schedule button once the existing roster has loaded (it is disabled until then). */
async function enabledStartButton() {
  const button = await screen.findByRole('button', { name: /auto-schedule/i })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

function posts(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
}

describe('auto-scheduling', () => {
  it('is disabled and says what is missing until the demand data is uploaded', async () => {
    stubRoster({ schedule: { ...schedule, hasTransactions: false } })
    renderApp('/schedules/1/roster')

    expect(await screen.findByRole('button', { name: /auto-schedule/i })).toBeDisabled()
    expect(screen.getByText(/add demand data first/i)).toBeInTheDocument()
  })

  it('cannot replace a roster it has not loaded yet', async () => {
    stubApi(({ method, url }) => {
      if (method === 'GET' && url.endsWith('/assignments')) return { status: 500, body: { detail: 'down' } }
      if (url.endsWith('/transactions')) return { body: demand }
      if (url.endsWith('/staff')) return { body: staff }
      if (url.endsWith('/shifts')) return { body: shifts }
      return { body: schedule }
    })
    renderApp('/schedules/1/roster')

    expect(await screen.findByText("Couldn't load the roster")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto-schedule/i })).toBeDisabled()
  })

  it('says plainly when nobody could be scheduled and why', async () => {
    const nobody = {
      assignments: [],
      warnings: [
        {
          type: 'UNDER_UTILISED',
          day: null,
          hour: null,
          staffId: 1,
          needed: null,
          scheduled: null,
          message: "Anna can't be scheduled: their maximum of 4 hours is below the shortest shift (8 hours)",
        },
      ],
      stats: { ...drafted.stats, shortfallStaffHours: 112 },
    }
    stubApi(({ method, url }) => {
      if (method === 'POST' && url.endsWith('/auto-schedule')) return { body: nobody }
      if (url.endsWith('/assignments')) return { body: [] }
      if (url.endsWith('/transactions')) return { body: demand }
      if (url.endsWith('/staff')) return { body: staff }
      if (url.endsWith('/shifts')) return { body: shifts }
      return { body: schedule }
    })
    renderApp('/schedules/1/roster')
    const user = userEvent.setup()

    await user.click(await enabledStartButton())

    expect(await screen.findByText('Nobody could be scheduled')).toBeInTheDocument()
    expect(screen.getByText(/below the shortest shift/)).toBeInTheDocument()
    expect(screen.queryByText('Draft ready')).not.toBeInTheDocument()
  })

  it('explains why hours can be short while people still have hours left', async () => {
    stubRoster()
    renderApp('/schedules/1/roster')
    const user = userEvent.setup()

    await user.click(await enabledStartButton())

    expect(await screen.findByText(/another person on a long shift would sit idle/)).toBeInTheDocument()
  })

  it('drafts the week, shows who works which shift and lists what needs attention', async () => {
    const fetchMock = stubRoster()
    renderApp('/schedules/1/roster')
    const user = userEvent.setup()

    await user.click(await enabledStartButton())

    const table = await screen.findByRole('table', { name: 'Weekly roster' })
    expect(within(within(table).getByRole('row', { name: /07:00/ })).getByText('Anna')).toBeInTheDocument()
    expect(
      within(within(table).getByRole('row', { name: /15:00 – 23:00/ })).getByText('Ben'),
    ).toBeInTheDocument()
    expect(screen.getByText('Friday 13:00 needs 4 people, has 2')).toBeInTheDocument()
    expect(posts(fetchMock)).toHaveLength(1)
  })

  it('asks before replacing an existing roster', async () => {
    const fetchMock = stubRoster({ existing: drafted.assignments })
    renderApp('/schedules/1/roster')
    const user = userEvent.setup()

    await user.click(await enabledStartButton())

    expect(await screen.findByText('Replace the current roster?')).toBeInTheDocument()
    expect(posts(fetchMock)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Replace roster' }))

    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1))
  })

  it('shows the server message and leaves the roster alone when the schedule is not ready', async () => {
    const fetchMock = stubRoster({ postStatus: 422 })
    renderApp('/schedules/1/roster')
    const user = userEvent.setup()

    await user.click(await enabledStartButton())

    expect(
      await screen.findByText('Add at least one staff member before auto-scheduling'),
    ).toBeInTheDocument()
    expect(screen.getByText(/no roster yet/i)).toBeInTheDocument()
    expect(posts(fetchMock)).toHaveLength(1)
  })

  it('sends one request even if the button is clicked again while scheduling', async () => {
    const fetchMock = stubRoster()
    const respond = fetchMock.getMockImplementation()!
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') await gate
      return respond(url, init)
    })
    renderApp('/schedules/1/roster')
    const user = userEvent.setup()

    await user.click(await enabledStartButton())
    expect(await screen.findByRole('button', { name: /scheduling/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /scheduling/i }))
    release()

    await screen.findByRole('table', { name: 'Weekly roster' })
    expect(posts(fetchMock)).toHaveLength(1)
  })
})
