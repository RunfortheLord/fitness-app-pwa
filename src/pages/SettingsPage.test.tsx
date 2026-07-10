import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
import * as webPushTimerNotifications from '@services/webPushRestTimerNotificationService'
import { testGeminiApiKey } from '@services/geminiMealAnalysisClient'
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

vi.mock('@services/geminiMealAnalysisClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@services/geminiMealAnalysisClient')>()
  return {
    ...actual,
    testGeminiApiKey: vi.fn(),
  }
})

vi.mock('@hooks/useAuth', () => ({
  useAuth: authHookMocks.useAuth,
}))

vi.mock('@services/cloudSyncService', () => ({
  cloudSyncService: cloudSyncMocks,
}))

const mockCloudSyncService = vi.mocked(cloudSyncService)
const mockTestGeminiApiKey = vi.mocked(testGeminiApiKey)

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
  mockTestGeminiApiKey.mockReset()
  mockTestGeminiApiKey.mockResolvedValue()
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  cleanup()
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
    const user = userEvent.setup()
    renderSettings('/settings?section=whats-new')

    expect(
      await screen.findByRole('heading', { name: "What's new" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Back to settings' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getByText('Faster, smarter food logging')
        .closest('.subpage-enter'),
    ).not.toBeNull()
    expect(screen.getByText('Faster, smarter food logging')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to settings' }))

    expect(
      await screen.findByRole('heading', { name: 'Preferences' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Back to settings' }),
    ).not.toBeInTheDocument()
  })

  it('shows settings metadata, local-only explanation, and data actions', async () => {
    const user = userEvent.setup()
    renderSettings()

    expect(await screen.findByText('Pounds (lb)')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Settings sections' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('Sound selection')).toBeInTheDocument()
    expect(
      screen.getByText(
        'In-app timer sounds briefly mix with other audio. Outside-app alerts use the iPhone notification sound.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByText('Application version')).toBeInTheDocument()
    expect(screen.getByText('Database schema version')).toBeInTheDocument()
    expect(screen.getByText('Backup format version')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Data' }))
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
    expect(screen.getByText('Device storage')).toBeInTheDocument()
    expect(
      screen.getByText('Persistent storage not supported'),
    ).toBeInTheDocument()
    expect(screen.getByText('Cloud backup')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Not signed in')).toBeInTheDocument()
    expect(screen.queryByText('Nutrition targets')).not.toBeInTheDocument()
    expect(screen.queryByText(/USDA FoodData Central/)).not.toBeInTheDocument()
  })

  it('saves and tests a device-local Gemini key', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Integrations' }),
    )
    await user.type(
      await screen.findByLabelText('Gemini API key'),
      'gemini-device-key',
    )
    await user.click(screen.getByRole('button', { name: 'Save and test' }))

    await waitFor(() =>
      expect(mockTestGeminiApiKey).toHaveBeenCalledWith({
        apiKey: 'gemini-device-key',
      }),
    )
    await expect(
      settingsRepository.getGeminiApiKeySettings(),
    ).resolves.toMatchObject({
      apiKey: 'gemini-device-key',
      status: 'connected',
    })
    expect(
      await screen.findByText('Gemini 3.5 Flash is connected.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Gemini API key')).toHaveValue('')
  })

  it('uses the default iPhone alert instead of bundled sounds for Web Push', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      nativeTimerNotifications,
      'supportsNativeRestTimerNotifications',
    ).mockReturnValue(false)
    vi.spyOn(
      webPushTimerNotifications,
      'supportsWebPushRestTimerNotifications',
    ).mockReturnValue(true)
    vi.spyOn(webPushTimerNotifications, 'isInstalledWebApp').mockReturnValue(
      true,
    )

    renderSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    expect(await screen.findByText('Timer alert sound')).toBeInTheDocument()
    expect(screen.getByLabelText('Timer notification banners')).toBeChecked()
    expect(
      screen.getByText(
        'Default iPhone notification sound. Its volume and playback behavior are controlled by iPhone notification settings.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Sound selection')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Preview' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Test iPhone alert' }),
    ).toBeInTheDocument()
  })

  it('uses the default iPhone alert instead of bundled sounds for native iOS', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      nativeTimerNotifications,
      'supportsNativeRestTimerNotifications',
    ).mockReturnValue(true)

    renderSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    expect(await screen.findByText('Timer alert sound')).toBeInTheDocument()
    expect(screen.getByLabelText('Timer notification banners')).toBeChecked()
    expect(screen.queryByText('Sound selection')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Test iPhone alert' }),
    ).toBeInTheDocument()
  })

  it('explains iPhone audio controls when a preview cannot play', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new DOMException('Playback was blocked', 'NotAllowedError'),
    )
    renderSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Preview' }))

    expect(
      await screen.findByText(
        'Timer sound could not play. Raise media volume, check the selected audio output, and try again.',
      ),
    ).toBeInTheDocument()
  })

  it('tests the native iPhone alert from settings', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      nativeTimerNotifications,
      'supportsNativeRestTimerNotifications',
    ).mockReturnValue(true)
    const preview = vi
      .spyOn(
        nativeTimerNotifications.nativeRestTimerNotificationService,
        'preview',
      )
      .mockResolvedValue('scheduled')

    renderSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Test iPhone alert' }),
    )

    expect(preview).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(
        'Timer alert test sent. If you did not hear it, check iPhone notification sound settings for this app.',
      ),
    ).toBeInTheDocument()
  })

  it('turns off timer notification banners and cancels pending outside-app alerts', async () => {
    const user = userEvent.setup()
    vi.spyOn(
      nativeTimerNotifications,
      'supportsNativeRestTimerNotifications',
    ).mockReturnValue(true)
    const cancelNative = vi
      .spyOn(
        nativeTimerNotifications.nativeRestTimerNotificationService,
        'cancel',
      )
      .mockResolvedValue('canceled')
    const cancelWebPush = vi
      .spyOn(
        webPushTimerNotifications.webPushRestTimerNotificationService,
        'cancel',
      )
      .mockResolvedValue('canceled')

    renderSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    await user.click(await screen.findByLabelText('Timer notification banners'))

    await waitFor(async () => {
      expect(
        (await settingsRepository.getSettings())?.timerBannersEnabled,
      ).toBe(false)
    })
    expect(cancelNative).toHaveBeenCalledTimes(1)
    expect(cancelWebPush).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Test iPhone alert' }),
    ).toBeDisabled()
    expect(await screen.findByText('Timer settings saved.')).toBeInTheDocument()
  })

  it('shows outside-app timer alerts as a default-on switch in the native iOS wrapper', async () => {
    vi.spyOn(
      nativeTimerNotifications,
      'supportsNativeRestTimerNotifications',
    ).mockReturnValue(true)
    renderSettings()

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Notifications' }))
    expect(
      await screen.findByRole('switch', {
        name: 'Enable outside-app timer alerts',
      }),
    ).toBeChecked()
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
    expect(
      screen.getByRole('heading', { name: 'Preferencias' }),
    ).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: 'About' }))
    expect(
      await screen.findByRole('heading', {
        name: 'RIR your way and simpler program editing',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Pounds or kilograms')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show all' }))

    expect(
      screen.getByRole('button', { name: 'Back to settings' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Live workout polish and check-off weeks',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Timer is finally fixed!' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Run tracking upgrades' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Optional AI meal camera' }),
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

    await user.click(await screen.findByRole('button', { name: 'Data' }))
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

    await user.click(await screen.findByRole('button', { name: 'Data' }))
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

    await user.click(await screen.findByRole('button', { name: 'Data' }))
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
    await settingsRepository.saveGeminiApiKey(
      'clear-gemini-secret-key',
      'connected',
    )
    renderSettings()

    await user.click(await screen.findByRole('button', { name: 'Data' }))
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
    await expect(
      settingsRepository.getGeminiApiKeySettings(),
    ).resolves.toBeUndefined()
  })

  it('excludes integration API keys from JSON backups and CSV exports', async () => {
    await settingsRepository.saveUsdaApiKey('backup-secret-key', 'connected')
    await settingsRepository.saveGeminiApiKey(
      'gemini-backup-secret',
      'connected',
    )

    const json = await backupService.createJsonBackup()
    expect(json.json).not.toContain('backup-secret-key')
    expect(json.json).not.toContain('gemini-backup-secret')
    expect(JSON.stringify(json.backup)).not.toContain('apiKeyIntegration')

    const csv = await backupService.createCsvArchive()
    expect(csv.files).not.toContain('apiKeyIntegrationSettings.csv')
  })
})
