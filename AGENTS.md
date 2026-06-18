# Repository Instructions

## Product Scope

- This repository contains a single-user, local-first fitness tracking PWA.
- Binding product requirements live under `docs/`. Read the relevant docs before implementation tasks.
- Do not add unrequested features or broaden first-release scope.
- Do not add accounts, login, backend services, cloud sync, AI recommendations, external food databases, subscriptions, social features, wearable integrations, graphs, adherence scores, e1RM calculations, automatic calorie adjustments, or automatic training progression.
- Ask no product questions when documented behavior is clear. Record unavoidable assumptions in `docs/DECISIONS.md`.

## Technical Direction

- Use React, TypeScript strict mode, Vite, `vite-plugin-pwa`, Dexie over IndexedDB, React Router, Vitest, React Testing Library, Playwright, npm, and mobile-first CSS.
- Do not create a monorepo, backend, server-side rendering path, database server, or large UI framework unless explicitly approved.

## Architecture

- Keep domain logic separate from React presentation components.
- Keep IndexedDB access behind repository or service abstractions.
- Keep calculations in pure TypeScript functions where practical.
- Use explicit domain types and validate imports/external data.
- Preserve historical snapshots. Template edits must never mutate completed workout history.
- Use database migrations for schema changes; do not delete or rename persisted fields without a migration.
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

- Programs never advance automatically; the user manually chooses the workout day.
- Active workouts must survive navigation, refresh, browser close, and installed PWA restart.
- Rest timers must derive remaining time from timestamps.
- Never recommend load, reps, calories, or progression.
- Completing a workout and changing a program are separate operations.
- Detected workout changes must be reviewed individually and are never applied automatically.

## Testing and Completion

- For each behavior change, add or update appropriate unit, component, integration, and end-to-end coverage.
- Test empty and populated database states, persistence after reload, error behavior, applicable migrations, and Chromium plus WebKit where practical.
- Once scripts exist, run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:e2e`, and `npm run build` before declaring completion.
- Do not declare success when a check was skipped. Explain any check that truly cannot run.

## Code Quality and Git

- Inspect existing code before editing.
- Make the smallest coherent change that satisfies the task.
- Avoid unrelated refactors, duplicate abstractions, broad error-swallowing `try/catch` blocks, `any`, and type assertions used only to silence TypeScript.
- Remove temporary debug output and never commit secrets.
- Review the final Git diff, report changed files and checks run.
- Work only inside this repository. Do not rewrite history, force-push, or delete branches without instruction.
- Create focused commits only after checks pass.
- Do not commit the reference video or extracted frames.
