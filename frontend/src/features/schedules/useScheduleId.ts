import { useParams } from 'react-router'

export function useScheduleId() {
  return Number(useParams().scheduleId)
}
