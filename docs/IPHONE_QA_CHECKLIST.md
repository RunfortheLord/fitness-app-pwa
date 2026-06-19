# iPhone QA Checklist

Use the HTTPS preview deployment on a physical iPhone. Do not mark these checks
as passed from desktop emulation, Playwright, or simulator testing.

## Deployment Notes

- Static preview host: Vercel.
- Deploy with `npx --yes vercel deploy --target preview --yes` after confirming
  Vercel authentication.
- The HTTPS preview URL must open the app shell directly in Safari, without a
  Vercel Authentication interstitial.
- The production build must output `dist/`.
- Vercel must serve `index.html` for client-side routes such as `/nutrition`,
  `/training`, `/workout`, `/history`, and `/settings`.
- The PWA is intended to run at the deployment origin root so `/sw.js`,
  `/manifest.webmanifest`, `/apple-touch-icon.png`, `/icons/icon-192.png`, and
  `/icons/icon-512.png` keep root scope paths.
- The manifest `start_url` and `scope` are `/`.
- Service-worker cache behavior: the generated Workbox service worker precaches
  the app shell, hashed build assets, manifest, and icons for offline launch. It
  cleans outdated Workbox caches during updates. User fitness records are stored
  in IndexedDB, not service-worker caches.
- Do not attach a custom domain, enable analytics, add secrets, or add paid
  services for this preview.

## Installation

- [ ] Open the HTTPS URL in Safari.
- [ ] Use Share.
- [ ] Select Add to Home Screen.
- [ ] Verify app name.
- [ ] Verify icon.
- [ ] Launch from the home screen.
- [ ] Verify standalone mode.
- [ ] Verify safe areas.
- [ ] Verify no Safari controls appear in standalone mode.

## Core Workflow

- [ ] Log bodyweight.
- [ ] Create food.
- [ ] Log food.
- [ ] Create exercise.
- [ ] Create program.
- [ ] Activate program.
- [ ] Choose a workout day.
- [ ] Start workout.
- [ ] Enter weight, reps, RIR, and completed status.
- [ ] Add a set.
- [ ] Replace an exercise.
- [ ] Skip an exercise.
- [ ] Use the rest timer.
- [ ] Close the app.
- [ ] Reopen the app.
- [ ] Resume the workout.
- [ ] Finish workout.
- [ ] Review detected changes.
- [ ] View history.

## Persistence

- [ ] Close from the app switcher.
- [ ] Reopen.
- [ ] Restart the iPhone.
- [ ] Reopen.
- [ ] Verify all records remain.
- [ ] Verify no duplicate records.

## Offline

- [ ] Open once online.
- [ ] Enable airplane mode.
- [ ] Close and reopen.
- [ ] Log data.
- [ ] Complete a workout.
- [ ] Reconnect.
- [ ] Verify no data was lost.

## Input and Layout

- [ ] Test every numeric keyboard.
- [ ] Test long exercise names.
- [ ] Test scrolling during a workout.
- [ ] Test bottom sheets.
- [ ] Test confirmation dialogs.
- [ ] Test large iOS text.
- [ ] Test dark appearance.
- [ ] Verify no input is hidden by the keyboard.
- [ ] Verify bottom navigation does not overlap content.

## Update

- [ ] Install the current deployment.
- [ ] Deploy a visible version change.
- [ ] Reopen the app.
- [ ] Verify the update notification.
- [ ] Activate the update.
- [ ] Verify user data remains intact.

## Backup

- [ ] Export JSON.
- [ ] Save the file.
- [ ] Import it into a clean test state.
- [ ] Verify record counts and historical details.
