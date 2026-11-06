import { Navigate, type RouteObject } from 'react-router'
import App from './App'
import { ScheduleLayout } from './features/schedules/ScheduleLayout'
import { SchedulesPage } from './features/schedules/SchedulesPage'
import { StaffTab } from './features/staff/StaffTab'
import { NotFoundPage } from './pages/NotFoundPage'

/** Route table, kept separate from the router instance so tests can mount it in a memory router. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <SchedulesPage /> },
      {
        path: 'schedules/:scheduleId',
        element: <ScheduleLayout />,
        children: [
          { index: true, element: <Navigate to="staff" replace /> },
          { path: 'staff', element: <StaffTab /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
