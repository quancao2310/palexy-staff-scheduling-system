import { CalendarClock } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-sm text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CalendarClock className="size-5 text-primary" aria-hidden />
              Staff Scheduler
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </main>
        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  )
}
