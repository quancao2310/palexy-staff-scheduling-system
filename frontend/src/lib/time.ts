export function formatClock(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatHour12(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour % 24 < 12 ? 'am' : 'pm'}`
}

export function formatShift(startHour: number, endHour: number) {
  return `${formatClock(startHour)} – ${formatClock(endHour)}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}
