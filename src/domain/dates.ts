import { format } from 'date-fns'

export type LocalDateString = `${number}-${number}-${number}`

export function formatLocalDate(date: Date): LocalDateString {
  return format(date, 'yyyy-MM-dd') as LocalDateString
}
