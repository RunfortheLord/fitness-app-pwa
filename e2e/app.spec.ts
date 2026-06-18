import { expect, test } from '@playwright/test'

test('loads the app shell', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Training Log/)
  await expect(
    page.getByRole('heading', { name: 'Training Log' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})
