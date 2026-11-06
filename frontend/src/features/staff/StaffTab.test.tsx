import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp, stubApi } from '@/test/render'

const schedule = {
  id: 1,
  name: 'Downtown',
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  staffCount: 0,
  shiftCount: 2,
  hasTransactions: false,
  transactionsFileName: null,
  transactionsUploadedAt: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function addPerson(name: string, hours: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Name'), name)
  await user.type(screen.getByLabelText('Max hours per week'), hours)
  await user.click(screen.getByRole('button', { name: 'Add' }))
}

describe('adding staff', () => {
  it('shows the server error next to the name field and keeps what was typed', async () => {
    stubApi(({ method, url }) => {
      if (method === 'POST' && url.endsWith('/staff')) {
        return {
          status: 409,
          body: { detail: 'taken', errors: { name: 'Someone with this name is already on the team' } },
        }
      }
      return { body: url.endsWith('/staff') ? [] : schedule }
    })
    renderApp('/schedules/1/staff')

    await addPerson('Anna', '30')

    expect(await screen.findByText('Someone with this name is already on the team')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Anna')
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects hours outside 1-168 before calling the API', async () => {
    const fetchMock = stubApi(({ url }) => ({ body: url.endsWith('/staff') ? [] : schedule }))
    renderApp('/schedules/1/staff')

    await addPerson('Ben', '200')

    expect(await screen.findByText('A week has only 168 hours')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('clears the form after a successful add so the next person can be typed straight away', async () => {
    let staff: unknown[] = []
    stubApi(({ method, url, body }) => {
      if (method === 'POST' && url.endsWith('/staff')) {
        staff = [{ id: 7, ...(body as object) }]
        return { status: 201, body: staff[0] }
      }
      return { body: url.endsWith('/staff') ? staff : schedule }
    })
    renderApp('/schedules/1/staff')

    await addPerson('Chloe', '25')

    expect(await screen.findByRole('cell', { name: 'Chloe' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''))
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })
})
