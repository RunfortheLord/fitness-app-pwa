# Vigorune

[![CI](https://github.com/RunfortheLord/fitness-app-pwa/actions/workflows/ci.yml/badge.svg)](https://github.com/RunfortheLord/fitness-app-pwa/actions/workflows/ci.yml)

Vigorune is a local-first fitness tracking PWA and native-store project. The app uses React, TypeScript, Vite, React Router, Dexie, Capacitor, and `vite-plugin-pwa`.

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

The initial static preview host is Vercel. Use `npx` for the deployment CLI;
do not install it globally.

For routine changes that should reach the iPhone Home Screen PWA on the stable
installed origin, run:

```powershell
npm run release:stable
```

This runs the full local check suite and deploys the passing build to the Vercel
production origin. Use preview deployments only for temporary review URLs.

1. Run `npm run build` and verify the output is written to `dist/`.
2. Check authentication with `npx --yes vercel whoami`.
3. If authentication is required, run `npx --yes vercel login` and stop until
   login completes.
4. Confirm the project does not require Vercel Authentication for preview URLs:
   `npx --yes vercel project protection fitness-app-pwa`. If the preview would
   show a Vercel Authentication interstitial, disable SSO deployment protection
   for the preview project with
   `npx --yes vercel project protection disable fitness-app-pwa --sso`.
5. Create a preview deployment with
   `npx --yes vercel deploy --target preview --yes`.
6. Promote an accepted build to the existing production domain with the Vercel
   project workflow so day-to-day phone use stays on one stable origin.
7. Do not attach a new custom domain, enable analytics, add unrelated secrets,
   or add paid services for the preview deployment.

`vercel.json` configures Vercel to run `npm run build`, publish `dist/`, and
serve `index.html` for client-side routes such as `/nutrition`, `/training`,
`/workout`, `/history`, and `/settings`. `/api/*` routes are excluded from the
SPA rewrite so Vercel functions remain reachable.

Food provider routes are:

- `GET /api/foods/search`
- `GET /api/foods/resolve`

Set `USDA_FDC_API_KEY` as a server-only environment variable for local
development, Vercel Preview, and Vercel Production. Do not use a `VITE_` prefix
for this secret. `.env.example` contains a placeholder only; real `.env*` files
remain ignored. If the key is missing, provider routes return a structured
server-configuration error and existing local nutrition logging remains usable.

Provider architecture, licensing, fallback behavior, cache limits, normalized
schema, and security details are documented in `docs/FOOD_PROVIDERS.md`.

The Nutrition screen searches recent, custom, previously used, and eligible
provider foods. Remote provider search is debounced and starts after at least
two normalized characters. Recent foods, custom foods, previously used provider
foods, and historical logs remain available offline from IndexedDB.

Bodyweight logging supports multiple timestamped entries per local date. Home
shows current weight plus a compact trend, and History includes a lightweight
bodyweight graph with 1M, 3M, 6M, and All ranges.

History also includes lightweight estimated one-repetition-maximum graphs for
eligible weighted-repetition exercises. Estimates use completed historical sets
only, apply the Epley formula, plot the highest eligible set per workout, and
are derived at read time without rewriting workout history.

The app is deployed at the origin root to preserve PWA paths and scope:
`/manifest.webmanifest`, `/sw.js`, `/apple-touch-icon.png`, `/icons/icon-192.png`,
`/icons/icon-512.png`, manifest `start_url: "/"`, and manifest `scope: "/"`.
Generated hashed JavaScript and CSS assets can use immutable static caching.
`manifest.webmanifest`, `sw.js`, icons, and `index.html` must remain reachable
without changing their root-relative paths.

The generated Workbox service worker precaches the app shell, hashed build
assets, manifest, and icons for offline launch, and cleans outdated Workbox
caches during updates. User records are stored in IndexedDB, not in
service-worker caches.

Browser-local storage is scoped by origin. Each immutable Vercel preview URL has
its own IndexedDB database, Cache Storage, and installed-PWA identity. Opening a
new preview URL on the phone will not show records created under a different
preview URL. Routine use should stay on the stable production domain for the
same Vercel project, and accepted preview builds should be promoted to that
origin. A service-worker update on the same origin must not clear IndexedDB,
localStorage, or backup data.

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
npm run deploy:preview
npm run deploy:stable
npm run release:stable
```

`npm run check` runs the noninteractive required checks in sequence: typecheck, lint, format check, unit/component tests, Playwright tests, and build.
`npm run release:stable` runs that same check sequence and deploys the result
to the stable Vercel production origin used by the installed PWA.

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
