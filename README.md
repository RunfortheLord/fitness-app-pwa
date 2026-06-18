# Training Log

Training Log is a local-first fitness tracking PWA under initial development. The app uses React, TypeScript, Vite, React Router, Dexie, and `vite-plugin-pwa`.

## Requirements

- Node.js and npm
- Playwright browser binaries installed with `npx playwright install chromium webkit`

## Setup

```powershell
npm install
npx playwright install chromium webkit
```

## Commands

```powershell
npm run dev
npm run build
npm run preview
npm run typecheck
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:e2e:ui
npm run check
```

`npm run check` runs the noninteractive required checks in sequence: typecheck, lint, format check, unit/component tests, Playwright tests, and build.

## Project Structure

- `src/app`: app bootstrap, router, and PWA registration helpers
- `src/components`: shared presentation components
- `src/db`: Dexie database setup and migrations
- `src/domain`: pure domain utilities
- `src/features`: future feature modules
- `src/hooks`: React hooks
- `src/pages`: route pages
- `src/repositories`: IndexedDB access boundaries
- `src/services`: application services
- `src/styles`: global styles
- `src/test`: test setup
- `src/types`: shared TypeScript types
- `e2e`: Playwright tests
- `public`: PWA assets
- `scripts`: repository scripts
