import { CircleAlert, Download, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useScheduleId } from '@/features/schedules/useScheduleId'
import { ApiError } from '@/lib/api'
import { showError } from '@/lib/forms'
import { dayName } from '@/lib/days'
import { formatHour12 } from '@/lib/time'
import { useClearTransactions, useTransactions, useUploadTransactions } from './api'
import { Heatmap } from './Heatmap'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function DemandTab() {
  const scheduleId = useScheduleId()
  const { data, isPending, isError, refetch } = useTransactions(scheduleId)
  const upload = useUploadTransactions(scheduleId)
  const clear = useClearTransactions(scheduleId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [confirmingClear, setConfirmingClear] = useState(false)

  function onFileChosen(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    setProblems([])
    setWarnings([])
    upload.mutate(file, {
      onSuccess: (result) => {
        setWarnings(result.warnings)
        toast.success(`Imported ${file.name}`)
      },
      onError: (error) => {
        if (error instanceof ApiError && error.problem?.problems?.length) {
          setProblems(error.problem.problems)
        } else {
          showError(error)
        }
      },
    })
  }

  const chooseButton = (label: string, variant: 'default' | 'outline') => (
    <Button variant={variant} disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
      <Upload /> {upload.isPending ? 'Importing…' : label}
    </Button>
  )

  return (
    <div className="grid gap-6">
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Transaction report CSV file"
        onChange={(event) => onFileChosen(event.target.files?.[0])}
      />

      {problems.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>This file couldn't be imported. Nothing was changed.</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
          <TriangleAlert />
          <AlertTitle>Imported, with a few notes</AlertTitle>
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load the demand data</AlertTitle>
          <AlertDescription>
            <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isPending && <Skeleton className="h-64 w-full rounded-xl" aria-label="Loading demand data" />}

      {data && !data.hasData && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <FileSpreadsheet className="size-6" aria-hidden />
          </div>
          <div className="max-w-lg">
            <h2 className="text-lg font-medium">Upload a weekly transaction report</h2>
            <p className="mt-1 text-muted-foreground">
              A CSV with one row per hour (7am, 8am, …) and one column per day (Mon, Tue, …). Each cell is how
              many transactions happened in that hour. The busier the hour, the more staff it needs.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {chooseButton('Choose CSV file', 'default')}
            <Button variant="outline" asChild>
              <a href="/sample_transaction_interview.csv" download>
                <Download /> Download sample
              </a>
            </Button>
          </div>
        </div>
      )}

      {data && data.hasData && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate font-medium">{data.fileName}</h2>
              {data.uploadedAt && (
                <p className="text-sm text-muted-foreground">
                  Uploaded {dateTime.format(new Date(data.uploadedAt))}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {chooseButton('Replace file', 'outline')}
              <Button variant="ghost" onClick={() => setConfirmingClear(true)}>
                Clear
              </Button>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Stat label="Transactions in the week" value={data.total.toLocaleString()} />
            {data.peak && (
              <Stat
                label="Busiest hour"
                value={`${dayName(data.peak.day)} ${formatHour12(data.peak.hour)}`}
                detail={`${data.peak.transactions} transactions`}
              />
            )}
          </dl>

          <Heatmap cells={data.cells} />
          <p className="text-sm text-muted-foreground">Darker cells are busier hours.</p>
        </>
      )}

      <ConfirmDialog
        open={confirmingClear}
        onOpenChange={setConfirmingClear}
        title="Clear the demand data?"
        description="The uploaded transactions will be removed from this schedule. You can upload a file again at any time."
        confirmLabel="Clear data"
        onConfirm={() =>
          clear.mutate(undefined, {
            onSuccess: () => {
              setProblems([])
              setWarnings([])
              toast.success('Demand data cleared')
            },
            onError: showError,
          })
        }
      />
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="text-sm text-muted-foreground">{detail}</dd>}
    </div>
  )
}
