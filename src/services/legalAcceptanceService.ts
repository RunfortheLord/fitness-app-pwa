import packageJson from '../../package.json'

export const TERMS_VERSION = '2026-08-20'
export const PRIVACY_VERSION = '2026-08-20'

const LEGAL_ACCEPTANCE_STORAGE_KEY = 'fitness-log.legal-acceptance.v1'

export type LegalAcceptance = {
  acceptedAt: string
  ageConfirmed: true
  appVersion: string
  privacyAcknowledged: true
  privacyVersion: string
  schemaVersion: 1
  termsAccepted: true
  termsVersion: string
  usResidencyConfirmed: true
}

export function readCurrentLegalAcceptance(): LegalAcceptance | null {
  const stored = window.localStorage.getItem(LEGAL_ACCEPTANCE_STORAGE_KEY)
  if (!stored) {
    return null
  }

  try {
    const value: unknown = JSON.parse(stored)
    return isCurrentLegalAcceptance(value) ? value : null
  } catch {
    return null
  }
}

export function saveCurrentLegalAcceptance(
  acceptedAt = new Date().toISOString(),
): LegalAcceptance {
  const acceptance: LegalAcceptance = {
    acceptedAt,
    ageConfirmed: true,
    appVersion: packageJson.version,
    privacyAcknowledged: true,
    privacyVersion: PRIVACY_VERSION,
    schemaVersion: 1,
    termsAccepted: true,
    termsVersion: TERMS_VERSION,
    usResidencyConfirmed: true,
  }
  window.localStorage.setItem(
    LEGAL_ACCEPTANCE_STORAGE_KEY,
    JSON.stringify(acceptance),
  )
  return acceptance
}

export function clearLegalAcceptance() {
  window.localStorage.removeItem(LEGAL_ACCEPTANCE_STORAGE_KEY)
}

function isCurrentLegalAcceptance(value: unknown): value is LegalAcceptance {
  if (!isRecord(value)) {
    return false
  }
  return (
    value.schemaVersion === 1 &&
    value.ageConfirmed === true &&
    value.usResidencyConfirmed === true &&
    value.termsAccepted === true &&
    value.privacyAcknowledged === true &&
    value.termsVersion === TERMS_VERSION &&
    value.privacyVersion === PRIVACY_VERSION &&
    typeof value.appVersion === 'string' &&
    typeof value.acceptedAt === 'string' &&
    Number.isFinite(Date.parse(value.acceptedAt))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
