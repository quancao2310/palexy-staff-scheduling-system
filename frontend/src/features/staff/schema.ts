import { z } from 'zod'

export const staffSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100, 'Use at most 100 characters'),
  maxWeeklyHours: z
    .number({ error: 'Enter the maximum weekly hours' })
    .int('Use a whole number')
    .min(1, 'Must be at least 1 hour')
    .max(168, 'A week has only 168 hours'),
})

export type StaffFormValues = z.infer<typeof staffSchema>
