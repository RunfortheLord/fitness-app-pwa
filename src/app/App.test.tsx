import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { App } from '@app/App'
import { HomePage } from '@pages/HomePage'

describe('App', () => {
  it('renders the mobile shell and home route', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ index: true, element: <HomePage /> }],
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument()
    const navigation = screen.getByRole('navigation', { name: 'Primary' })
    expect(navigation).toHaveTextContent('Home')
    expect(navigation).toHaveTextContent('Nutrition')
    expect(navigation).toHaveTextContent('Training')
    expect(navigation).toHaveTextContent('Run')
    expect(navigation).not.toHaveTextContent('History')
    expect(
      screen
        .getAllByRole('link')
        .filter((link) => link.closest('nav[aria-label="Primary"]')),
    ).toHaveLength(4)
    expect(
      screen.getByRole('button', { name: 'Open quick actions' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Loading dashboard')).toBeInTheDocument()
  })
})
