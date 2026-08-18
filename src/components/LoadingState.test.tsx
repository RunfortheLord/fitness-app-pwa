import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LoadingState } from '@components/ui'

describe('LoadingState', () => {
  it('renders delayed page loading as stable card-shaped placeholders', () => {
    const { container } = render(
      <LoadingState delayMs={0} label="Loading workout" variant="cards" />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Loading workout')
    expect(container.querySelector('.loading-skeleton-toolbar')).not.toBeNull()
    expect(container.querySelectorAll('.loading-card')).toHaveLength(2)
    expect(container.querySelectorAll('.loading-list-row')).toHaveLength(2)
  })
})
