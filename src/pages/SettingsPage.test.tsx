import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@app/App'
import { db } from '@db/database'
import { SettingsPage } from '@pages/SettingsPage'
import { settingsRepository } from '@repositories/settingsRepository'
import { initializeAppData } from '@services/appInitializationService'
import { backupService } from '@services/backupService'
import { cloudSyncService } from '@services/cloudSyncService'
import * as nativeTimerNotifications from '@services/nativeRestTimerNotificationService'
import { seedFood } from '@test/seedFactories'

const authHookMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useAuth: vi.fn(),
}))

const cloudSyncMocks = vi.hoisted(() => ({
  backupToCloud: vi.fn(),
  getCloudBackupInfo: vi.fn(),
  restoreFromCloud: vi.fn(),
}))

vi.mock('@hooks/useAuth', () => ({
  useAuth: authHookMocks.useAuth,
}))

vi.mock('@services/cloudSyncService', () => ({
  cloudSyncService: cloudSyncMocks,
}))

const mockCloudSyncService = vi.mocked(cloudSyncService)

beforeEach(async () => {
  authHookMocks.signIn.mockReset()
  authHookMocks.signOut.mockReset()
  authHookMocks.useAuth.mockReset()
  authHookMocks.useAuth.mockReturnValue({
    signIn: authHookMocks.signIn,
    signOut: authHookMocks.signOut,
    status: 'signedOut',
    user: null,
  })
  mockCloudSyncService.backupToCloud.mockReset()
  mockCloudSyncService.getCloudBackupInfo.mockReset()
  mockCloudSyncService.restoreFromCloud.mockReset()
  mockCloudSyncService.backupToCloud.mockResolvedValue({
    databaseSchemaVersion: 11,
    exportedAt: '2026-01-02T03:04:05.000Z',
    recordCount: 7,
    updatedAt: '2026-01-02T03:04:05.000Z',
  })
  mockCloudSyncService.getCloudBackupInfo.mockResolvedValue(null)
  mockCloudSyncService.restoreFromCloud.mockResolvedValue({
    databaseSchemaVersion: 11,
    exportedAt: '2026-01-02T03:04:05.000Z',
    recordCount: 7,
    updatedAt: '2026-01-02T03:04:05.000Z',
  })
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

function renderSettings(initialEntry = '/settings') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [{ path: 'settings', element: <SettingsPage /> }],
      },
    ],
    { initialEntries: [initialEntry] },
  )

  render(<RouterProvider router={router} />)
}

describe('SettingsPage', () => {
  it('scrolls to the What’s new section when deep-linked from the banner', async () => {
    renderSettings('/settings?section=whats-new')

    expect(
      await screen.findByRole('heading', { name: "What's new" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Back to settings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Faster, smarter food logging')).toBeInTheDocument()
  })

  it('shows settings metadata, local-only explanation, and data actions', async () => {
    renderSettings()

    expect(await screen.findByText('Pounds (lb)')).toBeInTheDocument()
    expect(screen.getByText('Sound selection')).toBeInTheDocument()
    expect(
      screen.getByText(
        'In-app timer sounds briefly mix with other audio. Outside-app alerts use the iPhone notification sound.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByText('Application version')).toBeInTheDocument()
    expect(screen.getByText('Database schema version')).toBeInTheDocument()
    expect(screen.getByText('Backup format version')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Local backup files and CSV exports stay on this device/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Export JSON backup' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Export CSV archive' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Restore JSON' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Cloud backup')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Not signed in')).toBeInTheDocument()
    expect(screen.queryByText('Nutrition targets')).not.toBeInTheDocument()
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument()
    expect(screen.queryByText(/USDA FoodData Central/)).not.toBeInTheDocument()
  })

  it('explains iPhone audio controls when a preview cannot play', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('Playback was blocked', 'NotAllowedError'),
    )
    renderSettings()

    await user.click(await screen.findByRole('button', { name: 'Preview' }))

    expect(
      await screen.findByText(
        'Timer sound could not play. Raise media volume, check the selected audio output, and try again.',
      ),
    ).toBeInTheDocument()
  })

  it('enables outside-app timer alerts in the native iOS wrapper', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      nativeTimerNotifications,
      'supportsNativeRestTimerNotifications',
    ).mockReturnValue(true)
    vi.spyOn(
      nativeTimerNotifications.nativeRestTimerNotificationService,
      'requestPermission',
    ).mockResolvedValue('granted')
    renderSettings()

    await user.click(
      await screen.findByRole('button', {
        name: 'Enable outside-app timer alerts',
      }),
    )

    expect(
      await screen.findByText('Outside-app rest-timer alerts are enabled.'),
    ).toBeInTheDocument()
  })

  it('switches the weight unit and persists the preference', async () => {
    const user = userEvent.setup()
    renderSettings()

    const select = await screen.findByLabelText('Weight unit')
    expect(select).toHaveValue('lb')

    await user.selectOptions(select, 'kg')

    await waitFor(async () => {
      expect((await settingsRepository.getSettings())?.weightUnit).toBe('kg')
    })
    expect(
      await screen.findByText(/Weights now shown in kilograms/),
    ).toBeInTheDocument()
  })

  it('switches the interface to Spanish and persists the preference', async () => {
    const user = userEvent.setup()
    renderSettings()

    const select = await screen.findByLabelText('App language')
    expect(select).toHaveValue('en')

    await user.selectOptions(select, 'es')

    expect(
      await screen.findByRole('heading', { name: 'Configuración' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Preferencias')).toBeInTheDocument()
    expect(screen.getByLabelText('Idioma de la aplicación')).toHaveValue('es')
    expect(screen.getByText('Inicio')).toBeInTheDocument()

    await waitFor(async () => {
      expect((await settingsRepository.getSettings())?.language).toBe('es')
    })
    expect(document.documentElement.lang).toBe('es')
  })

  it('shows the latest update first and opens all logged updates on demand', async () => {
    const user = userEvent.setup()
    renderSettings()

    expect(await screen.findByText('Pounds or kilograms')).toBeInTheDocument()
    expect(
      screen.queryByText('Faster, smarter food logging'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show all' }))

    expect(
      screen.getByRole('button', { name: 'Back to settings' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Faster, smarter food logging')).toBeInTheDocument()
  })

  it('shows signed-in cloud backup info and backs up on demand', async () => {
    const user = userEvent.setup()
    authHookMocks.useAuth.mockReturnValue({
      signIn: authHookMocks.signIn,
      signOut: authHookMocks.signOut,
      status: 'signedIn',
      user: { email: 'person@example.com', id: 'user-1' },
    })
    mockCloudSyncService.getCloudBackupInfo.mockResolvedValue({
      databaseSchemaVersion: 11,
      exportedAt: '2026-01-02T03:04:05.000Z',
      recordCount: 4,
      updatedAt: '2026-01-02T03:04:05.000Z',
    })
    renderSettings()

    expect(await screen.findByText('person@example.com')).toBeInTheDocument()
    expect(await screen.findByText(/4 records/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back up now' }))

    expect(mockCloudSyncService.backupToCloud).toHaveBeenCalled()
    expect(await screen.findByText('Cloud backup saved.')).toBeInTheDocument()
  })

  it('requires confirmation before restoring from cloud', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    authHookMocks.useAuth.mockReturnValue({
      signIn: authHookMocks.signIn,
      signOut: authHookMocks.signOut,
      status: 'signedIn',
      user: { email: 'person@example.com', id: 'user-1' },
    })
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Restore from cloud' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Restore cloud backup?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Restore from cloud' }),
    )

    expect(mockCloudSyncService.restoreFromCloud).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Confirmation'), 'RESTORE')
    await user.click(
      within(dialog).getByRole('button', { name: 'Restore from cloud' }),
    )

    await waitFor(() =>
      expect(mockCloudSyncService.restoreFromCloud).toHaveBeenCalled(),
    )
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it('previews validation errors for malformed restore files without changing data', async () => {
    const user = userEvent.setup()
    const food = await seedFood(db)
    renderSettings()

    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)
    await user.upload(
      fileInput as HTMLInputElement,
      new File(['{'], 'bad-backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByText('Import preview')).toBeInTheDocument()
    expect(screen.getByText(/not valid JSON/)).toBeInTheDocument()
    expect(await db.foods.get(food.id)).toMatchObject({ id: food.id })
  })

  it('requires strong confirmation before clearing local data', async () => {
    const user = userEvent.setup()
    await seedFood(db)
    await settingsRepository.saveUsdaApiKey('clear-secret-key', 'connected')
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Clear all data' }))
    const dialog = screen.getByRole('dialog', { name: 'Clear all data?' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete local data' }),
    )

    expect(await db.foods.count()).toBe(1)

    await user.type(within(dialog).getByLabelText('Confirmation'), 'DELETE')
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete local data' }),
    )

    await waitFor(async () => expect(await db.foods.count()).toBe(0))
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), {
      timeout: 10_000,
    })
    await expect(
      settingsRepository.getUsdaApiKeySettings(),
    ).resolves.toBeUndefined()
  })

  it('excludes USDA API keys from JSON backups and CSV exports', async () => {
    await settingsRepository.saveUsdaApiKey('backup-secret-key', 'connected')

    const json = await backupService.createJsonBackup()
    expect(json.json).not.toContain('backup-secret-key')
    expect(JSON.stringify(json.backup)).not.toContain('apiKeyIntegration')

    const csv = await backupService.createCsvArchive()
    expect(csv.files).not.toContain('apiKeyIntegrationSettings.csv')
  })
})
