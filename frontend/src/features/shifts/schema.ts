import { z } from 'zod'

export const shiftSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((shift) => shift.endHour > shift.startHour, {
    path: ['endHour'],
    message: 'End time must be after the start time',
  })

export type ShiftFormValues = z.infer<typeof shiftSchema>

export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, hour) => hour)
