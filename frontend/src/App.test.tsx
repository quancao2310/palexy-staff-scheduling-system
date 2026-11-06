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
})
