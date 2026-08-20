import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { LegalAcceptanceGate } from '@app/LegalAcceptanceGate'
import { readCurrentLegalAcceptance } from '@services/legalAcceptanceService'

describe('LegalAcceptanceGate', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('requires separate age, Terms, and privacy acknowledgements', async () => {
    const user = userEvent.setup()
    render(
      <LegalAcceptanceGate>
        <p>Core app</p>
      </LegalAcceptanceGate>,
    )

    expect(screen.queryByText('Core app')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute(
      'target',
      '_blank',
    )
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }),
    ).toHaveAttribute('target', '_blank')
    const continueButton = screen.getByRole('button', {
      name: 'Continue to Vigorune',
    })
    expect(continueButton).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', {
        name: 'I confirm that I am at least 18 and live in the U.S.',
      }),
    )
    await user.click(
      screen.getByRole('checkbox', { name: /I agree to the Terms of Use/ }),
    )
    await user.click(
      screen.getByRole('checkbox', {
        name: /I acknowledge the Privacy Policy/,
      }),
    )
    expect(continueButton).toBeEnabled()

    await user.click(continueButton)

    expect(screen.getByText('Core app')).toBeInTheDocument()
    expect(readCurrentLegalAcceptance()).toMatchObject({
      ageConfirmed: true,
      privacyAcknowledged: true,
      termsAccepted: true,
      usResidencyConfirmed: true,
    })
  })
})
