import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AccountDeletionPage, SupportPage } from '@pages/PublicInformationPages'

describe('public store information pages', () => {
  it('provides a direct account deletion pathway and local-data warning', () => {
    render(
      <MemoryRouter>
        <AccountDeletionPage />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('link', { name: 'Open account controls' }),
    ).toHaveAttribute('href', '/settings?section=data')
    expect(screen.getByText(/stored locally.*retained/is)).toBeVisible()
  })

  it('includes health disclaimers on the public support page', () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/not a medical device/i)).toBeVisible()
    expect(screen.getByText(/qualified healthcare professional/i)).toBeVisible()
    expect(screen.queryByText(/Settings → About → Send feedback/i)).toBeNull()
    expect(
      screen.getByRole('link', { name: 'adamshugart31@gmail.com' }),
    ).toHaveAttribute('href', 'mailto:adamshugart31@gmail.com')
  })
})
