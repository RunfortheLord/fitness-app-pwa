# Repository Instructions

## Product Scope

- This repository contains a single-user, local-first fitness tracking PWA.
- Binding product requirements live under `docs/`. Read the relevant docs before implementation tasks.
- The Version 1 scope is frozen in `docs/V1_SCOPE_FREEZE.md`. The temporary
  public-facing product name is **Vigorune**; it is not a persisted or platform
  identifier.
- Do not add unrequested features or broaden first-release scope.
- Version 1 permits local-first offline operation without an account; optional
  Google and Apple authentication; optional cloud snapshot backup; in-app
  account and cloud-data deletion; nutrition and bodyweight tracking; workout
  programs and live workouts; run tracking; provider-backed barcode scanning;
  user-initiated Gemini meal-photo analysis; and public Apple App Store and
  Google Play distribution.
- Accounts must never be required for core features. IndexedDB remains the
  local source of truth, and cloud backup must not become realtime multi-device
  synchronization.
- AI output must be reviewed and explicitly accepted by the user. It must not
  become automatic coaching, automatic logging, or automatic target changes.
- Do not add subscriptions, advertisements, social networking, wearable
  integrations, automatic program advancement, or other unrequested expansion.
- Ask no product questions when documented behavior is clear. Record unavoidable assumptions in `docs/DECISIONS.md`.

## Technical Direction

- Use React, TypeScript strict mode, Vite, `vite-plugin-pwa`, Dexie over IndexedDB, React Router, Vitest, React Testing Library, Playwright, npm, and mobile-first CSS.
- Do not create a monorepo, required backend, server-side rendering path,
  database server, or large UI framework unless explicitly approved. Optional
  provider routes, authentication, snapshot backup, notifications, and
  user-initiated AI integrations must remain narrowly scoped to the approved
  Version 1 behavior.

## Architecture

- Keep domain logic separate from React presentation components.
- Keep IndexedDB access behind repository or service abstractions.
- Keep calculations in pure TypeScript functions where practical.
- Use explicit domain types and validate imports/external data.
- Preserve historical snapshots. Template edits must never mutate completed workout history.
- Use database migrations for schema changes; do not delete or rename persisted fields without a migration.
- A public-name change must not rename the existing bundle/application
  identifiers, IndexedDB database, local-storage keys, persisted IDs, or backup
  format identifiers. Existing installations must retain access to their data.
- Use transactions for multi-record updates.
- Store local calendar dates as `YYYY-MM-DD` strings and timestamps as ISO strings. Treat timezone conversion carefully.
- Prefer `crypto.randomUUID()` for IDs.

## UI

- Design for iPhone portrait first using the video analysis as a pattern reference, not a brand clone.
- Use dark cards, fixed bottom navigation, bottom sheets, clear hierarchy, safe-area insets, semantic HTML, and accessible labels.
- Use at least 44 by 44 CSS-pixel touch targets and input text sizes that avoid unwanted iPhone zoom.
- Avoid horizontal scrolling.
- Include loading, empty, validation, offline, and failure states.

## Workout Rules

- Programs never choose or start a workout day automatically. The user manually
  chooses the workout day; completion-based week selection must not change
  prescriptions or start a workout.
- Active workouts must survive navigation, refresh, browser close, and installed PWA restart.
- Rest timers must derive remaining time from timestamps.
- Do not provide opaque or automatic coaching. Approved deterministic local
  estimates must be user-invoked or opt-in, explainable, editable, and never
  applied to permanent prescriptions or targets without explicit review.
- Completing a workout and changing a program are separate operations.
- Detected workout changes must receive explicit review and are never applied
  automatically. Version 1 uses an unchecked save-all option; leaving it
  unchecked preserves the program unchanged.

## Testing and Completion

- For each behavior change, add or update appropriate tests in proportion to
  risk. Prefer focused unit, component, integration, or end-to-end coverage that
  directly exercises the changed behavior.
- Use targeted checks during development. Examples:
  - Pure docs or process-only changes: review the diff; run formatting only if
    the touched files are covered by a formatter.
  - CSS-only or copy-only UI changes: run `npm run format:check` plus targeted
    component/e2e checks when layout, accessibility, or routing could regress.
  - TypeScript/domain/repository changes: run `npm run typecheck` and the
    affected unit or component tests.
  - IndexedDB schema, migrations, backup/restore, active workout persistence,
    service worker/PWA, or deploy-critical changes: run the relevant focused
    tests first, then the full gate before shipping.
- The full release gate is `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run test`, `npm run test:e2e`, and
  `npm run build`.
- Run the full release gate before deploying to the stable Vercel production
  origin, before high-risk releases, or whenever the user explicitly asks for
  exhaustive validation.
- When the user asks for an app change or update intended for phone/PWA use,
  deploy to the isolated developer-stable PWA with
  `npm run deploy:dev-stable` after the checks selected for the risk level have
  passed.
- Do not deploy to the stable PWA with `npm run deploy:stable` unless the user
  explicitly asks to promote or implement all accumulated update changes on
  stable. Use the full release gate before any stable deployment.
- Use the full release gate for high-risk changes and for changes touching
  deployment, persistence, service workers, or cross-browser behavior.
- In the final response, state which checks were run. If a relevant check was
  skipped by risk-based choice, say so plainly and explain why.

## Code Quality and Git

- Inspect existing code before editing.
- Make the smallest coherent change that satisfies the task.
- Avoid unrelated refactors, duplicate abstractions, broad error-swallowing `try/catch` blocks, `any`, and type assertions used only to silence TypeScript.
- Remove temporary debug output and never commit secrets.
- Review the final Git diff, report changed files and checks run.
- Work only inside this repository. Do not rewrite history, force-push, or delete branches without instruction.
- Create focused commits only after checks pass.
- Do not commit the reference video or extracted frames.
