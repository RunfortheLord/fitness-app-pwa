# Fitness Log

Fitness Log is a local-first fitness tracking PWA under initial development. The app uses React, TypeScript, Vite, React Router, Dexie, and `vite-plugin-pwa`.

## Requirements

- Node.js and npm
- Playwright browser binaries installed with `npx playwright install chromium webkit`

## Setup

```powershell
npm install
npx playwright install chromium webkit
```

## Development

```powershell
npm run dev
```

The development server is for local implementation work only. Service-worker
behavior is validated from the production build because Vite's dev server does
not exercise the generated production service worker.

## Production Build

```powershell
npm run build
```

The build output is written to `dist/`. It includes the web manifest, generated
service worker, precache manifest, application shell, static assets, PWA icons,
and Apple touch icon.

## Local Preview

```powershell
npm run preview
```

Preview serves the production build at Vite's preview URL. The Playwright suite
also runs against production preview through `npm run test:e2e`.

## Deployment

1. Run `npm run build`.
2. Deploy the contents of `dist/` to a static HTTPS host.
3. Configure the host to serve `index.html` for app routes such as `/nutrition`,
   `/training`, `/workout`, `/history`, and `/settings`.
4. Serve generated assets, `manifest.webmanifest`, `sw.js`, icons, and hashed
   JavaScript/CSS files with normal static-file caching.
5. Do not add API, account, sync, analytics, or network-only dependencies to core
   workflows.

## Installing From Safari

1. Open the deployed HTTPS URL in Safari on iPhone while online.
2. Tap Share.
3. Tap Add to Home Screen.
4. Keep the suggested Fitness name or edit it.
5. Launch Fitness from the Home Screen.

After the first online launch and service-worker installation, the app shell and
static assets are cached for later offline use. Desktop browser emulation is not
equivalent to physical iPhone testing; final acceptance still needs the
documented physical iPhone checks.

## Updating the PWA

1. Deploy a new production build.
2. Open or return to the installed app while online.
3. When the app shows Update available, finish any active logging first.
4. Tap Update now.
5. The app will activate the confirmed update and reopen the app shell. If it
   does not reopen automatically, close the installed app and open it again from
   the Home Screen.

The service worker cleans obsolete Workbox caches. User records are not stored in
service-worker caches; they remain in IndexedDB.

## Exporting a Backup

1. Open Settings.
2. Tap Export JSON backup.
3. Save or share the downloaded `.json` file locally.

JSON is the full-fidelity backup format. CSV export is available for spreadsheet
review but is not importable.

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

## Local Data Management

Settings includes nutrition targets, app/schema version metadata, JSON backup,
replace-only JSON restore with preview, CSV export, and clear-all data. JSON is
the full-fidelity restore format. CSV export is a readable TAR archive for
spreadsheet analysis and is not importable.

All file operations remain local to the device. The app does not upload backups,
create cloud copies, or require an account. See `docs/BACKUP_FORMAT.md` for the
backup format, compatibility behavior, CSV file list, restore limits, and
clear-all behavior.
