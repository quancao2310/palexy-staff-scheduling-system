import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp, stubApi } from './test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('app shell', () => {
  it('shows the empty state when there are no schedules yet', async () => {
    stubApi(() => ({ body: [] }))

    renderApp('/')

    expect(screen.getByText('Staff Scheduler')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /plan your first week/i })).toBeInTheDocument()
  })

  it('shows a not-found state for a schedule that does not exist', async () => {
    stubApi(() => ({ status: 404, body: { detail: 'Schedule 99 not found' } }))

    renderApp('/schedules/99/staff')

    expect(await screen.findByRole('heading', { name: /couldn't find that schedule/i })).toBeInTheDocument()
  })
})
