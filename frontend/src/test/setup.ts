import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without injected globals here, so Testing Library's auto-cleanup must be wired up by hand.
afterEach(() => {
  cleanup()
})

// jsdom has no matchMedia, which sonner's Toaster reads. Defined on window (not via vi.stubGlobal)
// so tests calling vi.unstubAllGlobals() keep it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})
