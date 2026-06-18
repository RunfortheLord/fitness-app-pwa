import { addDays, format, parse } from 'date-fns'

export type LocalDateString = `${number}-${number}-${number}`

export function formatLocalDate(date: Date): LocalDateString {
  return format(date, 'yyyy-MM-dd') as LocalDateString
}

export function parseLocalDate(localDate: LocalDateString): Date {
  return parse(localDate, 'yyyy-MM-dd', new Date())
}

export function addLocalDays(
  localDate: LocalDateString,
  amount: number,
): LocalDateString {
  return formatLocalDate(addDays(parseLocalDate(localDate), amount))
}

export function formatSelectedDateLabel(localDate: LocalDateString): string {
  return format(parseLocalDate(localDate), 'EEE, MMM d')
}
