import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

describe('app shell', () => {
  it('renders the header and the home page', () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)

    expect(screen.getByText('Staff Scheduler')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /welcome/i })).toBeInTheDocument()
  })
})
