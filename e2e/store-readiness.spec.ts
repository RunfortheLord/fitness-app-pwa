import { expect, test } from '@playwright/test'

test('publishes privacy, deletion, and support information without sign-in', async ({
  page,
}) => {
  await page.goto('/privacy')
  await expect(
    page.getByRole('heading', { name: 'Privacy Policy' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Supabase processes your identity/i),
  ).toBeVisible()

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
