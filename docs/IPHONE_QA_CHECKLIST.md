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
  `/training`, `/workout`, `/run`, `/history`, and `/settings`.
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

- [ ] Log bodyweight from Home.
- [ ] Log a second bodyweight entry on the same local date and confirm both are retained.
- [ ] Edit the latest selected-date bodyweight entry.
- [ ] Confirm Home current bodyweight, selected-date status, and compact trend update immediately after save.
- [ ] Open Bodyweight Progress from Home.
- [ ] Change 1M, 3M, 6M, and All range controls with touch and keyboard.
- [ ] Tap bodyweight graph points and confirm details remain readable.
- [ ] Create food.
- [ ] Search foods with one character and confirm remote search does not run.
- [ ] Search foods with two or more characters and confirm loading, results, and empty states fit without horizontal scrolling.
- [ ] Select a provider food, adjust serving amount, and confirm calories and macros preview correctly.
- [ ] Confirm grams and mass ounces appear only when a reliable gram weight exists.
- [ ] Open More Results for duplicate provider entries and select an alternate.
- [ ] Create a custom copy of an imported provider food.
- [ ] Log food.
- [ ] Create exercise.
- [ ] Create program.
- [ ] Activate program.
- [ ] Choose a workout day.
- [ ] Start workout.
- [ ] Confirm only one exercise workspace is visible at a time.
- [ ] Navigate exercises with Previous and Next.
- [ ] Enter weight, reps, RIR, and completed status.
- [ ] Confirm RIR appears only on the final programmed set.
- [ ] Confirm per-side exercises label rep values per side and do not double the stored value.
- [ ] Add a set.
- [ ] Confirm an added unprogrammed set does not move the final-set RIR prompt.
- [ ] Replace an exercise.
- [ ] Skip an exercise.
- [ ] Add an exercise during the workout and confirm it appears in exercise navigation.
- [ ] Use the rest timer.
- [ ] Use +30 seconds, -30 seconds, stop, and clear.
- [ ] Confirm subtracting time never creates a negative remaining time.
- [ ] Confirm the timer continues while navigating between exercises.
- [ ] Confirm timer completion feedback appears when browser capabilities allow it.
- [ ] Close the app.
- [ ] Reopen the app.
- [ ] Resume the workout.
- [ ] Discard an active workout from the live workout screen only after the confirmation dialog.
- [ ] Finish workout.
- [ ] Review detected changes.
- [ ] View workout history.
- [ ] Open Run.
- [ ] Confirm no location permission prompt appears before tapping Start Run.
- [ ] Tap Start Run and handle the location permission prompt.
- [ ] Confirm Start Run offers resume or discard when a lifting workout is active.
- [ ] Confirm elapsed time, moving time, distance, current pace, average moving pace, and mile splits remain readable around 390 x 844.
- [ ] Pause and resume a run.
- [ ] Close and reopen the app with an active run and confirm it resumes without fabricated GPS points.
- [ ] Finish a run only after the confirmation dialog.
- [ ] Discard an active run only after the confirmation dialog.
- [ ] View completed run history and confirm splits, walking/rest classification, and GPS-gap labels are readable.
- [ ] Background the installed PWA and confirm any GPS suspension is represented as a limitation/gap rather than claimed continuous tracking.
- [ ] Confirm no route samples appear in console logs or external network requests.
- [ ] Physical-device GPS accuracy, permission, and background-suspension behavior still require this manual iPhone pass.
- [ ] View bodyweight progress history.
- [ ] Open Graphs and confirm Bodyweight is the default graph category.
- [ ] Switch graph categories without horizontal scrolling.

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
- [ ] Log recent, custom, and previously used foods.
- [ ] Confirm remote-only food search states that connectivity is required.
- [ ] Log bodyweight and workout data.
- [ ] Complete a workout.
- [ ] Reconnect.
- [ ] Verify no data was lost.

## Input and Layout

- [ ] Test every numeric keyboard.
- [ ] Drag while editing a numeric set field and confirm it does not accidentally navigate exercises.
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
