import { expect, test } from './fixtures'

test('publishes legal, deletion, and support information without sign-in', async ({
  page,
}) => {
  await page.goto('/terms')
  await expect(
    page.getByRole('heading', { name: 'Vigorune Terms of Use' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '22. Contact' })).toBeVisible()

  await page.goto('/privacy')
  await expect(
    page.getByRole('heading', { name: 'Vigorune Privacy Policy' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '14. Contact' })).toBeVisible()

  await page.goto('/consumer-health-data-privacy')
  await expect(
    page.getByRole('heading', {
      name: 'Vigorune Consumer Health Data Privacy Policy',
    }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '11. Contact' })).toBeVisible()

  await page.goto('/account-deletion')
  await expect(
    page.getByRole('heading', { name: 'Delete your Vigorune account' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open account controls' }),
  ).toHaveAttribute('href', '/settings?section=data')

  await page.goto('/support')
  await expect(page.getByText(/not a medical device/i)).toBeVisible()
})

test('offers equivalent Google and Apple account choices in Settings', async ({
  page,
}) => {
  await page.goto('/settings?section=data')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign in with Apple' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign in with Google' }),
  ).toBeVisible()
})
