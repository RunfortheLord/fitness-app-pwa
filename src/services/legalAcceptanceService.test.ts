import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearLegalAcceptance,
  PRIVACY_VERSION,
  readCurrentLegalAcceptance,
  saveCurrentLegalAcceptance,
  TERMS_VERSION,
} from '@services/legalAcceptanceService'

describe('legalAcceptanceService', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stores a versioned local acknowledgement record', () => {
    const acceptedAt = '2026-08-20T18:30:00.000Z'

    expect(saveCurrentLegalAcceptance(acceptedAt)).toMatchObject({
      acceptedAt,
      ageConfirmed: true,
      privacyAcknowledged: true,
      privacyVersion: PRIVACY_VERSION,
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      usResidencyConfirmed: true,
    })
    expect(readCurrentLegalAcceptance()).toMatchObject({ acceptedAt })
  })

  it('requires acknowledgement again when a stored policy version is stale', () => {
    window.localStorage.setItem(
      'fitness-log.legal-acceptance.v1',
      JSON.stringify({
        acceptedAt: '2026-08-20T18:30:00.000Z',
        ageConfirmed: true,
        appVersion: '1.0.0',
        privacyAcknowledged: true,
        privacyVersion: '2026-08-19',
        schemaVersion: 1,
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
        usResidencyConfirmed: true,
      }),
    )

    expect(readCurrentLegalAcceptance()).toBeNull()
  })

  it('treats malformed local storage as no acknowledgement', () => {
    window.localStorage.setItem('fitness-log.legal-acceptance.v1', '{invalid')

    expect(readCurrentLegalAcceptance()).toBeNull()
  })

  it('removes the local acknowledgement record', () => {
    saveCurrentLegalAcceptance('2026-08-20T18:30:00.000Z')

    clearLegalAcceptance()

    expect(readCurrentLegalAcceptance()).toBeNull()
  })
})
