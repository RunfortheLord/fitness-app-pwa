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
import { testUsdaApiKey } from '@services/foodProviderClient'
import { seedFood } from '@test/seedFactories'

vi.mock('@services/foodProviderClient', () => ({
  FoodProviderClientError: class FoodProviderClientError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.name = 'FoodProviderClientError'
      this.code = code
    }
  },
  testUsdaApiKey: vi.fn(),
}))

const mockTestUsdaApiKey = vi.mocked(testUsdaApiKey)

beforeEach(async () => {
  mockTestUsdaApiKey.mockReset()
  mockTestUsdaApiKey.mockResolvedValue({ status: 'connected' })
  await db.delete()
  await db.open()
  await initializeAppData()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

function renderSettings() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <App />,
        children: [{ path: 'settings', element: <SettingsPage /> }],
      },
    ],
    { initialEntries: ['/settings'] },
  )

  render(<RouterProvider router={router} />)
}

describe('SettingsPage', () => {
  it('shows settings metadata, local-only explanation, and data actions', async () => {
    renderSettings()

    expect(await screen.findByText('Pounds (lb)')).toBeInTheDocument()
    expect(screen.getByText('Application version')).toBeInTheDocument()
    expect(screen.getByText('Database schema version')).toBeInTheDocument()
    expect(screen.getByText('Backup format version')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Backups, restore files, and CSV exports stay on this device/,
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
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
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

    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(await db.foods.count()).toBe(0)
    await expect(
      settingsRepository.getUsdaApiKeySettings(),
    ).resolves.toBeUndefined()
  })

  it('saves, masks, replaces, tests, and removes a device-local USDA key', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.type(await screen.findByLabelText('USDA API key'), 'first-key')
    await user.click(screen.getByRole('button', { name: 'Save key' }))

    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Saved and masked')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('first-key')).not.toBeInTheDocument()
    expect(mockTestUsdaApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'first-key' }),
    )
    await expect(
      settingsRepository.getUsdaApiKeySettings(),
    ).resolves.toMatchObject({ apiKey: 'first-key', status: 'connected' })

    await user.click(screen.getByRole('button', { name: 'Test Connection' }))
    await waitFor(() => expect(mockTestUsdaApiKey).toHaveBeenCalledTimes(2))
    await waitFor(async () =>
      expect(await settingsRepository.getUsdaApiKeySettings()).toMatchObject({
        apiKey: 'first-key',
        status: 'connected',
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Replace Key' }))
    await user.type(screen.getByLabelText('USDA API key'), 'second-key')
    await user.click(screen.getByRole('button', { name: 'Save key' }))
    await waitFor(async () =>
      expect(await settingsRepository.getUsdaApiKeySettings()).toMatchObject({
        apiKey: 'second-key',
        status: 'connected',
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Remove Key' }))
    await waitFor(() =>
      expect(screen.getAllByText('Not configured')).toHaveLength(2),
    )
    expect(screen.getByRole('button', { name: 'Save key' })).toBeInTheDocument()
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
