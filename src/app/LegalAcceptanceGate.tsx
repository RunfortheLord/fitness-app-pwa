import { useState, type ReactNode } from 'react'

import {
  PRIVACY_VERSION,
  readCurrentLegalAcceptance,
  saveCurrentLegalAcceptance,
  TERMS_VERSION,
} from '@services/legalAcceptanceService'

export function LegalAcceptanceGate({ children }: { children: ReactNode }) {
  const [isAccepted, setIsAccepted] = useState(
    () => readCurrentLegalAcceptance() !== null,
  )
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)

  if (isAccepted) {
    return children
  }

  const canContinue =
    ageConfirmed && termsAccepted && privacyAcknowledged && !storageError

  function acceptAndContinue() {
    if (!canContinue) {
      return
    }
    try {
      saveCurrentLegalAcceptance()
      setIsAccepted(true)
    } catch {
      setStorageError(
        'Vigorune could not save your acknowledgement on this device. Check that app storage is available, then try again.',
      )
    }
  }

  return (
    <main aria-labelledby="legal-welcome-title" className="legal-gate-page">
      <section className="legal-gate-card">
        <p className="eyebrow">Vigorune</p>
        <h1 id="legal-welcome-title">Before you begin</h1>
        <p>
          Vigorune is a U.S.-only fitness logging tool for adults. You do not
          need an account to use its core features.
        </p>

        <div className="legal-gate-checks">
          <label className="checkbox-row">
            <input
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>I confirm that I am at least 18 and live in the U.S.</span>
          </label>
          <label className="checkbox-row">
            <input
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              type="checkbox"
            />
            <span>
              I agree to the{' '}
              <a href="/terms" rel="noreferrer" target="_blank">
                Terms of Use
              </a>{' '}
              (version {TERMS_VERSION}).
            </span>
          </label>
          <label className="checkbox-row">
            <input
              checked={privacyAcknowledged}
              onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
              type="checkbox"
            />
            <span>
              I acknowledge the{' '}
              <a href="/privacy" rel="noreferrer" target="_blank">
                Privacy Policy
              </a>{' '}
              (version {PRIVACY_VERSION}).
            </span>
          </label>
        </div>

        <p className="muted legal-gate-note">
          Your acknowledgement is saved only on this device. Vigorune does not
          ask for your birth date.
        </p>
        {storageError ? (
          <p className="validation-message" role="alert">
            {storageError}
          </p>
        ) : null}
        <button
          className="button button-primary legal-gate-continue"
          disabled={!canContinue}
          onClick={acceptAndContinue}
          type="button"
        >
          Continue to Vigorune
        </button>
      </section>
    </main>
  )
}
