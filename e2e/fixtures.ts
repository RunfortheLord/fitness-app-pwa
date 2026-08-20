import { test as base, expect } from '@playwright/test'

const legalAcceptance = {
  acceptedAt: '2026-08-20T18:30:00.000Z',
  ageConfirmed: true,
  appVersion: '1.0.0',
  privacyAcknowledged: true,
  privacyVersion: '2026-08-20',
  schemaVersion: 1,
  termsAccepted: true,
  termsVersion: '2026-08-20',
  usResidencyConfirmed: true,
}

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await page.addInitScript((acceptance) => {
      window.localStorage.setItem(
        'fitness-log.legal-acceptance.v1',
        JSON.stringify(acceptance),
      )
    }, legalAcceptance)
    await runPage(page)
  },
})

export { expect }
