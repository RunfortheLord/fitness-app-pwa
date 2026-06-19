# UI Accessibility Audit

Date: 2026-06-19

## Scope

Reviewed the current PWA against `docs/VIDEO_UI_ANALYSIS.md` and
`docs/UX_SPECIFICATION.md` with a focused pass on the primary flows:

- Home
- Nutrition, food search, food editor, and food logging sheets
- Training, program library, program editor, workout-day selection, exercise library
- Active workout, rest timer, and completion path into History
- History, workout details, and detected-change review
- Settings, backup export, restore preview, and destructive data actions

The pass retained the local-first first-release scope and did not add business
features.

## Findings

- Bottom sheets and confirmation dialogs had Escape handling, but focus was not
  trapped inside the active dialog and focus was not restored to the launcher.
- Sheet close buttons reused a generic accessible name, which did not identify
  the active sheet.
- Some destructive Training actions used native browser confirmations instead
  of the app dialog pattern.
- Dense food, exercise, program, history, and settings rows could become fragile
  at narrow iPhone widths when labels or action clusters were long.
- Numeric totals and timers were readable but did not consistently use tabular
  numeric rendering.
- The hidden restore file input did not have its own accessible name.
- Some visible separators could render inconsistently across encodings.

## Fixes

- Added shared focus management for `BottomSheet` and
  `ModalConfirmationDialog`: initial focus, Tab trapping, Escape close/cancel, and
  focus restoration.
- Updated sheet close accessible names to include the sheet title.
- Replaced Training program activation, program archiving, workout-day removal,
  exercise-prescription removal, and current-workout cancellation prompts with
  app confirmation dialogs.
- Tightened mobile CSS for dense rows, action clusters, text wrapping, settings
  definition lists, dialog actions, and textarea sizing.
- Added reduced-motion handling for surface entry and loading spinner motion.
- Added tabular numeric rendering to prominent metrics and workout timers.
- Labeled the restore JSON file input.
- Replaced decorative middle-dot separators in visible app text with ASCII
  separators.
- Expanded e2e viewport coverage to 390x844, 393x852, 430x932, and 1024x768.
- Added an e2e keyboard check for quick-action sheet focus trapping and Escape
  close behavior.

## Verification

- Manual Playwright viewport sweep at 390x844, 393x852, 430x932, and 1024x768
  across Home, Nutrition, Training, History, and Settings found no horizontal
  overflow and no interactive targets below 44 by 44 CSS pixels.
- Manual Playwright keyboard check confirmed the quick-action sheet keeps Tab
  focus inside the dialog, closes on Escape, and restores focus to the center
  Add button.

## Remaining Physical-Device Checks

- iPhone Safari keyboard behavior for bottom-sheet inputs, especially food
  editor, bodyweight entry, restore confirmation, and clear-data confirmation.
- Installed PWA safe-area behavior around the Dynamic Island and home indicator.
- VoiceOver rotor order and spoken labels on a physical iPhone.
- Real touch ergonomics for dense live-workout set rows during repeated entry.
- Reduced Motion behavior on iOS system settings.
