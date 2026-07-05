import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  Card,
  FormField,
  IconButton,
  ModalConfirmationDialog,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { BACKUP_SCHEMA_VERSION, DATABASE_SCHEMA_VERSION } from '@db/database'
import {
  CHANGELOG,
  LATEST_CHANGELOG_ENTRY,
  markChangelogSeen,
} from '@domain/changelog'
import {
  DEFAULT_TIMER_SOUND_ID,
  TIMER_SOUNDS,
  preloadTimerSound,
  previewTimerSoundOnce,
} from '@domain/timerSounds'
import { APP_LANGUAGE_OPTIONS } from '@domain/localization'
import { WEIGHT_UNIT_OPTIONS } from '@domain/weightUnits'
import type { AppLanguage, WeightUnit } from '@shared-types/app'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'
import { settingsRepository } from '@repositories/settingsRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import {
  nativeRestTimerNotificationService,
  supportsNativeRestTimerNotifications,
} from '@services/nativeRestTimerNotificationService'
import {
  isInstalledWebApp,
  supportsWebPushRestTimerNotifications,
  webPushRestTimerNotificationService,
  type WebPushRestTimerNotificationStatus,
} from '@services/webPushRestTimerNotificationService'
import {
  APPLICATION_VERSION,
  BACKUP_FORMAT_VERSION,
  backupService,
  type BackupPreview,
  type JsonBackup,
} from '@services/backupService'
import {
  cloudSyncService,
  type CloudBackupInfo,
} from '@services/cloudSyncService'
import { FeedbackClientError, sendFeedback } from '@services/feedbackClient'
import {
  geminiConnectionStatusForError,
  testGeminiApiKey,
} from '@services/geminiMealAnalysisClient'
import type { IntegrationConnectionStatus } from '@shared-types/app'

type BuildInfo = {
  builtAt: string
  environment: string
  gitHash: string
}

type SettingsSection =
  | 'preferences'
  | 'notifications'
  | 'integrations'
  | 'data'
  | 'about'

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage()
  // Visiting Settings (where the full changelog lives) counts as seeing the
  // latest update, so the app-wide "What's new" banner clears.
  useEffect(() => {
    markChangelogSeen()
  }, [])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [clearConfirmation, setClearConfirmation] = useState('')
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  const [restoreConfirmation, setRestoreConfirmation] = useState('')
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(
    null,
  )
  const [pendingBackup, setPendingBackup] = useState<JsonBackup | null>(null)
  const [isCloudRestoreConfirmOpen, setIsCloudRestoreConfirmOpen] =
    useState(false)
  const [cloudRestoreConfirmation, setCloudRestoreConfirmation] = useState('')
  const [cloudBackupInfo, setCloudBackupInfo] =
    useState<CloudBackupInfo | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [isDestructiveOperationRunning, setIsDestructiveOperationRunning] =
    useState(false)
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(true)
  const [timerBannersEnabled, setTimerBannersEnabled] = useState(true)
  const [selectedTimerSoundId, setSelectedTimerSoundId] = useState(
    DEFAULT_TIMER_SOUND_ID,
  )
  const [timerSoundMessage, setTimerSoundMessage] = useState<string | null>(
    null,
  )
  const [nativeTimerAlertMessage, setNativeTimerAlertMessage] = useState<
    string | null
  >(null)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb')
  const [weightUnitMessage, setWeightUnitMessage] = useState<string | null>(
    null,
  )
  const [rirTrackingEnabled, setRirTrackingEnabled] = useState(true)
  const [rirTrackingMessage, setRirTrackingMessage] = useState<string | null>(
    null,
  )
  const [languageMessage, setLanguageMessage] = useState<string | null>(null)
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('')
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [geminiStatus, setGeminiStatus] =
    useState<IntegrationConnectionStatus>('not_configured')
  const [geminiBusy, setGeminiBusy] = useState(false)
  const [geminiMessage, setGeminiMessage] = useState<string | null>(null)
  const [geminiError, setGeminiError] = useState<string | null>(null)
  const [whatsNewOpen, setWhatsNewOpen] = useState(
    () => searchParams.get('section') === 'whats-new',
  )
  const { user, status: authStatus, signIn, signOut } = useAuth()
  const { refreshDashboard } = useDashboardContext()
  const visibleCloudBackupInfo =
    authStatus === 'signedIn' && isOnline ? cloudBackupInfo : null
  const usesNativeSystemSound = supportsNativeRestTimerNotifications()
  const usesWebPushSystemSound =
    !usesNativeSystemSound && supportsWebPushRestTimerNotifications()
  const usesSystemTimerAlertSound =
    usesNativeSystemSound || usesWebPushSystemSound

  const requestedSection = searchParams.get('section')
  const settingsSection = settingsSectionFromQuery(requestedSection)
  const isWhatsNewSubpageOpen = whatsNewOpen || requestedSection === 'whats-new'
  const closeWhatsNewSubpage = () => {
    setWhatsNewOpen(false)
    if (requestedSection === 'whats-new') {
      void navigate('/settings', { replace: true })
      return
    }
  }

  // The banner deep link already owns a router history entry. Adding the
  // state-driven subpage entry on top of it makes cleanup navigate back to the
  // same `section=whats-new` URL and immediately reopen the screen.
  useSubpageBackGesture(
    whatsNewOpen && requestedSection !== 'whats-new',
    closeWhatsNewSubpage,
  )

  useEffect(() => {
    if (requestedSection === 'whats-new') {
      return
    }
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [requestedSection])

  useEffect(() => {
    let isCurrent = true

    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }

      setTimerSoundEnabled(settings.timerSoundEnabled ?? true)
      setTimerBannersEnabled(settings.timerBannersEnabled ?? true)
      setSelectedTimerSoundId(
        settings.selectedTimerSoundId ?? DEFAULT_TIMER_SOUND_ID,
      )
      setWeightUnit(settings.weightUnit ?? 'lb')
      setRirTrackingEnabled(settings.rirTrackingEnabled ?? true)
    })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true
    void settingsRepository.getGeminiApiKeySettings().then((settings) => {
      if (!isCurrent) {
        return
      }
      setGeminiConfigured(Boolean(settings?.apiKey))
      setGeminiStatus(settings?.status ?? 'not_configured')
    })
    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    if (requestedSection !== 'ai-meal') {
      return
    }
    const timeoutId = window.setTimeout(() => {
      document.getElementById('ai-meal-settings')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [requestedSection])

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  useEffect(() => {
    if (authStatus !== 'signedIn' || !isOnline) {
      return
    }

    let isCurrent = true
    void cloudSyncService
      .getCloudBackupInfo()
      .then((info) => {
        if (isCurrent) {
          setCloudBackupInfo(info)
          setCloudError(null)
        }
      })
      .catch((caught: unknown) => {
        if (isCurrent) {
          setCloudError(cloudErrorMessage(caught))
        }
      })

    return () => {
      isCurrent = false
    }
  }, [authStatus, isOnline])

  useEffect(() => {
    if (typeof fetch !== 'function') {
      return
    }

    let isCurrent = true
    void fetch(`/build-info.json?cacheBust=${Date.now()}`, {
      cache: 'no-store',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((info: BuildInfo | null) => {
        if (isCurrent && info?.gitHash) {
          setBuildInfo(info)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setBuildInfo(null)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  function saveTimerSettings(next: {
    timerSoundEnabled: boolean
    selectedTimerSoundId: string
    timerBannersEnabled: boolean
  }) {
    setTimerSoundEnabled(next.timerSoundEnabled)
    setSelectedTimerSoundId(next.selectedTimerSoundId)
    setTimerBannersEnabled(next.timerBannersEnabled)
    void settingsRepository
      .saveTimerSettings(next)
      .then(async () => {
        if (!next.timerBannersEnabled) {
          await Promise.all([
            nativeRestTimerNotificationService.cancel(),
            webPushRestTimerNotificationService.cancel(),
          ])
        }
      })
      .then(() => {
        setTimerSoundMessage('Timer settings saved.')
      })
  }

  function saveWeightUnit(unit: WeightUnit) {
    setWeightUnit(unit)
    void settingsRepository.saveWeightUnit(unit).then(() => {
      // The dashboard precomputes unit-formatted bodyweight text, so refresh it
      // alongside the live-query driven displays elsewhere in the app.
      refreshDashboard()
      setWeightUnitMessage(
        unit === 'kg'
          ? 'Weights now shown in kilograms. Existing history is converted automatically.'
          : 'Weights now shown in pounds. Existing history is converted automatically.',
      )
    })
  }

  function saveRirTracking(enabled: boolean) {
    setRirTrackingEnabled(enabled)
    void settingsRepository.saveRirTrackingEnabled(enabled).then(() => {
      setRirTrackingMessage(
        enabled
          ? 'RIR fields are shown during workouts and in prescriptions.'
          : 'RIR fields are hidden. Recorded RIR history is kept.',
      )
    })
  }

  async function saveAppLanguage(nextLanguage: AppLanguage) {
    await setLanguage(nextLanguage)
    setLanguageMessage(
      nextLanguage === 'es'
        ? 'Language changed to Spanish.'
        : 'Language changed to English.',
    )
  }

  function previewTimerSound(soundId = selectedTimerSoundId) {
    void previewTimerSoundOnce(soundId).catch(() => {
      setTimerSoundMessage(
        'Timer sound could not play. Raise media volume, check the selected audio output, and try again.',
      )
    })
  }

  async function previewSystemTimerAlert() {
    try {
      const status = usesNativeSystemSound
        ? await nativeRestTimerNotificationService.preview()
        : await webPushRestTimerNotificationService.preview()
      setTimerSoundMessage(t(systemTimerAlertPreviewMessage(status)))
    } catch {
      setTimerSoundMessage(
        t(
          'Timer alert could not be tested. Check notification settings and try again.',
        ),
      )
    }
  }

  async function enableNativeTimerAlerts() {
    try {
      const status =
        await nativeRestTimerNotificationService.requestPermission()
      setNativeTimerAlertMessage(
        status === 'granted'
          ? 'Outside-app rest-timer alerts are enabled.'
          : 'Notifications are disabled. Allow them for this app in iPhone Settings.',
      )
    } catch {
      setNativeTimerAlertMessage(
        'Notification permission could not be checked.',
      )
    }
  }

  async function enableWebPushTimerAlerts() {
    try {
      const status =
        await webPushRestTimerNotificationService.requestPermission()
      if (status === 'granted') {
        const workout = await workoutRepository.getActiveWorkout()
        if (timerBannersEnabled) {
          await webPushRestTimerNotificationService.sync(
            workout?.activeRestTimer ?? null,
          )
        }
      }
      setNativeTimerAlertMessage(webPushPermissionMessage(status))
    } catch {
      setNativeTimerAlertMessage(
        'Outside-app timer alerts could not be enabled. Check your internet connection and try again.',
      )
    }
  }

  useEffect(() => {
    preloadTimerSound(selectedTimerSoundId)
  }, [selectedTimerSoundId])

  async function exportJsonBackup() {
    setOperationError(null)
    try {
      const exportResult = await backupService.createJsonBackup()
      downloadBlob(
        new Blob([exportResult.json], { type: 'application/json' }),
        exportResult.filename,
      )
      setOperationMessage('JSON backup prepared for local download.')
    } catch {
      setOperationError('Backup could not be created.')
    }
  }

  async function exportCsvArchive() {
    setOperationError(null)
    try {
      const exportResult = await backupService.createCsvArchive()
      downloadBlob(exportResult.blob, exportResult.filename)
      setOperationMessage(
        `CSV export prepared with ${exportResult.files.length} files.`,
      )
    } catch {
      setOperationError('CSV export could not be created.')
    }
  }

  async function startGoogleSignIn() {
    setCloudError(null)
    try {
      await signIn()
    } catch (caught) {
      setCloudError(cloudErrorMessage(caught))
    }
  }

  async function signOutFromCloud() {
    setCloudError(null)
    try {
      await signOut()
      setCloudBackupInfo(null)
      setCloudMessage('Signed out of cloud backup.')
    } catch (caught) {
      setCloudError(cloudErrorMessage(caught))
    }
  }

  async function backupToCloud() {
    setCloudBusy(true)
    setCloudError(null)
    setCloudMessage(null)
    try {
      const info = await cloudSyncService.backupToCloud()
      setCloudBackupInfo(info)
      setCloudMessage('Cloud backup saved.')
    } catch (caught) {
      setCloudError(cloudErrorMessage(caught))
    } finally {
      setCloudBusy(false)
    }
  }

  async function restoreFromCloud() {
    if (cloudRestoreConfirmation !== 'RESTORE') {
      return
    }

    setCloudBusy(true)
    setCloudError(null)
    setCloudMessage(null)
    try {
      await cloudSyncService.restoreFromCloud()
      setCloudMessage('Cloud backup restored. Reloading local data.')
      refreshDashboard()
      window.location.reload()
    } catch (caught) {
      setCloudError(cloudErrorMessage(caught))
    } finally {
      setCloudBusy(false)
      setIsCloudRestoreConfirmOpen(false)
      setCloudRestoreConfirmation('')
    }
  }

  async function parseRestoreFile(file: File | undefined) {
    if (!file) {
      return
    }

    setOperationError(null)
    const result = await backupService.parseBackupFile(file)
    setRestorePreview(result.preview)
    if (result.ok) {
      setPendingBackup(result.backup)
      setIsRestoreConfirmOpen(true)
    } else {
      setPendingBackup(null)
      setOperationError('Backup validation failed. No data was changed.')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function restoreReplace() {
    if (!pendingBackup || restoreConfirmation !== 'REPLACE') {
      return
    }

    setIsDestructiveOperationRunning(true)
    setOperationError(null)
    try {
      await backupService.restoreReplace(pendingBackup)
      setOperationMessage('Backup restored. Reloading local data.')
      refreshDashboard()
      window.location.reload()
    } catch {
      setOperationError('Restore failed. Current local data was preserved.')
    } finally {
      setIsDestructiveOperationRunning(false)
      setIsRestoreConfirmOpen(false)
      setRestoreConfirmation('')
    }
  }

  async function clearAllData() {
    if (clearConfirmation !== 'DELETE') {
      return
    }

    setIsDestructiveOperationRunning(true)
    setOperationError(null)
    try {
      await backupService.clearAllData()
      setOperationMessage('All local data was cleared. Reloading empty state.')
      refreshDashboard()
      window.location.reload()
    } catch {
      setOperationError('Data could not be cleared. No partial clear was kept.')
    } finally {
      setIsDestructiveOperationRunning(false)
      setIsClearConfirmOpen(false)
      setClearConfirmation('')
    }
  }

  async function submitFeedback() {
    const text = feedbackText.trim()
    if (!text) {
      setFeedbackError('Enter some feedback first.')
      return
    }
    setFeedbackSending(true)
    setFeedbackError(null)
    setFeedbackMessage(null)
    // Context helps triage which build/device the feedback came from. The server
    // caps and stores none of it — it only relays it to the chat webhook.
    const context = [
      `v${APPLICATION_VERSION}`,
      buildInfo ? buildInfo.gitHash : 'dev',
      buildInfo?.environment ?? 'development',
      typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ]
      .filter(Boolean)
      .join(' · ')
    try {
      await sendFeedback(text, context)
      setFeedbackText('')
      setFeedbackMessage('Thanks! Your feedback was sent.')
    } catch (caught) {
      setFeedbackError(
        caught instanceof FeedbackClientError
          ? caught.message
          : 'Feedback could not be sent. Please try again later.',
      )
    } finally {
      setFeedbackSending(false)
    }
  }

  async function saveAndTestGeminiKey() {
    const apiKey = geminiApiKeyInput.trim()
    if (!apiKey) {
      setGeminiError('Enter a Gemini API key.')
      return
    }
    setGeminiBusy(true)
    setGeminiMessage(null)
    setGeminiError(null)
    setGeminiStatus('testing')
    try {
      await settingsRepository.saveGeminiApiKey(apiKey, 'testing')
      await testGeminiApiKey({ apiKey })
      await settingsRepository.updateGeminiApiKeyStatus('connected')
      setGeminiConfigured(true)
      setGeminiStatus('connected')
      setGeminiApiKeyInput('')
      setGeminiMessage('Gemini 3.5 Flash is connected.')
    } catch (error) {
      const status = geminiConnectionStatusForError(error)
      await settingsRepository.updateGeminiApiKeyStatus(status)
      setGeminiConfigured(true)
      setGeminiStatus(status)
      setGeminiError(geminiSettingsError(status))
    } finally {
      setGeminiBusy(false)
    }
  }

  async function testSavedGeminiKey() {
    setGeminiBusy(true)
    setGeminiMessage(null)
    setGeminiError(null)
    setGeminiStatus('testing')
    try {
      const settings = await settingsRepository.getGeminiApiKeySettings()
      if (!settings?.apiKey) {
        setGeminiConfigured(false)
        setGeminiStatus('not_configured')
        setGeminiError('Enter a Gemini API key.')
        return
      }
      await settingsRepository.updateGeminiApiKeyStatus('testing')
      await testGeminiApiKey({ apiKey: settings.apiKey })
      await settingsRepository.updateGeminiApiKeyStatus('connected')
      setGeminiStatus('connected')
      setGeminiMessage('Gemini 3.5 Flash is connected.')
    } catch (error) {
      const status = geminiConnectionStatusForError(error)
      await settingsRepository.updateGeminiApiKeyStatus(status)
      setGeminiStatus(status)
      setGeminiError(geminiSettingsError(status))
    } finally {
      setGeminiBusy(false)
    }
  }

  async function removeGeminiKey() {
    await settingsRepository.removeGeminiApiKey()
    setGeminiApiKeyInput('')
    setGeminiConfigured(false)
    setGeminiStatus('not_configured')
    setGeminiError(null)
    setGeminiMessage('Gemini API key removed from this device.')
  }

  if (isWhatsNewSubpageOpen) {
    return (
      <PageContainer>
        <SectionHeader
          title="What's new"
          action={
            <IconButton
              aria-label="Back to settings"
              type="button"
              onClick={closeWhatsNewSubpage}
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </IconButton>
          }
        />
        <Card className="subpage-enter">
          <ChangelogList entries={CHANGELOG} />
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {operationMessage ? (
        <StatusMessage tone="success">{operationMessage}</StatusMessage>
      ) : null}
      {operationError ? (
        <StatusMessage tone="warning">{operationError}</StatusMessage>
      ) : null}

      <SettingsSectionNavigation
        activeSection={settingsSection}
        onChange={(section) => {
          void navigate(`/settings?section=${section}`, { replace: true })
        }}
      />

      {settingsSection === 'preferences' ? (
        <>
          <SectionHeader title="Preferences" />
          <Card>
            <FormField
              id="app-language-select"
              label="App language"
              helpText="Changes the language used throughout the app."
            >
              <select
                id="app-language-select"
                onChange={(event) => {
                  void saveAppLanguage(event.currentTarget.value as AppLanguage)
                }}
                value={language}
              >
                {APP_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </FormField>
            {languageMessage ? (
              <StatusMessage tone="success">{languageMessage}</StatusMessage>
            ) : null}
            <FormField
              id="weight-unit-select"
              label="Weight unit"
              helpText="Switches every weight in the app, including past history."
            >
              <select
                id="weight-unit-select"
                onChange={(event) =>
                  saveWeightUnit(event.currentTarget.value as WeightUnit)
                }
                value={weightUnit}
              >
                {WEIGHT_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </FormField>
            {weightUnitMessage ? (
              <StatusMessage tone="success">{weightUnitMessage}</StatusMessage>
            ) : null}
            <label className="checkbox-row">
              <input
                checked={rirTrackingEnabled}
                onChange={(event) =>
                  saveRirTracking(event.currentTarget.checked)
                }
                type="checkbox"
              />
              {t('Track RIR (reps in reserve)')}
            </label>
            <p className="muted">
              {t(
                'When off, RIR inputs and targets are hidden during workouts and in prescriptions.',
              )}
            </p>
            {rirTrackingMessage ? (
              <StatusMessage tone="success">{rirTrackingMessage}</StatusMessage>
            ) : null}
          </Card>
        </>
      ) : null}

      {settingsSection === 'notifications' ? (
        <>
          <SectionHeader title="Notifications" />
          <Card>
            {usesSystemTimerAlertSound ? (
              <>
                {timerSoundMessage ? (
                  <StatusMessage tone="success">
                    {timerSoundMessage}
                  </StatusMessage>
                ) : null}
                <p>
                  <strong>{t('Timer alert sound')}</strong>
                </p>
                <p className="muted">
                  {t(
                    'Default iPhone notification sound. Its volume and playback behavior are controlled by iPhone notification settings.',
                  )}
                </p>
                <label className="checkbox-row">
                  <input
                    checked={timerBannersEnabled}
                    onChange={(event) =>
                      saveTimerSettings({
                        timerSoundEnabled,
                        selectedTimerSoundId,
                        timerBannersEnabled: event.currentTarget.checked,
                      })
                    }
                    type="checkbox"
                  />
                  {t('Timer notification banners')}
                </label>
                <div className="button-row">
                  <SecondaryButton
                    disabled={!timerBannersEnabled}
                    type="button"
                    onClick={() => void previewSystemTimerAlert()}
                  >
                    {t('Test iPhone alert')}
                  </SecondaryButton>
                </div>
              </>
            ) : (
              <>
                {timerSoundMessage ? (
                  <StatusMessage tone="success">
                    {timerSoundMessage}
                  </StatusMessage>
                ) : null}
                <label className="checkbox-row">
                  <input
                    checked={timerSoundEnabled}
                    onChange={(event) =>
                      saveTimerSettings({
                        timerSoundEnabled: event.currentTarget.checked,
                        selectedTimerSoundId,
                        timerBannersEnabled,
                      })
                    }
                    type="checkbox"
                  />
                  {t('Timer completion sound')}
                </label>
                <FormField
                  id="timer-sound-select"
                  label="Sound selection"
                  helpText="In-app timer sounds briefly mix with other audio. Outside-app alerts use the iPhone notification sound."
                >
                  <select
                    id="timer-sound-select"
                    onChange={(event) =>
                      saveTimerSettings({
                        timerSoundEnabled,
                        selectedTimerSoundId: event.currentTarget.value,
                        timerBannersEnabled,
                      })
                    }
                    value={selectedTimerSoundId}
                  >
                    {TIMER_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.id}>
                        {t(sound.name)}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="button-row">
                  <SecondaryButton
                    type="button"
                    onClick={() => previewTimerSound(selectedTimerSoundId)}
                  >
                    Preview
                  </SecondaryButton>
                </div>
              </>
            )}
            {supportsNativeRestTimerNotifications() ? (
              <>
                <p className="muted">
                  {t(
                    'Native timer alerts are scheduled on this iPhone and work when the app is closed or in the background.',
                  )}
                </p>
                <SecondaryButton
                  type="button"
                  onClick={() => void enableNativeTimerAlerts()}
                >
                  {t('Enable outside-app timer alerts')}
                </SecondaryButton>
                {nativeTimerAlertMessage ? (
                  <StatusMessage tone="warning">
                    {t(nativeTimerAlertMessage)}
                  </StatusMessage>
                ) : null}
              </>
            ) : supportsWebPushRestTimerNotifications() ? (
              <>
                <p className="muted">
                  {t(
                    isInstalledWebApp()
                      ? 'Web notifications can alert you when the timer finishes while another app or the Home Screen is open. Internet access and iPhone notification sounds are required.'
                      : 'Install this app on the iPhone Home Screen before enabling outside-app timer alerts.',
                  )}
                </p>
                <SecondaryButton
                  type="button"
                  onClick={() => void enableWebPushTimerAlerts()}
                >
                  {t('Enable outside-app timer alerts')}
                </SecondaryButton>
                {nativeTimerAlertMessage ? (
                  <StatusMessage tone="warning">
                    {t(nativeTimerAlertMessage)}
                  </StatusMessage>
                ) : null}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {settingsSection === 'integrations' ? (
        <section id="ai-meal-settings">
          <SectionHeader title="AI meal analysis" />
          <Card>
            <p>
              <strong>Gemini 3.5 Flash</strong>
            </p>
            <p className="muted">
              {t(
                'The key stays in local app storage. Meal photos are sent directly from this device to Google for analysis and are never included in app backups. Google may use free-tier requests to improve its products.',
              )}
            </p>
            <FormField
              id="gemini-api-key"
              label="Gemini API key"
              helpText={
                geminiConfigured
                  ? 'A key is saved on this device. Enter another key to replace it.'
                  : 'Create a free key in Google AI Studio.'
              }
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                id="gemini-api-key"
                onChange={(event) =>
                  setGeminiApiKeyInput(event.currentTarget.value)
                }
                placeholder={
                  geminiConfigured
                    ? t('Key saved on this device')
                    : t('Paste Gemini API key')
                }
                spellCheck={false}
                type="password"
                value={geminiApiKeyInput}
              />
            </FormField>
            <p className="muted">
              {t('Status')}: {t(geminiStatusLabel(geminiStatus))}
            </p>
            {geminiMessage ? (
              <StatusMessage tone="success">{geminiMessage}</StatusMessage>
            ) : null}
            {geminiError ? <ValidationMessage message={geminiError} /> : null}
            <div className="button-row">
              <PrimaryButton
                disabled={geminiBusy}
                onClick={() => void saveAndTestGeminiKey()}
                type="button"
              >
                {geminiBusy ? 'Testing...' : 'Save and test'}
              </PrimaryButton>
              {geminiConfigured ? (
                <>
                  <SecondaryButton
                    disabled={geminiBusy}
                    onClick={() => void testSavedGeminiKey()}
                    type="button"
                  >
                    Test connection
                  </SecondaryButton>
                  <SecondaryButton
                    disabled={geminiBusy}
                    onClick={() => void removeGeminiKey()}
                    type="button"
                  >
                    Remove key
                  </SecondaryButton>
                </>
              ) : null}
              <a
                className="button button-secondary"
                href="https://aistudio.google.com/app/apikey"
                rel="noreferrer"
                target="_blank"
              >
                {t('Get API key')}
              </a>
            </div>
          </Card>
        </section>
      ) : null}

      {settingsSection === 'data' ? (
        <>
          <SectionHeader title="Local data" />
          <Card>
            <p className="muted">
              {t(
                'Local backup files and CSV exports stay on this device unless you use the separate cloud backup controls below.',
              )}
            </p>
            <div className="button-row">
              <SecondaryButton type="button" onClick={exportJsonBackup}>
                Export JSON backup
              </SecondaryButton>
              <SecondaryButton type="button" onClick={exportCsvArchive}>
                Export CSV archive
              </SecondaryButton>
              <SecondaryButton
                disabled={isDestructiveOperationRunning}
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Restore JSON
              </SecondaryButton>
            </div>
            <input
              ref={fileInputRef}
              aria-label="Restore JSON backup file"
              accept="application/json,.json"
              className="visually-hidden"
              type="file"
              onChange={(event) => {
                void parseRestoreFile(event.target.files?.[0])
              }}
            />
            {restorePreview ? <ImportPreview preview={restorePreview} /> : null}
            <div className="button-row settings-clear-all-row">
              <SecondaryButton
                className="button-danger"
                disabled={isDestructiveOperationRunning}
                type="button"
                onClick={() => setIsClearConfirmOpen(true)}
              >
                Clear all data
              </SecondaryButton>
            </div>
          </Card>

          <SectionHeader title="Cloud backup" />
          <Card className="cloud-backup-card">
            <p className="muted">
              {t(
                'Manual Google-account backup and restore. Local data remains usable while signed out or offline.',
              )}
            </p>
            {!isOnline ? (
              <StatusMessage tone="warning">
                Cloud backup is unavailable offline. Local app data still works
                on this device.
              </StatusMessage>
            ) : null}
            {cloudMessage ? (
              <StatusMessage tone="success">{cloudMessage}</StatusMessage>
            ) : null}
            {cloudError ? (
              <StatusMessage tone="warning">{cloudError}</StatusMessage>
            ) : null}
            <dl className="settings-list">
              <div>
                <dt>{t('Account')}</dt>
                <dd>
                  {authStatus === 'loading'
                    ? t('Checking sign-in')
                    : user?.email
                      ? user.email
                      : t('Not signed in')}
                </dd>
              </div>
              <div>
                <dt>{t('Last cloud backup')}</dt>
                <dd>
                  {visibleCloudBackupInfo
                    ? `${formatCloudTimestamp(visibleCloudBackupInfo.updatedAt)} · ${visibleCloudBackupInfo.recordCount} records`
                    : t('No cloud backup loaded')}
                </dd>
              </div>
            </dl>
            <div className="button-row">
              {authStatus === 'signedIn' ? (
                <>
                  <PrimaryButton
                    disabled={cloudBusy || !isOnline}
                    type="button"
                    onClick={() => void backupToCloud()}
                  >
                    {cloudBusy ? 'Working' : 'Back up now'}
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={cloudBusy || !isOnline}
                    type="button"
                    onClick={() => setIsCloudRestoreConfirmOpen(true)}
                  >
                    Restore from cloud
                  </SecondaryButton>
                  <SecondaryButton
                    disabled={cloudBusy}
                    type="button"
                    onClick={() => void signOutFromCloud()}
                  >
                    Sign out
                  </SecondaryButton>
                </>
              ) : (
                <PrimaryButton
                  disabled={authStatus === 'loading' || !isOnline}
                  type="button"
                  onClick={() => void startGoogleSignIn()}
                >
                  Sign in with Google
                </PrimaryButton>
              )}
            </div>
          </Card>
        </>
      ) : null}

      {settingsSection === 'about' ? (
        <>
          <SectionHeader title="Send feedback" />
          <Card>
            <p className="muted">
              {t(
                'Found a bug or have an idea? Send it straight to the developer. Your app version and device are included to help with debugging.',
              )}
            </p>
            <FormField id="feedback-message" label="Your feedback">
              <textarea
                id="feedback-message"
                className="feedback-textarea"
                maxLength={1800}
                onChange={(event) => setFeedbackText(event.target.value)}
                placeholder={t(
                  "What's working, what's not, or what you'd like to see…",
                )}
                rows={4}
                value={feedbackText}
              />
            </FormField>
            {feedbackError ? (
              <ValidationMessage message={feedbackError} />
            ) : null}
            {feedbackMessage ? (
              <StatusMessage tone="success">{feedbackMessage}</StatusMessage>
            ) : null}
            <PrimaryButton
              type="button"
              disabled={feedbackSending || !feedbackText.trim()}
              onClick={() => void submitFeedback()}
            >
              {feedbackSending ? 'Sending…' : 'Send feedback'}
            </PrimaryButton>
          </Card>

          <div id="settings-whats-new">
            <SectionHeader title="What's new" />
            <Card>
              {LATEST_CHANGELOG_ENTRY ? (
                <ChangelogList entries={[LATEST_CHANGELOG_ENTRY]} />
              ) : (
                <p className="muted">{t('No updates logged yet.')}</p>
              )}
              <div className="button-row">
                <SecondaryButton
                  type="button"
                  onClick={() => setWhatsNewOpen(true)}
                >
                  Show all
                </SecondaryButton>
              </div>
            </Card>
          </div>

          <SectionHeader title="Application" />
          <Card>
            <dl className="settings-list">
              <div>
                <dt>{t('Application version')}</dt>
                <dd>{APPLICATION_VERSION}</dd>
              </div>
              <div>
                <dt>{t('Build')}</dt>
                <dd>
                  {buildInfo
                    ? `${buildInfo.gitHash} · ${buildInfo.environment} · ${formatBuildTimestamp(buildInfo.builtAt)}`
                    : t('Development')}
                </dd>
              </div>
              <div>
                <dt>{t('Database schema version')}</dt>
                <dd>{DATABASE_SCHEMA_VERSION}</dd>
              </div>
              <div>
                <dt>{t('Backup format version')}</dt>
                <dd>{BACKUP_FORMAT_VERSION}</dd>
              </div>
              <div>
                <dt>{t('Metadata backup schema')}</dt>
                <dd>{BACKUP_SCHEMA_VERSION}</dd>
              </div>
            </dl>
          </Card>
        </>
      ) : null}

      <ModalConfirmationDialog
        confirmLabel="Replace data"
        isOpen={isRestoreConfirmOpen}
        onCancel={() => {
          setIsRestoreConfirmOpen(false)
          setRestoreConfirmation('')
        }}
        onConfirm={() => {
          void restoreReplace()
        }}
        title="Replace local data?"
      >
        <p>
          {t(
            'Replace restore is the only supported restore mode in this release. Merge restore is unavailable because conflict behavior is not yet safe enough to automate. Type REPLACE to delete current local data and import this validated backup.',
          )}
        </p>
        <FormField id="restore-confirmation" label="Confirmation">
          <input
            id="restore-confirmation"
            value={restoreConfirmation}
            onChange={(event) => setRestoreConfirmation(event.target.value)}
          />
        </FormField>
        {restoreConfirmation !== 'REPLACE' ? (
          <ValidationMessage message="Type REPLACE to continue." />
        ) : null}
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Restore from cloud"
        isOpen={isCloudRestoreConfirmOpen}
        onCancel={() => {
          setIsCloudRestoreConfirmOpen(false)
          setCloudRestoreConfirmation('')
        }}
        onConfirm={() => {
          void restoreFromCloud()
        }}
        title="Restore cloud backup?"
      >
        <p>
          {t(
            'This replaces all local app data on this device with the last cloud backup for the signed-in Google account. Type RESTORE to continue.',
          )}
        </p>
        <FormField id="cloud-restore-confirmation" label="Confirmation">
          <input
            id="cloud-restore-confirmation"
            value={cloudRestoreConfirmation}
            onChange={(event) =>
              setCloudRestoreConfirmation(event.target.value)
            }
          />
        </FormField>
        {cloudRestoreConfirmation !== 'RESTORE' ? (
          <ValidationMessage message="Type RESTORE to continue." />
        ) : null}
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Delete local data"
        isOpen={isClearConfirmOpen}
        onCancel={() => {
          setIsClearConfirmOpen(false)
          setClearConfirmation('')
        }}
        onConfirm={() => {
          void clearAllData()
        }}
        title="Clear all data?"
      >
        <p>
          {t(
            'This deletes local settings, nutrition data, bodyweight entries, exercises, programs, active workouts, and completed history. Export a JSON backup first if you want to restore this data later. Type DELETE to continue.',
          )}
        </p>
        <FormField id="clear-confirmation" label="Confirmation">
          <input
            id="clear-confirmation"
            value={clearConfirmation}
            onChange={(event) => setClearConfirmation(event.target.value)}
          />
        </FormField>
        {clearConfirmation !== 'DELETE' ? (
          <ValidationMessage message="Type DELETE to continue." />
        ) : null}
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function SettingsSectionNavigation({
  activeSection,
  onChange,
}: {
  activeSection: SettingsSection
  onChange: (section: SettingsSection) => void
}) {
  const { t } = useLanguage()
  const sections: Array<{ label: string; value: SettingsSection }> = [
    { label: 'Preferences', value: 'preferences' },
    { label: 'Notifications', value: 'notifications' },
    { label: 'Integrations', value: 'integrations' },
    { label: 'Data', value: 'data' },
    { label: 'About', value: 'about' },
  ]

  return (
    <nav className="settings-section-nav" aria-label={t('Settings sections')}>
      {sections.map((section) => (
        <button
          aria-current={
            activeSection === section.value ? ('page' as const) : undefined
          }
          key={section.value}
          onClick={() => onChange(section.value)}
          type="button"
        >
          {t(section.label)}
        </button>
      ))}
    </nav>
  )
}

function settingsSectionFromQuery(section: string | null): SettingsSection {
  switch (section) {
    case 'notifications':
      return 'notifications'
    case 'ai-meal':
    case 'integrations':
      return 'integrations'
    case 'data':
      return 'data'
    case 'about':
    case 'whats-new':
      return 'about'
    case 'preferences':
    default:
      return 'preferences'
  }
}

function geminiStatusLabel(status: IntegrationConnectionStatus) {
  switch (status) {
    case 'not_configured':
      return 'Not configured'
    case 'testing':
      return 'Testing'
    case 'connected':
      return 'Connected'
    case 'invalid_key':
      return 'Invalid key'
    case 'rate_limited':
      return 'Rate limited'
    case 'network_unavailable':
      return 'Offline'
    case 'service_unavailable':
      return 'Unavailable'
  }
}

function geminiSettingsError(status: IntegrationConnectionStatus) {
  switch (status) {
    case 'invalid_key':
      return 'Google rejected this Gemini API key.'
    case 'rate_limited':
      return 'The Gemini free-tier limit was reached. Try again later.'
    case 'network_unavailable':
      return 'Gemini could not be reached. Check your connection and try again.'
    case 'service_unavailable':
      return 'Gemini is unavailable right now. Try again later.'
    case 'not_configured':
    case 'testing':
    case 'connected':
      return 'Gemini connection testing did not complete.'
  }
}

function webPushPermissionMessage(status: WebPushRestTimerNotificationStatus) {
  switch (status) {
    case 'granted':
    case 'scheduled':
      return 'Outside-app rest-timer alerts are enabled.'
    case 'install-required':
      return 'Install this app on the iPhone Home Screen, open the installed app, and try again.'
    case 'denied':
      return 'Notifications are disabled. Allow them for this app in iPhone Settings.'
    case 'not-configured':
      return 'Outside-app timer alerts are not configured on this deployment.'
    case 'unavailable':
      return 'This browser does not support outside-app timer alerts.'
    case 'permission-required':
      return 'Notification permission was not granted.'
    case 'failed':
      return 'Outside-app timer alerts could not be enabled. Check your internet connection and try again.'
    case 'canceled':
    case 'expired':
      return 'Outside-app rest-timer alerts are enabled.'
  }
}

function systemTimerAlertPreviewMessage(
  status: WebPushRestTimerNotificationStatus,
) {
  switch (status) {
    case 'scheduled':
    case 'granted':
      return 'Timer alert test sent. If you did not hear it, check iPhone notification sound settings for this app.'
    case 'install-required':
      return 'Install this app on the iPhone Home Screen, open the installed app, and try again.'
    case 'denied':
      return 'Notifications are disabled. Allow them for this app in iPhone Settings.'
    case 'permission-required':
      return 'Notification permission was not granted.'
    case 'not-configured':
      return 'Outside-app timer alerts are not configured on this deployment.'
    case 'unavailable':
      return 'This browser does not support iPhone timer alert tests.'
    case 'failed':
      return 'Timer alert could not be tested. Check notification settings and try again.'
    case 'canceled':
    case 'expired':
      return 'Timer alert test sent. If you did not hear it, check iPhone notification sound settings for this app.'
  }
}

function formatBuildTimestamp(timestamp: string) {
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString()
}

function formatCloudTimestamp(timestamp: string) {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return timestamp
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function cloudErrorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : 'Cloud backup failed.'
}

function ImportPreview({ preview }: { preview: BackupPreview }) {
  const { t } = useLanguage()
  return (
    <section className="import-preview" aria-label={t('Import preview')}>
      <h3>{t('Import preview')}</h3>
      <dl className="settings-list">
        <div>
          <dt>{t('Filename')}</dt>
          <dd>{preview.filename}</dd>
        </div>
        <div>
          <dt>{t('Exported')}</dt>
          <dd>{preview.exportedAt}</dd>
        </div>
        <div>
          <dt>{t('Backup format')}</dt>
          <dd>{preview.backupFormatVersion}</dd>
        </div>
        <div>
          <dt>{t('Database schema')}</dt>
          <dd>{preview.databaseSchemaVersion}</dd>
        </div>
        <div>
          <dt>{t('Application')}</dt>
          <dd>{preview.applicationVersion}</dd>
        </div>
        <div>
          <dt>{t('Restore mode')}</dt>
          <dd>{t('Replace current data')}</dd>
        </div>
        <div>
          <dt>{t('Total records')}</dt>
          <dd>{preview.totalRecordCount}</dd>
        </div>
      </dl>
      <details>
        <summary>{t('Record counts')}</summary>
        <ul className="compact-list">
          {Object.entries(preview.counts).map(([name, count]) => (
            <li key={name}>
              <span>{name}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      </details>
      {preview.warnings.length > 0 ? (
        <StatusMessage tone="warning">
          {preview.warnings.join(' ')}
        </StatusMessage>
      ) : null}
      {preview.errors.length > 0 ? (
        <ul className="validation-list" aria-label={t('Validation errors')}>
          {preview.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function ChangelogList({ entries }: { entries: typeof CHANGELOG }) {
  return (
    <div className="changelog">
      {entries.map((entry) => (
        <section className="changelog-entry" key={entry.id}>
          <header className="changelog-entry-header">
            <h3>{entry.title}</h3>
            <span className="muted">{entry.date}</span>
          </header>
          <ul className="changelog-items">
            {entry.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
