import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage({ what = 'page' }: { what?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold">We couldn't find that {what}</h1>
        <p className="mt-1 text-muted-foreground">It may have been deleted, or the link is wrong.</p>
      </div>
      <Button asChild>
        <Link to="/">Back to schedules</Link>
      </Button>
    </div>
  )
}
