import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

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
  SwitchControl,
  ValidationMessage,
} from '@components/ui'
import { useLanguage } from '@components/languageContextValue'
import { BACKUP_SCHEMA_VERSION, DATABASE_SCHEMA_VERSION } from '@db/database'
import { CHANGELOG, LATEST_CHANGELOG_ENTRY } from '@domain/changelog'
import {
  DEFAULT_TIMER_SOUND_ID,
  TIMER_SOUNDS,
  preloadTimerSound,
  previewTimerSoundOnce,
} from '@domain/timerSounds'
import { APP_LANGUAGE_OPTIONS } from '@domain/localization'
import { WEIGHT_UNIT_OPTIONS } from '@domain/weightUnits'
import type {
  AppLanguage,
  WeightUnit,
  WorkoutAutofillMode,
} from '@shared-types/app'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@hooks/useAuth'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'
import { getAppMetadata } from '@repositories/appMetadataRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type { StoragePersistenceStatus } from '@services/appInitializationService'
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
import { automaticCloudBackupService } from '@services/automaticCloudBackupService'
import { FeedbackClientError, sendFeedback } from '@services/feedbackClient'
import { accountService } from '@services/accountService'
import { clearLegalAcceptance } from '@services/legalAcceptanceService'

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

const FEEDBACK_ENABLED =
  import.meta.env.VITE_FEEDBACK_ENABLED?.trim().toLowerCase() === 'true'

export function SettingsPage() {
  const { language, setLanguage, t } = useLanguage()
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
  const [isCloudDeleteConfirmOpen, setIsCloudDeleteConfirmOpen] =
    useState(false)
  const [cloudDeleteConfirmation, setCloudDeleteConfirmation] = useState('')
  const [isAccountDeleteConfirmOpen, setIsAccountDeleteConfirmOpen] =
    useState(false)
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] = useState('')
  const [cloudBackupInfo, setCloudBackupInfo] =
    useState<CloudBackupInfo | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [showAppleRevocationSteps, setShowAppleRevocationSteps] =
    useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [isFitnessDataExporting, setIsFitnessDataExporting] = useState(false)
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
  const [rirTrackingEnabled, setRirTrackingEnabled] = useState(false)
  const [rirTrackingMessage, setRirTrackingMessage] = useState<string | null>(
    null,
  )
  const [workoutAutofillMode, setWorkoutAutofillMode] =
    useState<WorkoutAutofillMode>('history_copy')
  const [workoutAutofillMessage, setWorkoutAutofillMessage] = useState<
    string | null
  >(null)
  const [languageMessage, setLanguageMessage] = useState<string | null>(null)
  const [storagePersistenceStatus, setStoragePersistenceStatus] =
    useState<StoragePersistenceStatus | null>(null)
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [whatsNewOpen, setWhatsNewOpen] = useState(
    () => searchParams.get('section') === 'whats-new',
  )
  const {
    user,
    status: authStatus,
    signIn,
    signInWithApple,
    signOut,
  } = useAuth()
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
      setRirTrackingEnabled(settings.rirTrackingEnabled ?? false)
      setWorkoutAutofillMode(settings.workoutAutofillMode ?? 'history_copy')
    })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    void getAppMetadata().then((metadata) => {
      if (!isCurrent) {
        return
      }
      setStoragePersistenceStatus(metadata?.storagePersistenceStatus ?? null)
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

  function saveWorkoutAutofill(mode: WorkoutAutofillMode) {
    setWorkoutAutofillMode(mode)
    void settingsRepository.saveWorkoutAutofillMode(mode).then(() => {
      setWorkoutAutofillMessage(
        mode === 'smart_progression'
          ? 'Smart progression will estimate upcoming sets from completed history.'
          : 'New workouts will copy matching completed sets from recent history.',
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

  function toggleOutsideAppTimerAlerts(enabled: boolean) {
    saveTimerSettings({
      timerSoundEnabled,
      selectedTimerSoundId,
      timerBannersEnabled: enabled,
    })
    if (!enabled) {
      setNativeTimerAlertMessage(null)
      return
    }
    if (supportsNativeRestTimerNotifications()) {
      void enableNativeTimerAlerts()
    } else {
      void enableWebPushTimerAlerts()
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
    if (isFitnessDataExporting) {
      return
    }
    setIsFitnessDataExporting(true)
    setOperationError(null)
    setOperationMessage(null)
    try {
      const exportResult = await backupService.createCsvArchive()
      downloadBlob(exportResult.blob, exportResult.filename)
      setOperationMessage(
        exportResult.validation.ok
          ? `Fitness data export prepared: ${formatFileSize(exportResult.byteSize)}, ${exportResult.totalRecordCount} records in ${exportResult.fileCount} files.`
          : `Fitness data export prepared with a warning report: ${formatFileSize(exportResult.byteSize)}, ${exportResult.totalRecordCount} records in ${exportResult.fileCount} files.`,
      )
    } catch (caught) {
      setOperationError(
        caught instanceof Error
          ? `Fitness data export failed: ${caught.message}`
          : 'Fitness data export could not be created.',
      )
    } finally {
      setIsFitnessDataExporting(false)
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

  async function startAppleSignIn() {
    setCloudError(null)
    try {
      await signInWithApple()
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
      automaticCloudBackupService.markCurrentDeviceSafe()
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
      automaticCloudBackupService.markCurrentDeviceSafe()
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

  async function deleteCloudData() {
    if (cloudDeleteConfirmation !== 'DELETE CLOUD') {
      return
    }

    setCloudBusy(true)
    setCloudError(null)
    setCloudMessage(null)
    try {
      await cloudSyncService.deleteCloudData()
      await signOut()
      setCloudBackupInfo(null)
      setCloudMessage(
        'Cloud backup data was deleted. Local data remains on this device.',
      )
    } catch (caught) {
      setCloudError(cloudErrorMessage(caught))
    } finally {
      setCloudBusy(false)
      setIsCloudDeleteConfirmOpen(false)
      setCloudDeleteConfirmation('')
    }
  }

  async function deleteAccount() {
    if (accountDeleteConfirmation !== 'DELETE ACCOUNT') {
      return
    }
    setCloudBusy(true)
    setCloudError(null)
    setCloudMessage(null)
    setShowAppleRevocationSteps(false)
    try {
      const result = await accountService.deleteAccount()
      setCloudBackupInfo(null)
      setShowAppleRevocationSteps(result.providerRevocation === 'manual_apple')
      setCloudMessage(
        result.providerRevocation === 'manual_apple'
          ? 'Account and cloud data deleted. Local data remains. Finish by revoking Vigorune in your Apple Account settings.'
          : 'Account and cloud data deleted. Local data remains on this device.',
      )
    } catch (caught) {
      setCloudError(cloudErrorMessage(caught))
    } finally {
      setCloudBusy(false)
      setIsAccountDeleteConfirmOpen(false)
      setAccountDeleteConfirmation('')
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
      clearLegalAcceptance()
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
            <FormField
              id="workout-autofill-mode"
              label="Workout set autofill"
              helpText="Choose how completed exercise history fills weight and reps in a new workout."
            >
              <select
                id="workout-autofill-mode"
                onChange={(event) =>
                  saveWorkoutAutofill(
                    event.currentTarget.value as WorkoutAutofillMode,
                  )
                }
                value={workoutAutofillMode}
              >
                <option value="history_copy">{t('Recorded history')}</option>
                <option value="smart_progression">
                  {t('Smart progression')}
                </option>
              </select>
            </FormField>
            <p className="muted">
              {workoutAutofillMode === 'smart_progression'
                ? t(
                    'Estimates weight and reps across sets using prior performance, fatigue, rep ranges, and RIR when RIR tracking is on.',
                  )
                : t(
                    'Copies weight and reps from matching completed sets in the most recent workout history.',
                  )}
            </p>
            {workoutAutofillMessage ? (
              <StatusMessage tone="success">
                {workoutAutofillMessage}
              </StatusMessage>
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
                <SwitchControl
                  checked={timerBannersEnabled}
                  label="Enable outside-app timer alerts"
                  onChange={(event) =>
                    toggleOutsideAppTimerAlerts(event.currentTarget.checked)
                  }
                />
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
                <SwitchControl
                  checked={timerBannersEnabled}
                  disabled={!isInstalledWebApp()}
                  label="Enable outside-app timer alerts"
                  onChange={(event) =>
                    toggleOutsideAppTimerAlerts(event.currentTarget.checked)
                  }
                />
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
              <strong>OpenAI meal analysis</strong>
            </p>
            <p className="muted">
              {t(
                'Meal photos are resized on this device and sent through Vigorune’s secure same-origin server route for analysis. The OpenAI API key stays on the server and is never stored in this app, its backups, or its exports.',
              )}
            </p>
            <p className="muted">
              {t(
                'Analysis runs only after you choose photos and press Analyze meal. Results remain editable estimates and are not logged until you explicitly confirm them.',
              )}
            </p>
          </Card>
        </section>
      ) : null}

      {settingsSection === 'data' ? (
        <>
          <SectionHeader title="Local data" />
          <Card>
            <p className="muted">
              {t(
                'Local backup files and ZIP exports stay on this device unless you use the separate cloud backup controls below.',
              )}
            </p>
            <dl className="settings-list">
              <div>
                <dt>{t('Device storage')}</dt>
                <dd>{storagePersistenceLabel(storagePersistenceStatus)}</dd>
              </div>
            </dl>
            <div className="button-row">
              <PrimaryButton
                disabled={isFitnessDataExporting}
                type="button"
                onClick={exportCsvArchive}
              >
                {isFitnessDataExporting
                  ? t('Exporting fitness data…')
                  : t('Export all fitness data')}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={exportJsonBackup}>
                Export JSON backup
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
                'Signed-in data is backed up automatically about every fifteen minutes after changes and when the app opens. Local data remains usable while signed out or offline.',
              )}
            </p>
            <p className="muted">
              When cloud backup is enabled, a readable fitness snapshot and
              daily calorie totals leave this device and are stored for the
              signed-in account. Camera photos and API keys are not included.
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
            {showAppleRevocationSteps ? (
              <p>
                <a
                  href="https://support.apple.com/102571"
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Apple's Sign in with Apple removal steps
                </a>
              </p>
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
                  <SecondaryButton
                    className="button-danger"
                    disabled={cloudBusy || !isOnline}
                    type="button"
                    onClick={() => setIsCloudDeleteConfirmOpen(true)}
                  >
                    Delete cloud data
                  </SecondaryButton>
                  <SecondaryButton
                    className="button-danger"
                    disabled={cloudBusy || !isOnline}
                    type="button"
                    onClick={() => setIsAccountDeleteConfirmOpen(true)}
                  >
                    Delete account
                  </SecondaryButton>
                </>
              ) : (
                <>
                  <PrimaryButton
                    disabled={authStatus === 'loading' || !isOnline}
                    type="button"
                    onClick={() => void startAppleSignIn()}
                  >
                    Sign in with Apple
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={authStatus === 'loading' || !isOnline}
                    type="button"
                    onClick={() => void startGoogleSignIn()}
                  >
                    Sign in with Google
                  </SecondaryButton>
                </>
              )}
            </div>
          </Card>
        </>
      ) : null}

      {settingsSection === 'about' ? (
        <>
          {FEEDBACK_ENABLED ? (
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
                  <StatusMessage tone="success">
                    {feedbackMessage}
                  </StatusMessage>
                ) : null}
                <PrimaryButton
                  type="button"
                  disabled={feedbackSending || !feedbackText.trim()}
                  onClick={() => void submitFeedback()}
                >
                  {feedbackSending ? 'Sending…' : 'Send feedback'}
                </PrimaryButton>
              </Card>
            </>
          ) : null}

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
            <nav
              className="settings-policy-links"
              aria-label="Policies and support"
            >
              <Link to="/terms">Terms of Use</Link>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/consumer-health-data-privacy">
                Consumer Health Data Privacy Policy
              </Link>
              <Link to="/account-deletion">Account deletion</Link>
              <Link to="/support">Support</Link>
            </nav>
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
            'This replaces all local app data on this device with the last cloud backup for the signed-in account. Type RESTORE to continue.',
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
        confirmLabel="Delete cloud data"
        isOpen={isCloudDeleteConfirmOpen}
        onCancel={() => {
          setIsCloudDeleteConfirmOpen(false)
          setCloudDeleteConfirmation('')
        }}
        onConfirm={() => {
          void deleteCloudData()
        }}
        title="Delete cloud data?"
      >
        <p>
          This permanently deletes the signed-in account's cloud backup and
          daily calorie rows, then signs out. Local data on this device is not
          changed. Type DELETE CLOUD to continue.
        </p>
        <FormField id="cloud-delete-confirmation" label="Confirmation">
          <input
            id="cloud-delete-confirmation"
            value={cloudDeleteConfirmation}
            onChange={(event) => setCloudDeleteConfirmation(event.target.value)}
          />
        </FormField>
        {cloudDeleteConfirmation !== 'DELETE CLOUD' ? (
          <ValidationMessage message="Type DELETE CLOUD to continue." />
        ) : null}
      </ModalConfirmationDialog>

      <ModalConfirmationDialog
        confirmLabel="Delete account"
        isOpen={isAccountDeleteConfirmOpen}
        onCancel={() => {
          setIsAccountDeleteConfirmOpen(false)
          setAccountDeleteConfirmation('')
        }}
        onConfirm={() => {
          void deleteAccount()
        }}
        title="Permanently delete account?"
      >
        <p>
          This permanently deletes the signed-in Vigorune account, cloud backup,
          and daily nutrition cloud rows, then signs out. Local fitness data on
          this device remains until you separately clear it. If you used Sign in
          with Apple, Vigorune will provide Apple's manual authorization-removal
          steps after deletion. Type DELETE ACCOUNT to continue.
        </p>
        <FormField id="account-delete-confirmation" label="Confirmation">
          <input
            id="account-delete-confirmation"
            value={accountDeleteConfirmation}
            onChange={(event) =>
              setAccountDeleteConfirmation(event.target.value)
            }
          />
        </FormField>
        {accountDeleteConfirmation !== 'DELETE ACCOUNT' ? (
          <ValidationMessage message="Type DELETE ACCOUNT to continue." />
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

function storagePersistenceLabel(status: StoragePersistenceStatus | null) {
  switch (status) {
    case 'granted':
      return 'Protected by browser storage'
    case 'denied':
      return 'Browser may reclaim storage'
    case 'unsupported':
      return 'Persistent storage not supported'
    case 'error':
      return 'Persistent storage check failed'
    default:
      return 'Checking storage'
  }
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function formatFileSize(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`
  }
  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} KB`
  }
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
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
