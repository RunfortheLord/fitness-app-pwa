import { useEffect, useRef, useState } from 'react'

import {
  Card,
  FormField,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { BACKUP_SCHEMA_VERSION, DATABASE_SCHEMA_VERSION } from '@db/database'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  APPLICATION_VERSION,
  BACKUP_FORMAT_VERSION,
  backupService,
  type BackupPreview,
  type JsonBackup,
} from '@services/backupService'

const emptyTargets = {
  calories: '',
  proteinGrams: '',
  carbohydrateGrams: '',
  fatGrams: '',
}

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [clearConfirmation, setClearConfirmation] = useState('')
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  const [restoreConfirmation, setRestoreConfirmation] = useState('')
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(
    null,
  )
  const [pendingBackup, setPendingBackup] = useState<JsonBackup | null>(null)
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [isDestructiveOperationRunning, setIsDestructiveOperationRunning] =
    useState(false)
  const [targetForm, setTargetForm] = useState(emptyTargets)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [targetMessage, setTargetMessage] = useState<string | null>(null)
  const { refreshDashboard } = useDashboardContext()
  const parsedTargets = parseTargetForm(targetForm)

  useEffect(() => {
    let isCurrent = true

    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }

      setTargetForm({
        calories: String(settings.nutritionTargets.calories),
        proteinGrams: String(settings.nutritionTargets.proteinGrams),
        carbohydrateGrams: String(settings.nutritionTargets.carbohydrateGrams),
        fatGrams: String(settings.nutritionTargets.fatGrams),
      })
    })

    return () => {
      isCurrent = false
    }
  }, [])

  function updateTarget(field: keyof typeof emptyTargets, value: string) {
    setTargetForm((current) => ({ ...current, [field]: value }))
  }

  function saveTargets() {
    if (!parsedTargets.ok) {
      setTargetError(parsedTargets.error)
      return
    }

    void settingsRepository
      .saveNutritionTargets(parsedTargets.value)
      .then(() => {
        setTargetError(null)
        setTargetMessage('Nutrition targets saved.')
        refreshDashboard()
      })
      .catch((caught: unknown) => {
        setTargetError(
          caught instanceof Error ? caught.message : 'Targets could not save.',
        )
      })
  }

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

  return (
    <PageContainer>
      {operationMessage ? (
        <StatusMessage tone="success">{operationMessage}</StatusMessage>
      ) : null}
      {operationError ? (
        <StatusMessage tone="warning">{operationError}</StatusMessage>
      ) : null}

      <SectionHeader title="Preferences" />
      <Card>
        <dl className="settings-list">
          <div>
            <dt>Weight unit</dt>
            <dd>Pounds (lb)</dd>
          </div>
          <div>
            <dt>Nutrition targets</dt>
            <dd>Set manually below.</dd>
          </div>
        </dl>
      </Card>

      <SectionHeader title="Nutrition targets" />
      <Card>
        {targetMessage ? (
          <StatusMessage tone="success">{targetMessage}</StatusMessage>
        ) : null}
        <FormField id="target-calories" label="Calories">
          <NumericInput
            id="target-calories"
            onChange={(event) => updateTarget('calories', event.target.value)}
            placeholder="0"
            value={targetForm.calories}
          />
        </FormField>
        <FormField id="target-protein" label="Protein target">
          <NumericInput
            id="target-protein"
            onChange={(event) =>
              updateTarget('proteinGrams', event.target.value)
            }
            placeholder="0"
            value={targetForm.proteinGrams}
          />
        </FormField>
        <FormField id="target-carbs" label="Carbohydrate target">
          <NumericInput
            id="target-carbs"
            onChange={(event) =>
              updateTarget('carbohydrateGrams', event.target.value)
            }
            placeholder="0"
            value={targetForm.carbohydrateGrams}
          />
        </FormField>
        <FormField id="target-fat" label="Fat target">
          <NumericInput
            id="target-fat"
            onChange={(event) => updateTarget('fatGrams', event.target.value)}
            placeholder="0"
            value={targetForm.fatGrams}
          />
        </FormField>
        {targetError ? <ValidationMessage message={targetError} /> : null}
        <PrimaryButton
          disabled={!parsedTargets.ok}
          type="button"
          onClick={saveTargets}
        >
          Save targets
        </PrimaryButton>
      </Card>

      <SectionHeader title="Local data" />
      <Card>
        <p className="muted">
          Backups, restore files, and CSV exports stay on this device. The app
          does not upload data, create accounts, or sync to cloud services.
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
        <SecondaryButton
          className="button-danger"
          disabled={isDestructiveOperationRunning}
          type="button"
          onClick={() => setIsClearConfirmOpen(true)}
        >
          Clear all data
        </SecondaryButton>
      </Card>

      <SectionHeader title="Application" />
      <Card>
        <dl className="settings-list">
          <div>
            <dt>Application version</dt>
            <dd>{APPLICATION_VERSION}</dd>
          </div>
          <div>
            <dt>Database schema version</dt>
            <dd>{DATABASE_SCHEMA_VERSION}</dd>
          </div>
          <div>
            <dt>Backup format version</dt>
            <dd>{BACKUP_FORMAT_VERSION}</dd>
          </div>
          <div>
            <dt>Metadata backup schema</dt>
            <dd>{BACKUP_SCHEMA_VERSION}</dd>
          </div>
        </dl>
      </Card>

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
          Replace restore is the only supported restore mode in this release.
          Merge restore is unavailable because conflict behavior is not yet safe
          enough to automate. Type REPLACE to delete current local data and
          import this validated backup.
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
          This deletes local settings, nutrition data, bodyweight entries,
          exercises, programs, active workouts, and completed history. Export a
          JSON backup first if you want to restore this data later. Type DELETE
          to continue.
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

function ImportPreview({ preview }: { preview: BackupPreview }) {
  return (
    <section className="import-preview" aria-label="Import preview">
      <h3>Import preview</h3>
      <dl className="settings-list">
        <div>
          <dt>Filename</dt>
          <dd>{preview.filename}</dd>
        </div>
        <div>
          <dt>Exported</dt>
          <dd>{preview.exportedAt}</dd>
        </div>
        <div>
          <dt>Backup format</dt>
          <dd>{preview.backupFormatVersion}</dd>
        </div>
        <div>
          <dt>Database schema</dt>
          <dd>{preview.databaseSchemaVersion}</dd>
        </div>
        <div>
          <dt>Application</dt>
          <dd>{preview.applicationVersion}</dd>
        </div>
        <div>
          <dt>Restore mode</dt>
          <dd>Replace current data</dd>
        </div>
        <div>
          <dt>Total records</dt>
          <dd>{preview.totalRecordCount}</dd>
        </div>
      </dl>
      <details>
        <summary>Record counts</summary>
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
        <ul className="validation-list" aria-label="Validation errors">
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

function parseTargetForm(form: typeof emptyTargets):
  | {
      ok: true
      value: {
        calories: number
        proteinGrams: number
        carbohydrateGrams: number
        fatGrams: number
      }
    }
  | { ok: false; error: string } {
  const calories = parseNonNegativeNumber(form.calories)
  const proteinGrams = parseNonNegativeNumber(form.proteinGrams)
  const carbohydrateGrams = parseNonNegativeNumber(form.carbohydrateGrams)
  const fatGrams = parseNonNegativeNumber(form.fatGrams)

  if (
    calories === null ||
    proteinGrams === null ||
    carbohydrateGrams === null ||
    fatGrams === null
  ) {
    return { ok: false, error: 'Targets must be zero or greater.' }
  }

  return {
    ok: true,
    value: { calories, proteinGrams, carbohydrateGrams, fatGrams },
  }
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
