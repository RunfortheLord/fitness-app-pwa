import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import {
  ConsumerHealthDataPrivacyPolicyPage,
  PrivacyPolicyPage,
  TermsOfUsePage,
} from '@pages/LegalDocumentPages'

function renderPage(page: ReactNode) {
  render(<MemoryRouter>{page}</MemoryRouter>)
}

describe('publication-form legal documents', () => {
  it('renders the complete Terms of Use from the canonical document', () => {
    renderPage(<TermsOfUsePage />)

    expect(
      screen.getByRole('heading', { name: 'Vigorune Terms of Use' }),
    ).toBeVisible()
    expect(screen.getByText('Effective date: August 20, 2026')).toBeVisible()
    expect(screen.getByRole('heading', { name: '22. Contact' })).toBeVisible()
    expect(
      screen.getByRole('link', {
        name: 'Standard Licensed Application End User License Agreement',
      }),
    ).toHaveAttribute(
      'href',
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    )
  })

  it('renders the complete general Privacy Policy with internal policy links', () => {
    renderPage(<PrivacyPolicyPage />)

    expect(
      screen.getByRole('heading', { name: 'Vigorune Privacy Policy' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: '14. Contact' })).toBeVisible()
    expect(
      screen.getAllByRole('link', {
        name: 'Consumer Health Data Privacy Policy',
      })[0],
    ).toHaveAttribute('href', '/consumer-health-data-privacy')
  })

  it('renders the complete consumer health policy including both disclosure tables', () => {
    renderPage(<ConsumerHealthDataPrivacyPolicyPage />)

    expect(
      screen.getByRole('heading', {
        name: 'Vigorune Consumer Health Data Privacy Policy',
      }),
    ).toBeVisible()
    expect(screen.getAllByRole('table')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: '11. Contact' })).toBeVisible()
  })

  it('links every public document to the other legal and support pages', () => {
    renderPage(<TermsOfUsePage />)

    const navigation = screen.getByRole('navigation', {
      name: 'Legal and support',
    })
    expect(
      within(navigation).getByRole('link', { name: 'Privacy' }),
    ).toHaveAttribute('href', '/privacy')
    expect(
      within(navigation).getByRole('link', { name: 'Health data privacy' }),
    ).toHaveAttribute('href', '/consumer-health-data-privacy')
    expect(
      within(navigation).getByRole('link', { name: 'Support' }),
    ).toHaveAttribute('href', '/support')
  })
})
