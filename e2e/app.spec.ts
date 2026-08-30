import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'

const routes = [
  { path: '/', title: 'Home', nav: 'Home' },
  { path: '/nutrition', title: 'Nutrition', nav: 'Nutrition' },
  { path: '/training', title: 'Current Program', nav: 'Training' },
  { path: '/run', title: 'Run', nav: 'Cardio' },
  { path: '/calories', title: 'Calories' },
  { path: '/history', title: 'History' },
  { path: '/settings', title: 'Settings' },
]

test(
  'requires first-run adult eligibility and legal acknowledgement',
  { tag: '@smoke' },
  async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 },
    })
    const page = await context.newPage()

    try {
      await page.goto('/')

      await expect(
        page.getByRole('heading', { name: 'Before you begin' }),
      ).toBeVisible({ timeout: 30_000 })
      await expect(
        page.getByRole('navigation', { name: 'Primary' }),
      ).toHaveCount(0)
      const continueButton = page.getByRole('button', {
        name: 'Continue to Vigorune',
      })
      await expect(continueButton).toBeDisabled()

      await page
        .getByRole('checkbox', {
          name: 'I confirm that I am at least 18 and live in the U.S.',
        })
        .check()
      await page
        .getByRole('checkbox', { name: /I agree to the Terms of Use/ })
        .check()
      await page
        .getByRole('checkbox', {
          name: /I acknowledge the Privacy Policy/,
        })
        .check()
      await continueButton.click()

      await expect(
        page.getByRole('heading', { level: 1, name: 'Home' }),
      ).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.localStorage.getItem('fitness-log.legal-acceptance.v1'),
          ),
        )
        .not.toBeNull()
    } finally {
      await context.close()
    }
  },
)

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
]) {
  test.describe(`${viewport.width} by ${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true })

    for (const route of routes) {
      test(
        `renders ${route.title} without horizontal overflow`,
        {
          tag:
            viewport.width === 390 && viewport.height === 844
              ? '@smoke'
              : '@full',
        },
        async ({ page }) => {
          await page.goto(route.path)

          await expect(page).toHaveTitle(/Vigorune/)
          await expect(
            page.getByRole('heading', { level: 1, name: route.title }),
          ).toBeVisible()
          await expect(
            page.getByRole('navigation', { name: 'Primary' }),
          ).toBeVisible()

          if (route.nav) {
            await expect(
              page.getByRole('link', { name: route.nav }),
            ).toHaveAttribute('aria-current', 'page')
          }

          const horizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          )
          expect(horizontalOverflow).toBe(false)
        },
      )
    }
  })
}

test(
  'warms lazy routes behind the cold-launch screen',
  { tag: '@smoke' },
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-webkit',
      'The viewport-independent preload audit runs in both Chromium profiles; parallel WebKit can intentionally hit the launch fail-open while the full local cache is warming.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const launchScreen = page.getByRole('main', {
      name: 'Loading Vigorune',
    })
    await expect(launchScreen).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Vigorune' }),
    ).toBeVisible()
    await expect(launchScreen).not.toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('heading', { level: 1, name: 'Home' }),
    ).toBeVisible()

    await page.evaluate(() => {
      const state = window as typeof window & {
        __pageLoadingEvents?: string[]
      }
      state.__pageLoadingEvents = []
      const observer = new MutationObserver(() => {
        const loadingElements = document.querySelectorAll(
          '.loading-page-skeleton, .loading-state:not(.loading-state-pending)',
        )
        for (const element of loadingElements) {
          const event = `${window.location.pathname}:${element.className}:${element.textContent?.trim() ?? ''}`
          if (!state.__pageLoadingEvents?.includes(event)) {
            state.__pageLoadingEvents?.push(event)
          }
        }
      })
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true,
      })
    })

    await page.getByRole('link', { name: 'Nutrition' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nutrition' }),
    ).toBeVisible()
    await expect(page.getByText('Daily nutrition totals')).toBeVisible()

    await page.getByRole('link', { name: 'Training' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Current Program' }),
    ).toBeVisible()
    await expect(page.getByText('Program library')).toBeVisible()

    await page.getByRole('link', { name: 'Cardio' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Run' }),
    ).toBeVisible()
    await expect(page.getByText('Choose a run')).toBeVisible()

    await page.getByRole('link', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'View all history' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'History' }),
    ).toBeVisible()
    await expect(page.getByText('No completed activity')).toBeVisible()

    await page.getByRole('link', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'View more' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Calories' }),
    ).toBeVisible()
    await expect(page.getByText('Calorie summary')).toBeVisible()

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible()

    // The app main is the scroll container (the document itself never scrolls),
    // so scroll it to the bottom and confirm navigating Home resets it to the top.
    await page.evaluate(() => {
      const main = document.querySelector('.app-main')!
      main.scrollTop = main.scrollHeight
    })
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('.app-main')!.scrollTop),
      )
      .toBeGreaterThan(0)
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Home' }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('.app-main')!.scrollTop),
      )
      .toBe(0)
    await expect(page.getByLabel('Selected date')).toBeInViewport()

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __pageLoadingEvents?: string[] })
              .__pageLoadingEvents,
        ),
      )
      .toEqual([])
  },
)

test('returns Home to the top after navigating from a scrolled route @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings?section=about')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText('Application version')).toBeVisible()

  // The app main is the scroll container (the document itself never scrolls),
  // so scroll it to the bottom and confirm navigating Home resets it to the top.
  await page.evaluate(() => {
    const main = document.querySelector('.app-main')!
    main.scrollTop = main.scrollHeight
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('.app-main')!.scrollTop),
    )
    .toBeGreaterThan(0)

  await page.getByRole('link', { name: 'Home' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Home' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('.app-main')!.scrollTop),
    )
    .toBe(0)
  await expect(page.getByLabel('Selected date')).toBeInViewport()
})

test('prompts signed-out users to enable automatic cloud backup on launch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const prompt = page.getByRole('complementary', {
    name: 'Your data stays local',
  })
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText(
    'Start offline with no account, or sign in with Apple or Google',
  )
  await prompt.getByRole('button', { name: 'Continue offline' }).click()
  await expect(prompt).not.toBeVisible()
})

test('supports skipping navigation and focuses content after route changes', async ({
  browserName,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const skipLink = page.getByRole('link', { name: 'Skip to content' })
  await expect(skipLink).toBeAttached()
  if (browserName !== 'webkit') {
    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()
  }

  await dismissSignInPrompt(page)
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Nutrition' })
    .click()
  await expect(page.getByRole('main', { name: 'Nutrition' })).toBeFocused()
})

test('opens the quick action bottom sheet from the center add button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  const sheet = page.getByRole('dialog', { name: 'Quick actions' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Log food/ })).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /Create exercise/ }),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /Create program/ }),
  ).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /Start or resume run/ }),
  ).toHaveCount(0)
  await expect(
    sheet.getByRole('button', { name: /Start or resume workout/ }),
  ).toHaveCount(0)
})

test('bottom navigation has exactly five controls and no History tab', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Nutrition' })).toBeVisible()
  await expect(
    nav.getByRole('button', { name: 'Open quick actions' }),
  ).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Training' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Cardio' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'History' })).toHaveCount(0)
  await expect(nav.locator('a,button')).toHaveCount(5)
  await expect
    .poll(async () =>
      Promise.all(
        [
          nav.getByRole('link', { name: 'Home' }),
          nav.getByRole('link', { name: 'Nutrition' }),
          nav.getByRole('button', { name: 'Open quick actions' }),
        ].map((control) =>
          control.evaluate((element) => {
            const style = getComputedStyle(element)
            return (
              style.getPropertyValue('user-select') ||
              style.getPropertyValue('-webkit-user-select')
            )
          }),
        ),
      ),
    )
    .toEqual(['none', 'none', 'none'])

  const beforeScroll = await nav.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      transform: getComputedStyle(element).transform,
      viewportHeight: window.innerHeight,
    }
  })
  expect(beforeScroll.transform).toBe('none')
  expect(
    Math.abs(beforeScroll.bottom - beforeScroll.viewportHeight),
  ).toBeLessThan(1)

  // Scrolling the content region (the app main) must not move the in-flow nav.
  await page.evaluate(() => {
    const main = document.querySelector('.app-main')!
    main.scrollTop = main.scrollHeight
  })
  const afterScroll = await nav.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { bottom: rect.bottom, viewportHeight: window.innerHeight }
  })
  expect(
    Math.abs(afterScroll.bottom - afterScroll.viewportHeight),
  ).toBeLessThan(1)
})

test('hides the bottom navigation while a software keyboard is open without remounting it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  const nav = page.getByRole('navigation', { name: 'Primary' })
  // CSS locator so the "same element" assertions still resolve while the nav is
  // display:none (and therefore absent from the accessibility tree).
  const navElement = page.locator('nav.bottom-nav')
  await expect(nav).toBeVisible()
  await navElement.evaluate((element) => {
    element.setAttribute('data-navigation-instance', 'stable')
  })

  // Focusing a text field opens the keyboard. The nav hides while it is open so
  // it cannot sit over the keyboard, but the same nav element stays in the DOM
  // (it is never remounted, so it cannot be lost after the keyboard closes).
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'number'
    input.setAttribute('aria-label', 'Keyboard viewport test')
    input.style.cssText =
      'position:fixed;top:120px;left:20px;width:200px;height:44px;z-index:60'
    document.body.append(input)
  })
  const keyboardField = page.getByLabel('Keyboard viewport test')
  await keyboardField.click()

  await expect(nav).toBeHidden()
  await expect(navElement).toHaveAttribute('data-navigation-instance', 'stable')

  // Blurring restores the same nav, freshly positioned at the bottom.
  await keyboardField.blur()
  await page.evaluate(() => {
    document.querySelector('[aria-label="Keyboard viewport test"]')?.remove()
  })

  await expect(nav).toBeVisible()
  await expect(navElement).toHaveAttribute('data-navigation-instance', 'stable')
})

test('sets a weight goal through the recommended-rate step', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/nutrition')

  await page.getByRole('button', { name: 'Targets' }).click()
  await page.getByRole('button', { name: 'Set Goal' }).click()
  await page
    .getByRole('button', { name: 'Calculate my maintenance calories' })
    .click()
  await page.getByLabel('Current body weight (lb)').fill('180')
  await page.getByLabel('Height (feet)').fill('5')
  await page.getByLabel('Height (inches)').fill('10')
  await page
    .getByLabel('How active are you outside of exercise?')
    .selectOption('heavily_active')
  await page.getByLabel('Goal weight (lb)').fill('170')
  await page.getByLabel('Age').fill('30')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(
    page.getByRole('heading', { name: 'Goal Type: Cutting' }),
  ).toBeVisible()
  await expect(page.getByText('Recommended')).toBeVisible()
  await expect(
    page.getByRole('slider', { name: 'Weekly loss rate' }),
  ).toHaveValue('0.5')
  await expect(page.getByText(/0.9 lb\/week \(0.50%\)/)).toBeVisible()

  await page.getByRole('button', { name: 'Done' }).click()
  await expect(
    page.getByText('Macros calculated and targets saved.'),
  ).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole('button', { name: 'Update Calories' }),
  ).toBeVisible()
})

test('quick action sheet traps focus and closes with Escape', async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName === 'webkit',
    'Mobile WebKit does not reliably synthesize hardware Tab and Escape keyboard navigation.',
  )
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  const sheet = page.getByRole('dialog', { name: 'Quick actions' })
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: 'Close quick actions' }),
  ).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(sheet.getByRole('button', { name: /Log food/ })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(sheet).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open quick actions' }),
  ).toBeFocused()
})

test('creates and persists a custom exercise from the Add sheet', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-webkit',
    'Covered in Chromium; WebKit IndexedDB teardown blocks while the expanded exercise seed is installing.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page.getByRole('button', { name: /Create exercise/ }).click()
  await expect(page).toHaveURL(/\/training/)
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Bench press')
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'E2E Bench press',
  )
  await fillRestInputs(page, '150')
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'E2E Bench press',
  )
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'E2E Bench press',
  )
  await expect(page.getByRole('textbox', { name: 'Rest minutes' })).toHaveValue(
    '2',
  )
  await expect(page.getByRole('textbox', { name: 'Rest seconds' })).toHaveValue(
    '30',
  )
  await expect(page.getByText(/external weight and repetitions/)).toBeVisible()
  await page.getByRole('button', { name: 'Save exercise' }).click()

  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 })
  await waitForExerciseLibrary(page)
  await expect(page.getByText('E2E Bench press')).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Weight \+ reps - 150s rest/)).toBeVisible()

  await page.reload()
  await waitForExerciseLibrary(page)
  await expect(page.getByText('E2E Bench press')).toBeVisible()
})

test('creates, activates, starts the next day, and persists a program cycle', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-webkit',
    'Covered in Chromium; WebKit IndexedDB teardown blocks while the expanded exercise seed is installing.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/training')
  await waitForExerciseLibrary(page)

  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Squat')
  await fillRestInputs(page, '180')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText('E2E Squat')).toBeVisible({ timeout: 15_000 })

  await page
    .getByLabel('Current Program')
    .getByRole('button', { name: 'Create program' })
    .click()
  await page.getByRole('textbox', { name: 'Name' }).fill('E2E Strength')
  await page.getByRole('button', { name: 'Save program' }).click()
  const builder = page.getByRole('dialog', { name: 'Edit template' })
  await expect(builder).toBeVisible()
  await addWorkoutDay(builder, 'Day A')
  await expect(builder.getByText('Day A')).toBeVisible()
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await addPrescription(builder, 'E2E Squat')
  await expect(builder.getByText('E2E Squat')).toBeVisible()
  await expect(
    builder.getByRole('spinbutton', { name: 'Current week' }),
  ).toHaveCount(0)
  await expect(
    builder.getByRole('group', { name: 'Schedule deload weeks' }),
  ).toHaveCount(0)
  await builder.getByRole('button', { name: 'Program editor settings' }).click()
  const programSettings = page.getByRole('dialog', {
    name: 'Program settings',
  })
  await programSettings
    .getByRole('checkbox', { name: 'Schedule deload weeks' })
    .check()
  await expect(programSettings).not.toBeVisible()
  await expect(
    builder.getByRole('button', { name: 'Deload 1' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await builder.getByRole('button', { name: 'Deload 1' }).click()
  await builder.getByRole('button', { name: 'Week 2' }).click()
  await expect(
    builder.getByRole('button', { name: 'Deload 1' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await closeBuilder(builder)

  await page.getByRole('button', { name: 'Activate E2E Strength' }).click()
  await page
    .getByRole('dialog', { name: 'Activate program?' })
    .getByRole('button', { name: 'Activate' })
    .click()
  await expect(page.getByText('Program activated.')).toBeVisible()
  const weekSelector = page.getByRole('combobox', {
    name: 'Select program week',
  })
  await expect(
    weekSelector.getByRole('option', { name: 'Deload 1' }),
  ).toHaveCount(1)
  await page.getByRole('button', { name: 'Mark Day A done this week' }).click()
  await expect(weekSelector).toHaveValue('2')
  await weekSelector.selectOption('1')
  await expect(
    page.getByRole('button', { name: 'Mark Day A not done this week' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('button', { name: 'Start Day A' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Day A' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Discard' }).click()
  const discardConfirmation = page
    .getByRole('dialog', { name: 'Discard workout?' })
    .getByRole('button', { name: 'Discard Workout' })
  await discardConfirmation.evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })
  await expect(page).toHaveURL(/\/training/)
  await expect(page.getByText(/Active workout .* was not found/)).toHaveCount(0)

  await page.reload()
  await expect(
    page.getByLabel('Current Program').getByText('E2E Strength'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Day A/ })).toBeVisible()
})

test(
  'starts, resumes, edits, and cancels a live workout',
  {
    tag: '@smoke',
  },
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-webkit',
      'Covered in Chromium; WebKit IndexedDB teardown blocks while the expanded exercise seed is installing.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/training')
    await waitForExerciseLibrary(page)
    const dashboardNavBottomGaps = await page
      .locator('.bottom-nav')
      .evaluate((element) => {
        const navBottom = element.getBoundingClientRect().bottom
        const visualViewportBottom = window.visualViewport
          ? window.visualViewport.offsetTop + window.visualViewport.height
          : window.innerHeight
        return {
          layout: window.innerHeight - navBottom,
          visual: visualViewportBottom - navBottom,
        }
      })

    await page.getByLabel('Create exercise').click()
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Live press')
    await fillRestInputs(page, '45')
    await page.getByLabel('Tracking preset').selectOption('weight_reps')
    await page.getByRole('button', { name: 'Save exercise' }).click()
    await expect(page.getByText('E2E Live press')).toBeVisible({
      timeout: 15_000,
    })

    await page
      .getByLabel('Current Program')
      .getByRole('button', { name: 'Create program' })
      .click()
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Live program')
    await page.getByRole('button', { name: 'Save program' }).click()
    const builder = page.getByRole('dialog', { name: 'Edit template' })
    await addWorkoutDay(builder, 'Live A')
    await builder.getByRole('button', { name: 'Add exercise' }).click()
    await addPrescription(builder, 'E2E Live press', '2')
    await closeBuilder(builder)

    await page
      .getByRole('button', { name: 'Activate E2E Live program' })
      .click()
    await page
      .getByRole('dialog', { name: 'Activate program?' })
      .getByRole('button', { name: 'Activate' })
      .click()
    await page.getByRole('button', { name: /^Live A/ }).click()
    await page
      .getByRole('dialog', { name: 'Live A' })
      .getByRole('button', { name: 'Start Workout' })
      .click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Live A' }),
    ).toBeVisible()
    const exerciseWorkspace = page.locator('.exercise-workspace')
    await expect(exerciseWorkspace).toBeVisible()
    await expect(exerciseWorkspace).not.toHaveClass(/\bcard\b/)
    await expect(
      exerciseWorkspace.locator('.exercise-prescription-inline'),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'More exercise actions' }).click()
    const exerciseOptions = page.getByRole('dialog', {
      name: 'Exercise options',
    })
    await expect(exerciseOptions).toHaveClass(/bottom-sheet--page/)
    await expect(exerciseOptions.getByText('2 sets - 5-10 reps')).toBeVisible()
    await expect(exerciseOptions.getByText('Total workout time')).toBeVisible()
    await expect(
      exerciseOptions.getByText(
        'Changes apply immediately to the current rest timer and future sets.',
      ),
    ).toBeVisible()
    await expect(
      exerciseOptions.getByRole('button', { name: 'Cancel' }),
    ).toHaveCount(0)
    await expect(
      exerciseOptions.getByRole('button', { name: 'Save', exact: true }),
    ).toHaveCount(0)
    await exerciseOptions
      .getByRole('listbox', { name: 'Rest minutes' })
      .getByRole('option', { name: '01' })
      .click()
    await exerciseOptions
      .getByRole('listbox', { name: 'Rest seconds' })
      .getByRole('option', { name: '30' })
      .click()
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('exercise-options-timer-390.png'),
    })
    expect(
      await exerciseOptions.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
    ).toBe(true)
    const addSetControl = page.getByRole('button', { name: 'Add Set' })
    expect(await addSetControl.evaluate((element) => element.inert)).toBe(true)
    await exerciseOptions
      .getByRole('button', { name: 'Back from exercise options' })
      .click()
    await expect(exerciseOptions).not.toBeVisible()
    await expect
      .poll(() => addSetControl.evaluate((element) => element.inert))
      .toBe(false)
    const lockedLayout = await page.evaluate(() => ({
      bodyOverflow: getComputedStyle(document.body).overflow,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      pageScrollHeight: document.documentElement.scrollHeight,
      navBottomGap:
        window.innerHeight -
        document.querySelector('.bottom-nav')!.getBoundingClientRect().bottom,
      navVisualBottomGap:
        (window.visualViewport
          ? window.visualViewport.offsetTop + window.visualViewport.height
          : window.innerHeight) -
        document.querySelector('.bottom-nav')!.getBoundingClientRect().bottom,
      rootOverflow: getComputedStyle(document.querySelector('#root')!).overflow,
      navPosition: getComputedStyle(document.querySelector('.bottom-nav')!)
        .position,
      shellPosition: getComputedStyle(document.querySelector('.app-shell')!)
        .position,
      shellHeight: document.querySelector('.app-shell')!.getBoundingClientRect()
        .height,
      lockedWorkoutHeight: document.documentElement.style.getPropertyValue(
        '--live-workout-height',
      ),
      viewportHeight: window.innerHeight,
    }))
    const workspaceOverflow = await exerciseWorkspace.evaluate(
      (element) => getComputedStyle(element).overflowY,
    )
    const setList = exerciseWorkspace.locator('.set-list')
    const setListOverflow = await setList.evaluate(
      (element) => getComputedStyle(element).overflowY,
    )
    const setListMomentumScrolling = await setList.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('-webkit-overflow-scrolling'),
    )
    expect(lockedLayout.bodyOverflow).toBe('hidden')
    expect(lockedLayout.htmlOverflow).toBe('hidden')
    expect(lockedLayout.rootOverflow).toBe('hidden')
    expect(lockedLayout.navPosition).toBe('relative')
    // The shell is pinned to the layout viewport so a stray scroll offset can
    // never slide the in-flow bottom dashboard off screen.
    expect(lockedLayout.shellPosition).toBe('fixed')
    expect(lockedLayout.shellHeight).toBe(lockedLayout.viewportHeight)
    expect(lockedLayout.lockedWorkoutHeight).toBe('')
    expect(lockedLayout.pageScrollHeight).toBeLessThanOrEqual(
      lockedLayout.viewportHeight + 1,
    )
    expect(
      Math.abs(lockedLayout.navBottomGap - dashboardNavBottomGaps.layout),
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(lockedLayout.navVisualBottomGap - dashboardNavBottomGaps.visual),
    ).toBeLessThanOrEqual(1)
    expect(workspaceOverflow).toBe('hidden')
    expect(setListOverflow).toBe('auto')
    expect(setListMomentumScrolling).not.toBe('touch')
    const fixedControlSpacing = await page.evaluate(() => {
      const actions = document
        .querySelector('.exercise-management-actions')!
        .getBoundingClientRect()
      const addSet = document
        .querySelector('.exercise-add-set-button')!
        .getBoundingClientRect()
      const session = document
        .querySelector('.live-workout-session-bar')!
        .getBoundingClientRect()
      return {
        actionToSessionGap: session.top - actions.bottom,
        addSetBeforeActions: addSet.bottom <= actions.top,
        sessionPosition: getComputedStyle(
          document.querySelector('.live-workout-session-bar')!,
        ).position,
        workspaceTransform: getComputedStyle(
          document.querySelector('.exercise-workspace')!,
        ).transform,
      }
    })
    expect(fixedControlSpacing.actionToSessionGap).toBeGreaterThanOrEqual(7)
    expect(fixedControlSpacing.actionToSessionGap).toBeLessThanOrEqual(9)
    expect(fixedControlSpacing.addSetBeforeActions).toBe(true)
    expect(fixedControlSpacing.sessionPosition).toBe('relative')
    expect(fixedControlSpacing.workspaceTransform).toBe('none')
    await page.evaluate(() => window.scrollTo(0, 200))
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(
      exerciseWorkspace
        .locator('.exercise-title-line')
        .getByRole('button', { name: 'Edit exercise notes' }),
    ).toBeVisible()
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(
      page
        .locator('.live-workout-session-bar')
        .getByRole('button', { name: 'Pause workout timer' }),
    ).toHaveCount(0)
    await expect(
      page
        .locator('.app-header')
        .getByRole('button', { name: 'Pause workout timer' }),
    ).toHaveCount(0)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.getByRole('button', { name: 'More exercise actions' }).click()
    const reopenedExerciseOptions = page.getByRole('dialog', {
      name: 'Exercise options',
    })
    await reopenedExerciseOptions
      .getByRole('button', { name: 'Pause workout timer' })
      .click()
    await expect(
      reopenedExerciseOptions.getByRole('button', {
        name: 'Resume workout timer',
      }),
    ).toBeVisible()
    await reopenedExerciseOptions
      .getByRole('button', { name: 'Resume workout timer' })
      .click()
    await expect(
      reopenedExerciseOptions.getByRole('button', {
        name: 'Pause workout timer',
      }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(reopenedExerciseOptions).not.toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Workout notes' }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Add Exercise' }).click()
    const addExerciseSheet = page.getByRole('dialog', { name: 'Add Exercise' })
    await expect(addExerciseSheet).toBeVisible()
    const layerOrder = await page.evaluate(() => ({
      sessionBar: Number.parseInt(
        getComputedStyle(
          document.querySelector('.live-workout-session-bar') as Element,
        ).zIndex,
        10,
      ),
      sheet: Number.parseInt(
        getComputedStyle(
          document.querySelector('.sheet-backdrop--page') as Element,
        ).zIndex,
        10,
      ),
    }))
    expect(layerOrder.sheet).toBeGreaterThan(layerOrder.sessionBar)
    await addExerciseSheet.getByLabel('Search exercises').fill('Barbell Curl')
    await addExerciseSheet
      .getByRole('button', { name: /Barbell Curl/ })
      .first()
      .click()
    await expect(addExerciseSheet).not.toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Barbell Curl' }),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Set 1 Reps' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'E2E Live press, exercise 1 of 2' })
      .click()
    await page.getByRole('button', { name: 'Add Set' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Set 3 Weight' }),
    ).toBeVisible()
    const firstThreeSetHeights = await page
      .locator('.set-row')
      .evaluateAll((rows) =>
        rows.slice(0, 3).map((row) => row.getBoundingClientRect().height),
      )
    await page.getByRole('button', { name: 'Add Set' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Set 4 Weight' }),
    ).toBeVisible()
    const firstThreeHeightsAfterFourthSet = await page
      .locator('.set-row')
      .evaluateAll((rows) =>
        rows.slice(0, 3).map((row) => row.getBoundingClientRect().height),
      )
    expect(firstThreeHeightsAfterFourthSet).toEqual(firstThreeSetHeights)
    await page.getByRole('button', { name: 'Delete set 4' }).click()
    await page.getByRole('textbox', { name: 'Set 3 Weight' }).fill('115')
    await page.getByRole('button', { name: 'Delete set 3' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Set 3 Weight' }),
    ).toHaveCount(0)
    await expect(page.getByText(/Workout set .* was not found/)).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Set 1 Weight' }).fill('95')
    await page.getByRole('textbox', { name: 'Set 1 Reps' }).fill('10')
    await page.getByRole('textbox', { name: 'Set 1 Weight' }).click()
    await page
      .getByRole('textbox', { name: 'Set 1 Weight' })
      .pressSequentially('105')
    await expect(
      page.getByRole('textbox', { name: 'Set 1 Weight' }),
    ).toHaveValue('105')
    await expect(page.getByRole('textbox', { name: 'Set 2 Reps' })).toHaveValue(
      '10',
    )
    await page.getByRole('link', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'Resume workout' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Set 1 Weight' }),
    ).toHaveValue('105')
    await expect(page.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue(
      '10',
    )
    await expect(page.getByRole('textbox', { name: 'Set 2 Reps' })).toHaveValue(
      '10',
    )
    await page.getByRole('button', { name: 'Complete set 1' }).click()
    await expect(page.locator('.live-session-rest-timer')).toBeVisible()
    await expect(page.getByLabel(/Timer running: 1:(29|30)/)).toBeVisible()
    await expect(
      page
        .locator('.live-workout-session-bar')
        .getByRole('button', { name: 'Add 30 seconds' }),
    ).toBeVisible()
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('live-workout-390.png'),
    })
    await expect(
      page.getByRole('button', { name: 'Dismiss timer notice' }),
    ).toHaveCount(0)
    await expect(page.getByText(/outside-app timer alerts/i)).toHaveCount(0)
    await page.getByRole('button', { name: 'Mark incomplete set 1' }).click()
    await page.getByRole('button', { name: 'Complete set 1' }).click()
    await expect(
      page.getByRole('button', { name: 'Dismiss timer notice' }),
    ).toHaveCount(0)
    await expect(page.getByText(/outside-app timer alerts/i)).toHaveCount(0)

    await page.reload()
    await expect(
      page.getByRole('textbox', { name: 'Set 1 Weight' }),
    ).toHaveValue('105')
    await expect(page.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue(
      '10',
    )
    await expect(
      page.getByRole('button', { name: 'Dismiss timer notice' }),
    ).toHaveCount(0)
    await expect(page.getByText(/outside-app timer alerts/i)).toHaveCount(0)
    await page.getByRole('button', { name: 'More exercise actions' }).click()
    const resumedExerciseOptions = page.getByRole('dialog', {
      name: 'Exercise options',
    })
    await expect(
      resumedExerciseOptions.getByRole('button', {
        name: 'Resume workout timer',
      }),
    ).toBeVisible()
    await resumedExerciseOptions
      .getByRole('button', { name: 'Resume workout timer' })
      .click()
    await page.keyboard.press('Escape')
    await expect(resumedExerciseOptions).not.toBeVisible()

    await page.getByRole('button', { name: 'Discard' }).click()
    await page
      .getByRole('dialog', { name: 'Discard workout?' })
      .getByRole('button', { name: 'Discard Workout' })
      .click()
    await expect(page).toHaveURL(/\/training/)
  },
)

test(
  'uses the installed-iPhone workout keypad without moving or removing the dashboard',
  { tag: '@smoke' },
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-webkit',
      'The installed-keypad interaction is covered in the iPhone-sized browser profile; parallel WebKit can stall while its expanded exercise seed is installing.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        value: true,
      })
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',
      })
    })
    await page.goto('/training')
    await waitForExerciseLibrary(page)

    await page
      .getByLabel('Current Program')
      .getByRole('button', { name: 'Create program' })
      .click()
    await page
      .getByRole('textbox', { name: 'Name' })
      .fill('Installed keypad program')
    await page.getByRole('button', { name: 'Save program' }).click()
    const builder = page.getByRole('dialog', { name: 'Edit template' })
    await addWorkoutDay(builder, 'Keypad day')
    await builder.getByRole('button', { name: 'Add exercise' }).click()
    await addPrescription(builder, 'Barbell Bench Press', '1')
    await closeBuilder(builder)

    await page
      .getByRole('button', { name: 'Activate Installed keypad program' })
      .click()
    await page
      .getByRole('dialog', { name: 'Activate program?' })
      .getByRole('button', { name: 'Activate' })
      .click()
    await page.getByRole('button', { name: /^Keypad day/ }).click()
    await page
      .getByRole('dialog', { name: 'Keypad day' })
      .getByRole('button', { name: 'Start Workout' })
      .click()

    const nav = page.getByRole('navigation', { name: 'Primary' })
    const weight = page.getByRole('textbox', { name: 'Set 1 Weight' })
    await expect(nav).toBeVisible()
    await nav.evaluate((element) => {
      element.setAttribute('data-installed-keypad-nav', 'same')
    })
    await expect(weight).toHaveAttribute('readonly', '')
    await expect(weight).toHaveAttribute('inputmode', 'none')
    const before = await page.evaluate(() => {
      const shell = document
        .querySelector('.app-shell')!
        .getBoundingClientRect()
      const nav = document.querySelector('.bottom-nav')!.getBoundingClientRect()
      return {
        navBottom: nav.bottom,
        shellHeight: shell.height,
        shellTop: shell.top,
      }
    })

    await weight.click()
    await expect
      .poll(() =>
        page.evaluate(() => ({
          bodyOpen: document.body.classList.contains(
            'live-workout-keypad-open',
          ),
          panelPresent: Boolean(document.querySelector('.live-workout-keypad')),
          rootInert: document.querySelector<HTMLElement>('#root')?.inert,
        })),
      )
      .toEqual({ bodyOpen: true, panelPresent: true, rootInert: true })
    const weightPad = page.getByRole('dialog', {
      name: 'Set 1 Weight number pad',
    })
    await expect(weightPad).toBeVisible()
    await expect(nav).toBeVisible()
    await expect(nav).toHaveAttribute('data-installed-keypad-nav', 'same')
    for (const digit of ['1', '8', '5']) {
      await weightPad.getByRole('button', { name: digit, exact: true }).click()
    }
    await expect(weight).toHaveValue('185')
    await weightPad.getByRole('button', { name: 'Done' }).click()

    const reps = page.getByRole('textbox', { name: 'Set 1 Reps' })
    await expect(reps).toHaveAttribute('readonly', '')
    await reps.click()
    const repsPad = page.getByRole('dialog', {
      name: 'Set 1 Reps number pad',
    })
    await repsPad.getByRole('button', { name: '8', exact: true }).click()
    await repsPad.getByRole('button', { name: 'Done' }).click()
    await expect(reps).toHaveValue('8')

    const after = await page.evaluate(() => {
      const shell = document
        .querySelector('.app-shell')!
        .getBoundingClientRect()
      const nav = document.querySelector('.bottom-nav')!.getBoundingClientRect()
      return {
        navBottom: nav.bottom,
        shellHeight: shell.height,
        shellTop: shell.top,
      }
    })
    expect(after).toEqual(before)
    await expect(nav).toHaveCSS('position', 'relative')
    await expect(nav).toHaveAttribute('data-installed-keypad-nav', 'same')

    // Even a stray document scroll offset (what an iOS focus scroll-into-view
    // would produce) must not pull the pinned dashboard off screen.
    const navBottomAfterForcedScroll = await page.evaluate(() => {
      document.documentElement.style.minHeight = '3000px'
      window.scrollTo(0, 400)
      const navBottom = document
        .querySelector('.bottom-nav')!
        .getBoundingClientRect().bottom
      document.documentElement.style.minHeight = ''
      window.scrollTo(0, 0)
      return { navBottom, viewportHeight: window.innerHeight }
    })
    expect(
      Math.abs(
        navBottomAfterForcedScroll.navBottom -
          navBottomAfterForcedScroll.viewportHeight,
      ),
    ).toBeLessThanOrEqual(1)

    await page.getByRole('button', { name: 'Complete set 1' }).click()
    await expect(
      page.getByRole('button', { name: 'Mark incomplete set 1' }),
    ).toBeVisible()
    if (testInfo.project.name !== 'mobile-webkit') {
      await page.reload()
      await expect(
        page.getByRole('textbox', { name: 'Set 1 Weight' }),
      ).toHaveValue('185')
      await expect(
        page.getByRole('textbox', { name: 'Set 1 Reps' }),
      ).toHaveValue('8')
    }

    // Completing the only programmed set can open the auto-finish prompt once
    // the restored workout registers all sets complete; its timing varies under
    // parallel load (it may already be open, appear late, or not at all). Poll:
    // dismiss it if present, then open Discard, retrying so a late prompt cannot
    // leave its backdrop over the Discard control.
    const finishPrompt = page.getByRole('dialog', { name: 'Finish workout?' })
    const discardPrompt = page.getByRole('dialog', { name: 'Discard workout?' })
    await expect(async () => {
      if (await finishPrompt.isVisible()) {
        await finishPrompt
          .getByRole('button', { name: 'Keep working out' })
          .click()
        await expect(finishPrompt).toBeHidden()
      }
      await page.getByRole('button', { name: 'Discard' }).click()
      await expect(discardPrompt).toBeVisible({ timeout: 3000 })
    }).toPass({ timeout: 30000 })

    await discardPrompt.getByRole('button', { name: 'Discard Workout' }).click()
    await expect(page).toHaveURL(/\/training/)
  },
)

test('manually logs a treadmill run as an individual History card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/run')

  await page.getByRole('button', { name: 'Log Run Manually' }).click()
  await page.getByLabel('Run type').selectOption('treadmill')
  await page.getByLabel('Distance (miles)').fill('3.1')
  await page.getByLabel('Duration (minutes)').fill('30')
  await page.getByLabel('Notes').fill('Incline session')
  await page.getByRole('button', { name: 'Save Run' }).click()
  await expect(page.getByText('Run saved to History.')).toBeVisible()

  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('button', { name: 'View all history' }).click()
  await expect(page).toHaveURL(/\/history\?source=home/)
  const runCard = page.getByRole('button', { name: /Run$/ })
  await expect(runCard).toHaveClass(/history-run-card/)
  await expect(runCard).toContainText('Treadmill run')
  await expect(runCard).toContainText('3.10 mi')
  await runCard.click()
  await expect(page.getByText('Run detail')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(runCard).toBeVisible()
})

test(
  'creates, logs, edits, deletes, and persists nutrition entries',
  {
    tag: '@smoke',
  },
  async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-webkit',
      'Covered in Chromium; this long mutation flow is timing-fragile in the WebKit runner.',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/nutrition')

    await page.getByRole('button', { name: /Create custom food/ }).click()
    await expect(page.getByRole('button', { name: 'Save food' })).toBeEnabled()
    await page.getByRole('textbox', { name: 'Name' }).fill('E2E Rice')
    await page.getByRole('textbox', { name: 'Serving amount' }).fill('1')
    await page.getByRole('textbox', { name: 'Serving unit' }).fill('cup')
    await page
      .getByRole('textbox', { name: 'Calories per serving' })
      .fill('200')
    await page.getByRole('textbox', { name: 'Protein per serving' }).fill('4')
    await page
      .getByRole('textbox', { name: 'Carbohydrates per serving' })
      .fill('45')
    await page.getByRole('textbox', { name: 'Fat per serving' }).fill('1')
    await page.getByRole('button', { name: 'Save food' }).click()

    await page.getByRole('button', { name: 'Search foods' }).click()
    await page.getByRole('searchbox', { name: 'Search foods' }).fill('e2e')
    await page.getByRole('button', { name: /^Open E2E Rice,/ }).click()
    const foodDetails = page.getByRole('dialog', { name: 'Food details' })
    await expect(foodDetails.getByLabel('Nutrition preview')).toBeVisible()
    await expect(
      foodDetails.getByRole('button', { name: 'Decrease portion' }),
    ).toBeVisible()
    const increasePortion = foodDetails.getByRole('button', {
      name: 'Increase portion',
    })
    await expect(increasePortion).toBeVisible()
    const quickPortions = foodDetails.getByRole('group', {
      name: 'Quick portions',
    })
    await expect(quickPortions).toBeVisible()
    await expect(quickPortions.getByRole('button')).toHaveText([
      '½',
      '1',
      '1½',
      '2',
    ])
    await expect(foodDetails.getByLabel('Serving unit')).toHaveText('cup')
    const servingAmount = foodDetails.getByRole('textbox', {
      name: 'Serving amount',
    })
    await increasePortion.click()
    await expect(servingAmount).toHaveValue('1.5')
    await expect(foodDetails.getByLabel('Nutrition preview')).toContainText(
      '300 kcal',
    )
    await foodDetails.getByRole('button', { name: 'Log food' }).click()
    // The food logs into the day view behind the search subpage; return to it.
    await page.getByRole('button', { name: 'Back to nutrition' }).click()
    await expect(
      page.locator('.metric-value').filter({ hasText: '300 kcal' }),
    ).toBeVisible()
    await expect(page.getByText(/1.5 cup .* 300 kcal/)).toBeVisible()

    await page.reload()
    await expect(
      page.locator('.metric-value').filter({ hasText: '300 kcal' }),
    ).toBeVisible()
    await expect(page.getByText(/1.5 cup .* 300 kcal/)).toBeVisible()

    await page.getByRole('button', { name: 'Edit E2E Rice log' }).click()
    const editFoodLog = page.getByRole('dialog', { name: 'Edit food log' })
    await expect(
      editFoodLog.getByRole('textbox', { name: 'Serving amount' }),
    ).toHaveValue('1.5')
    await expect(
      editFoodLog.getByRole('textbox', { name: 'Serving unit' }),
    ).toHaveValue('cup')
    await editFoodLog.getByRole('textbox', { name: 'Serving amount' }).fill('2')
    await editFoodLog.getByRole('button', { name: 'Save log' }).click()
    await expect(page.getByText(/2 cup .* 400 kcal/)).toBeVisible()
    await expect(
      page.locator('.metric-value').filter({ hasText: '400 kcal' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Delete E2E Rice log' }).click()
    await page
      .getByRole('dialog', { name: 'Delete food log?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(page.getByText('No foods logged')).toBeVisible()

    await page.getByRole('button', { name: 'Open quick actions' }).click()
    await page.getByRole('button', { name: /Log food/ }).click()
    await expect(page).toHaveURL(/\/nutrition/)
    await expect(
      page.getByRole('searchbox', { name: 'Search foods' }),
    ).toBeVisible()
  },
)

test('logs, edits, deletes, switches dates, and persists bodyweight after reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-webkit',
    'Covered in Chromium; this long mutation flow is timing-fragile in the WebKit runner.',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page
    .getByRole('dialog', { name: 'Quick actions' })
    .getByRole('button', { name: /Log bodyweight/ })
    .click()
  await page
    .getByRole('dialog', { name: 'Log bodyweight' })
    .getByRole('textbox', { name: 'Bodyweight' })
    .fill('188.4')
  await page.getByRole('button', { name: 'Save' }).click()
  const bodyweightCard = page.locator('.home-bodyweight-summary')
  await expect(
    bodyweightCard.locator('.home-bw-value-secondary', {
      hasText: '188.4 lb',
    }),
  ).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(
    page.getByRole('complementary', { name: 'Your data stays local' }),
  ).toHaveCount(0)
  await expect(
    bodyweightCard.locator('.home-bw-value-secondary', {
      hasText: '188.4 lb',
    }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: 'Log bodyweight', exact: true })
    .click()
  const editInput = page
    .getByRole('dialog', { name: 'Log bodyweight' })
    .getByRole('textbox', { name: 'Bodyweight' })
  await expect(editInput).toHaveValue('188.4')
  await editInput.fill('189.2')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    bodyweightCard.locator('.home-bw-value-secondary', {
      hasText: '189.2 lb',
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Next day' }).click()
  await page
    .getByRole('button', { name: 'Log bodyweight', exact: true })
    .click()
  await expect(
    page
      .getByRole('dialog', { name: 'Log bodyweight' })
      .getByRole('textbox', { name: 'Bodyweight' }),
  ).toHaveValue('')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(
    bodyweightCard.locator('.home-bw-value-secondary', {
      hasText: '189.2 lb',
    }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: 'Log bodyweight', exact: true })
    .click()
  await page.getByRole('button', { name: /Delete/ }).click()
  await page
    .getByRole('dialog', { name: 'Delete bodyweight?' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(
    bodyweightCard.locator('.home-bw-value-secondary', {
      hasText: 'No entry',
    }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('complementary', { name: 'Your data stays local' }),
  ).toHaveCount(0)
  await expect(
    bodyweightCard.locator('.home-bw-value-secondary', {
      hasText: 'No entry',
    }),
  ).toBeVisible()
})

test('logs bodyweight for a past date from its Home card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page
    .getByRole('button', { name: 'Log bodyweight', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Log bodyweight' })
  await dialog.getByLabel('Date').fill('2026-01-15')
  await dialog.getByRole('textbox', { name: 'Bodyweight' }).fill('180')
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(
    page.locator('.home-bw-value-secondary', { hasText: '180 lb' }),
  ).toBeVisible()
})

test('exits the What’s New deep link back to usable Settings', async ({
  page,
}) => {
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page.getByRole('link', { name: "See what's new" }).click()
  await expect(page).toHaveURL(/\/settings\?section=whats-new/)
  await page.getByRole('button', { name: 'Back to settings' }).click()

  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Back to settings' }),
  ).toHaveCount(0)
})

test('shows bodyweight progress graph with range controls and tap details', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page
    .getByRole('button', { name: 'Log bodyweight', exact: true })
    .click()
  const firstEntryDialog = page.getByRole('dialog', {
    name: 'Log bodyweight',
  })
  await firstEntryDialog.getByLabel('Date').fill('2026-06-04')
  await firstEntryDialog
    .getByRole('textbox', { name: 'Bodyweight' })
    .fill('188')
  await firstEntryDialog.getByRole('button', { name: 'Save' }).click()
  await expect(firstEntryDialog).not.toBeVisible()
  await page
    .getByRole('button', { name: 'Log bodyweight', exact: true })
    .click()
  const secondEntryDialog = page.getByRole('dialog', {
    name: 'Log bodyweight',
  })
  await secondEntryDialog.getByLabel('Date').fill('2026-07-04')
  await secondEntryDialog
    .getByRole('textbox', { name: 'Bodyweight' })
    .fill('189')
  await secondEntryDialog.getByRole('button', { name: 'Save' }).click()
  await expect(secondEntryDialog).not.toBeVisible()

  await page.getByRole('button', { name: 'View graph' }).click()
  await expect(page).toHaveURL(/\/history\?view=bodyweight/)
  await expect(
    page.getByRole('heading', { name: 'Bodyweight progress' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '3M' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page
    .getByLabel('Bodyweight range')
    .getByRole('button', { name: 'All' })
    .click()
  await expect(
    page.locator('.bodyweight-chart .chart-axis-tick-last'),
  ).toBeVisible()
  const axisSpacing = await page
    .locator('.bodyweight-chart')
    .evaluate((chart) => {
      const title = chart.querySelector('.chart-axis-label-x')
      const lastTick = chart.querySelector('.chart-axis-tick-last')
      if (!title || !lastTick) {
        return null
      }
      const titleRect = title.getBoundingClientRect()
      const tickRect = lastTick.getBoundingClientRect()
      return {
        gap: titleRect.top - tickRect.bottom,
        overlaps: !(
          titleRect.left >= tickRect.right ||
          titleRect.right <= tickRect.left ||
          titleRect.top >= tickRect.bottom ||
          titleRect.bottom <= tickRect.top
        ),
      }
    })
  expect(axisSpacing).not.toBeNull()
  expect(axisSpacing?.overlaps).toBe(false)
  expect(axisSpacing?.gap).toBeGreaterThanOrEqual(6)
  await page.getByRole('button', { name: /189 lb/ }).click()
  await expect(page.getByText('Selected', { exact: true })).toBeVisible()
})

test('shows calorie bars and target line on Home and in History Graphs', async ({
  page,
}) => {
  await page.goto('/')
  await dismissSignInPrompt(page)

  await page.getByRole('link', { name: 'Nutrition' }).click()
  await page.getByRole('button', { name: 'Targets' }).click()
  await page.getByRole('textbox', { name: 'Calories' }).fill('2000')
  await page.getByRole('button', { name: 'Save targets' }).click()
  await expect(page.getByText('Nutrition targets saved.')).toBeVisible()
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await page.getByRole('button', { name: 'Quick add nutrition' }).click()
  const quickAdd = page.getByRole('dialog', { name: 'Quick add nutrition' })
  await quickAdd.getByRole('textbox', { name: 'Name' }).fill('E2E calorie day')
  await quickAdd.getByRole('textbox', { name: 'Calories' }).fill('1800')
  await quickAdd.getByRole('button', { name: 'Log quick add' }).click()
  await expect(page.getByText('Quick add logged.')).toBeVisible()
  await page.getByRole('link', { name: 'Home' }).click()

  const homeChart = page.getByRole('img', {
    name: 'Daily calories logged and target graph',
  })
  await expect(homeChart).toBeVisible()
  await expect(homeChart.locator('rect.calorie-bar')).toHaveCount(7)
  await expect(homeChart.locator('polyline.calorie-target-line')).toHaveCount(1)

  const homeRange = page.getByLabel('Home calorie range')
  await expect(homeRange.getByRole('button', { name: '1W' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await homeRange.getByRole('button', { name: '1M' }).click()
  await expect(homeChart.locator('rect.calorie-bar')).toHaveCount(30)

  await page.getByRole('button', { name: 'View more' }).click()
  await expect(page).toHaveURL(/\/calories\?range=1m&end=/)
  await expect(
    page.getByRole('heading', { name: 'Calorie insights' }),
  ).toBeVisible()
  await expect(page.getByText('Logging consistency')).toBeVisible()
  await expect(page.getByText('Average vs target')).toBeVisible()
  const calorieSummary = page.getByRole('region', { name: 'Calorie summary' })
  await expect(calorieSummary.getByText('3%')).toBeVisible()
  await expect(calorieSummary.getByText('1 of 30')).toBeVisible()
  await expect(calorieSummary.getByText('1,800 kcal')).toBeVisible()
  await expect(calorieSummary.getByText('2,000 kcal')).toBeVisible()
  await expect(calorieSummary.getByText('200 kcal deficit')).toBeVisible()
  await page
    .getByLabel('Calorie insights range')
    .getByRole('button', { name: '3M' })
    .click()
  await expect(
    page
      .getByRole('img', {
        name: 'Daily calories logged and target graph',
      })
      .locator('rect.calorie-bar'),
  ).toHaveCount(90)
  await expect(calorieSummary.getByText('1%')).toBeVisible()
  await expect(calorieSummary.getByText('1 of 90')).toBeVisible()
  await expect(calorieSummary.getByText('200 kcal deficit')).toBeVisible()

  await page.getByRole('button', { name: 'Back to Home' }).click()

  await page.getByRole('button', { name: 'Graphs' }).click()
  await page.getByRole('button', { name: 'Calories' }).click()
  await expect(
    page.getByLabel('Calorie graph range').getByRole('button', { name: '1W' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByLabel('Calorie graph range')
    .getByRole('button', { name: '3M' })
    .click()
  await expect(
    page
      .getByRole('img', {
        name: 'Daily calories logged and target graph',
      })
      .locator('rect.calorie-bar'),
  ).toHaveCount(90)
})

test('settings exposes local data controls and validates malformed restore files', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')

  const weightUnit = page.getByLabel('Weight unit')
  await expect(weightUnit).toHaveValue('lb')
  await expect(weightUnit.locator('option[value="lb"]')).toHaveText(
    'Pounds (lb)',
  )
  await page.getByRole('button', { name: 'About' }).click()
  await expect(page.getByText('Backup format version')).toBeVisible()
  await page.getByRole('button', { name: 'Data' }).click()
  await expect(
    page.getByText(/Local backup files and ZIP exports stay on this device/),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Cloud backup' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Sign in with Google' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export JSON backup' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export all fitness data' }),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all fitness data' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(
    /^fitness-data-export-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/,
  )
  await expect(
    page.getByText(/Fitness data export prepared: .* records in 39 files/),
  ).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'bad-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })

  await expect(page.getByLabel('Import preview')).toBeVisible()
  await expect(page.getByText(/not valid JSON/)).toBeVisible()

  await page.getByRole('button', { name: 'Clear all data' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Clear all data?' }),
  ).toBeVisible()
})

test('language preference switches the app to Spanish and survives reload', async ({
  page,
}, testInfo) => {
  let searchRequest: Record<string, unknown> | null = null
  await page.route('**/api/foods/search', async (route) => {
    searchRequest = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          provider: 'open_food_facts',
          query: 'arroz',
          results: [],
          fallbackUsed: false,
        },
      }),
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')

  await page.getByLabel('App language').selectOption('es')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Configuración' }),
  ).toBeVisible()
  await expect(page.getByLabel('Idioma de la aplicación')).toHaveValue('es')
  await expect(
    page.getByRole('navigation', { name: 'Principal' }),
  ).toContainText('Inicio')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')

  await page.reload()

  await expect(page.getByLabel('Idioma de la aplicación')).toHaveValue('es')
  await page.getByRole('link', { name: 'Nutrición' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Nutrición' }),
  ).toBeVisible()
  if (testInfo.project.name !== 'mobile-webkit') {
    // Playwright cannot intercept requests handled by WebKit's active service
    // worker. Chromium covers the provider request contract while WebKit still
    // covers persisted Spanish UI behavior above.
    await page.getByRole('button', { name: 'Buscar alimentos' }).click()
    await page
      .getByRole('searchbox', { name: 'Buscar alimentos' })
      .fill('arroz')
    await page
      .getByRole('button', { name: 'Buscar alimentos en español' })
      .click()
    await expect
      .poll(() => searchRequest)
      .toMatchObject({
        query: 'arroz',
        provider: 'open_food_facts',
        language: 'es',
      })
  }
})

test('completes the release workflow through backup restore', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The viewport-independent full release audit runs once in desktop Chromium; mobile projects keep focused flow coverage and avoid duplicate multi-megabyte backup restores under parallel load.',
  )
  // This audit builds and restores a multi-megabyte backup after exercising
  // every major local-first flow. Keep enough headroom for parallel CI workers.
  testInfo.setTimeout(300_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')
  const rirTracking = page.getByRole('checkbox', {
    name: 'Track RIR (reps in reserve)',
  })
  await rirTracking.check()
  await expect(rirTracking).toBeChecked()
  await expect(
    page.getByText(
      'RIR fields are shown during workouts and in prescriptions.',
    ),
  ).toBeVisible()
  await page.goto('/nutrition')

  await page.getByRole('button', { name: /Create custom food/ }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Audit oats')
  await page.getByRole('textbox', { name: 'Serving amount' }).fill('1')
  await page.getByRole('textbox', { name: 'Serving unit' }).fill('cup')
  await page.getByRole('textbox', { name: 'Calories per serving' }).fill('200')
  await page.getByRole('textbox', { name: 'Protein per serving' }).fill('8')
  await page
    .getByRole('textbox', { name: 'Carbohydrates per serving' })
    .fill('30')
  await page.getByRole('textbox', { name: 'Fat per serving' }).fill('4')
  await page.getByRole('button', { name: 'Save food' }).click()
  await page.getByRole('button', { name: 'Search foods' }).click()
  await page.getByRole('searchbox', { name: 'Search foods' }).fill('audit')
  await page.getByRole('button', { name: /^Open Audit oats,/ }).click()
  await page.getByRole('textbox', { name: 'Serving amount' }).fill('1.25')
  await expect(page.getByLabel('Nutrition preview')).toContainText('250 kcal')
  await page.getByRole('button', { name: 'Log food', exact: true }).click()
  await page.getByRole('button', { name: 'Back to nutrition' }).click()
  await expect(page.getByText(/1.25 cup .* 250 kcal/)).toBeVisible()

  await page.goto('/')
  await dismissSignInPrompt(page)
  await page.getByRole('button', { name: 'Open quick actions' }).click()
  await page
    .getByRole('dialog', { name: 'Quick actions' })
    .getByRole('button', { name: /Log bodyweight/ })
    .click()
  await page
    .getByRole('dialog', { name: 'Log bodyweight' })
    .getByRole('textbox', { name: 'Bodyweight' })
    .fill('188.4')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page
      .locator('.home-bodyweight-summary')
      .locator('.home-bw-value-secondary', { hasText: '188.4 lb' }),
  ).toBeVisible()

  await page.goto('/training')
  await waitForExerciseLibrary(page)
  await createExercise(page, 'Audit squat', '180')
  await createExercise(page, 'Audit curl', '60')
  await createExercise(page, 'Audit row', '90')

  await page
    .getByLabel('Current Program')
    .getByRole('button', { name: 'Create program' })
    .click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Audit program')
  await page.getByRole('button', { name: 'Save program' }).click()
  const builder = page.getByRole('dialog', { name: 'Edit template' })
  await addWorkoutDay(builder, 'Audit A')
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await addPrescription(builder, 'Audit squat', '3')
  await builder.getByRole('button', { name: 'Add exercise' }).click()
  await addPrescription(builder, 'Audit curl', '1')
  await closeBuilder(builder)

  await page.getByRole('button', { name: 'Activate Audit program' }).click()
  await page
    .getByRole('dialog', { name: 'Activate program?' })
    .getByRole('button', { name: 'Activate' })
    .click()
  await page.getByRole('button', { name: /^Audit A/ }).click()
  await page
    .getByRole('dialog', { name: 'Audit A' })
    .getByRole('button', { name: 'Start Workout' })
    .click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Audit A' }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Set 1 Weight' }).first().fill('185')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).first().fill('8')
  await page.getByRole('button', { name: 'Complete set 1' }).first().click()
  await page.getByRole('textbox', { name: 'Set 2 Weight' }).fill('190')
  await page.getByRole('textbox', { name: 'Set 2 Reps' }).fill('7')
  await page.getByRole('button', { name: 'Complete set 2' }).click()
  await page.getByRole('textbox', { name: 'Set 3 Weight' }).fill('195')
  await page.getByRole('textbox', { name: 'Set 3 Reps' }).fill('6')
  await page.getByRole('textbox', { name: 'Set 3 final RIR' }).fill('2')
  await page.getByRole('button', { name: 'Complete set 3' }).click()
  await page.getByRole('heading', { name: 'Audit curl' }).waitFor()
  await page
    .getByRole('button', { name: 'Audit squat, exercise 1 of 2' })
    .click()
  await page.getByRole('button', { name: 'Add Set' }).first().click()
  await page.getByRole('textbox', { name: 'Set 4 Weight' }).fill('200')
  await page.getByRole('textbox', { name: 'Set 4 Reps' }).fill('5')
  await page.getByRole('button', { name: 'Complete set 4' }).click()
  await page.getByRole('heading', { name: 'Audit curl' }).waitFor()
  await page
    .getByRole('button', { name: 'Audit squat, exercise 1 of 2' })
    .click()
  await expect(page.getByRole('heading', { name: 'Audit squat' })).toBeVisible()
  // Swap / Skip now live in the live workout's bottom action row, not the
  // exercise options sheet.
  await page.getByRole('button', { name: 'Swap Exercise' }).click()
  const replaceSheet = page.getByRole('dialog', { name: 'Swap Exercise' })
  await replaceSheet.getByLabel('Search exercises').fill('Audit row')
  await replaceSheet.getByRole('button', { name: /Audit row/ }).click()
  await expect(replaceSheet).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Audit row' })).toBeVisible()
  await page
    .getByRole('button', { name: 'Audit curl, exercise 2 of 2' })
    .click()
  await expect(page.getByRole('heading', { name: 'Audit curl' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip Exercise' }).click()
  await expect(page.getByRole('button', { name: 'Unskip' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Audit curl' })).toBeVisible()
  await expect(page.getByText('Skipped', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Audit row, exercise 1 of 2' }).click()
  await expect(page.getByRole('heading', { name: 'Audit row' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Set 4 Weight' })).toHaveValue(
    '',
  )
  await page.getByRole('textbox', { name: 'Set 1 Weight' }).fill('145')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).fill('10')
  await page.getByRole('textbox', { name: 'Set 1 Reps' }).press('Enter')
  await expect(page.getByRole('textbox', { name: 'Set 1 Reps' })).toHaveValue(
    '10',
  )
  await page.getByRole('button', { name: 'Complete set 1' }).click()
  await page.getByRole('textbox', { name: 'Set 2 Weight' }).fill('150')
  await page.getByRole('textbox', { name: 'Set 2 Reps' }).fill('9')
  await page.getByRole('textbox', { name: 'Set 2 Reps' }).press('Enter')
  await expect(page.getByRole('textbox', { name: 'Set 2 Reps' })).toHaveValue(
    '9',
  )
  await page.getByRole('button', { name: 'Complete set 2' }).click()
  await page.getByRole('textbox', { name: 'Set 3 Weight' }).fill('155')
  await page.getByRole('textbox', { name: 'Set 3 Reps' }).fill('8')
  await page.getByRole('textbox', { name: 'Set 3 Reps' }).press('Enter')
  await expect(page.getByRole('textbox', { name: 'Set 3 Reps' })).toHaveValue(
    '8',
  )
  await page.getByRole('button', { name: 'Complete set 3' }).click()
  await page.getByRole('textbox', { name: 'Set 4 Weight' }).fill('160')
  await page.getByRole('textbox', { name: 'Set 4 Reps' }).fill('7')
  await page.getByRole('textbox', { name: 'Set 4 Reps' }).press('Enter')
  await page.getByRole('textbox', { name: 'Set 4 final RIR' }).fill('2')
  await expect(
    page.getByRole('textbox', { name: 'Set 4 Reps' }),
  ).not.toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Complete set 4' }).click()

  await page
    .getByRole('dialog', { name: 'Finish workout?' })
    .getByRole('button', { name: 'Finish Workout' })
    .click()
  await expect(page).toHaveURL(/\/history\?workout=/)
  await expect(page.getByText('Skipped: Audit curl')).toBeVisible()
  await expect(page.getByText('Review')).toHaveCount(0)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Data' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON backup' }).click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(backupPath)

  await page.getByRole('button', { name: 'Clear all data' }).click()
  const clearDialog = page.getByRole('dialog', { name: 'Clear all data?' })
  await clearDialog.getByLabel('Confirmation').fill('DELETE')
  await clearDialog.getByRole('button', { name: 'Delete local data' }).click()
  await expect(clearDialog).not.toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState('load').catch(() => undefined)
  await page.goto('/nutrition')
  await page.getByRole('button', { name: 'Foods', exact: true }).click()
  await expect(page.getByText('No recent foods')).toBeVisible()

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Data' }).click()
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await expect(page.getByLabel('Import preview')).toBeVisible()
  const restoreDialog = page.getByRole('dialog', {
    name: 'Replace local data?',
  })
  await restoreDialog.getByLabel('Confirmation').fill('REPLACE')
  await restoreDialog.getByRole('button', { name: 'Replace data' }).click()
  await expect(restoreDialog).not.toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState('load').catch(() => undefined)
  await page.goto('/history')
  await expect(page.getByRole('button', { name: /Audit A/ })).toBeVisible()
  await page.getByRole('button', { name: /Audit A/ }).click()
  await expect(page.getByRole('heading', { name: 'Audit A' })).toBeVisible()
  await page.getByRole('button', { name: /Audit row/ }).click()
  await expect(page.getByLabel('Exercise notes')).toHaveCount(0)
  await expect(page.getByText('weight_reps')).toHaveCount(0)
  await page.goto('/nutrition')
  await expect(page.getByText(/1.25 cup .* 250 kcal/)).toBeVisible()
})

async function createExercise(page: Page, name: string, rest: string) {
  await waitForExerciseLibrary(page)
  await page.getByLabel('Create exercise').click()
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await fillRestInputs(page, rest)
  await page.getByLabel('Tracking preset').selectOption('weight_reps')
  await page.getByRole('button', { name: 'Save exercise' }).click()
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 })
}

async function addPrescription(
  builder: Locator,
  exerciseName: string,
  sets = '3',
) {
  await builder
    .getByRole('searchbox', { name: 'Search exercises' })
    .fill(exerciseName)
  await builder
    .getByRole('button', { name: new RegExp(exerciseName) })
    .first()
    .click()
  await builder.getByRole('textbox', { name: 'Sets' }).fill(sets)
  const minReps = builder.getByRole('textbox', { name: 'Min reps' })
  if (await minReps.isVisible()) {
    await minReps.fill('5')
    await builder.getByRole('textbox', { name: 'Max reps' }).fill('10')
  }
  await builder.getByRole('button', { name: 'Save prescription' }).click()
  await expect(builder.getByLabel('Prescription editor')).not.toBeVisible({
    timeout: 15_000,
  })
}

async function addWorkoutDay(builder: Locator, name: string) {
  await builder.getByRole('button', { name: 'Add workout day' }).click()
  await builder
    .getByRole('textbox', { name: 'New workout day name' })
    .fill(name)
  await builder.getByRole('button', { name: 'Save workout day' }).click()
}

async function closeBuilder(builder: Locator) {
  await builder.getByRole('button', { name: /^Back from edit/ }).click()
  await expect(builder).not.toBeVisible({ timeout: 15_000 })
}

async function waitForExerciseLibrary(page: Page) {
  const libraryToggle = page.getByRole('button', { name: 'Exercise Library' })
  await expect(libraryToggle).toBeVisible({ timeout: 30_000 })
  if ((await libraryToggle.getAttribute('aria-expanded')) !== 'true') {
    await libraryToggle.click()
  }
  await expect(
    page.getByText('Barbell Bench Press', { exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  })
}

async function fillRestInputs(page: Page, rest: string) {
  const totalSeconds = Number(rest)
  await page
    .getByRole('textbox', { name: 'Rest minutes' })
    .fill(String(Math.floor(totalSeconds / 60)))
  await page
    .getByRole('textbox', { name: 'Rest seconds' })
    .fill(String(totalSeconds % 60))
}

async function dismissSignInPrompt(page: Page) {
  const prompt = page.getByRole('complementary', {
    name: 'Your data stays local',
  })
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: 'Continue offline' }).click()
  await expect(prompt).not.toBeVisible()
}
