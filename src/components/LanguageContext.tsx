import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'

import {
  LanguageContext,
  type LanguageContextValue,
} from '@components/languageContextValue'
import { translate } from '@domain/localization'
import { settingsRepository } from '@repositories/settingsRepository'
import type { AppLanguage } from '@shared-types/app'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const storedLanguage = useLiveQuery(async () => {
    const settings = await settingsRepository.getSettings()
    return settings?.language ?? 'en'
  }, [])
  const language = storedLanguage ?? 'en'

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    await settingsRepository.saveLanguage(nextLanguage)
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (source, replacements) => translate(language, source, replacements),
    }),
    [language, setLanguage],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
