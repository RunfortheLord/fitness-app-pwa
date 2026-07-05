import { addDays, format, parse } from 'date-fns'
import { es } from 'date-fns/locale'

import type { AppLanguage } from '@shared-types/app'

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

export function formatSelectedDateLabel(
  localDate: LocalDateString,
  language: AppLanguage = 'en',
): string {
  return format(parseLocalDate(localDate), 'EEE, MMM d', {
    locale: language === 'es' ? es : undefined,
  })
}
