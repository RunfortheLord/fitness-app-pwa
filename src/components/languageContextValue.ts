import { createContext, useContext } from 'react'

import { translate } from '@domain/localization'
import type { AppLanguage } from '@shared-types/app'

export type TranslationReplacements = Record<string, string | number>

export type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => Promise<void>
  t: (source: string, replacements?: TranslationReplacements) => string
}

const defaultValue: LanguageContextValue = {
  language: 'en',
  setLanguage: async () => undefined,
  t: (source, replacements) => translate('en', source, replacements),
}

export const LanguageContext = createContext<LanguageContextValue>(defaultValue)

export function useLanguage() {
  return useContext(LanguageContext)
}
