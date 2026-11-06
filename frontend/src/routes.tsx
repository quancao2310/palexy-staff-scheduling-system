import type { RouteObject } from 'react-router'
import App from './App'
import { HomePage } from './pages/HomePage'

/** Route table, kept separate from the router instance so tests can mount it in a memory router. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [{ index: true, element: <HomePage /> }],
  },
]
