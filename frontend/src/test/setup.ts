import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without injected globals here, so Testing Library's auto-cleanup must be wired up by hand.
afterEach(() => {
  cleanup()
})
