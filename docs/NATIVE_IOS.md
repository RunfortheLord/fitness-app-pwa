# Native iOS Wrapper

The iOS target wraps the existing React application with Capacitor and uses
device-scheduled local notifications for rest-timer completion. The bundled web
application remains local-first and continues to work without a network
connection.

## Version 1 Distribution Scope

- Public Apple App Store distribution is approved for Version 1. The existing
  wrapper documentation primarily describes development signing and is not, by
  itself, evidence of App Store readiness.
- **Vigorune** is a temporary display name. Store metadata or a later naming
  decision must not rename the existing bundle identifier
  `com.adamshugart.fitnesslog`, IndexedDB database, local-storage keys,
  persisted IDs, or backup-format identifiers.
- Store builds must retain full offline use without an account. Optional
  Google/Apple authentication, cloud backup, and account/cloud-data deletion
  must not weaken local data integrity.
- Public release requires separate signing, entitlement, privacy disclosure,
  upgrade, backup/restore, and physical-device validation.

## What Native Notifications Add

- Rest-timer alerts can fire while the app is backgrounded, closed, or the phone
  is locked.
- Starting, pausing, resuming, adding time, subtracting time, dismissing the
  timer, discarding the workout, and finishing the workout all resynchronize or
  cancel the one pending native notification.
- The default iOS notification alert sound is used. The user controls sound,
  volume, Focus, and notification presentation in iPhone Settings.
- Notifications are marked time-sensitive. The user remains in control of
  notification, Focus, sound, and volume settings.
- Foreground notifications use banner and sound presentation without adding a
  separate Notification Center list entry. Delivered timer entries from older
  app versions are removed when the app next synchronizes the timer.
- Normal local notifications cannot override lowered system volume. Critical
  Alerts are not used.

## Build Requirements

The web application and iOS project can be prepared on Windows. Building,
signing, and installing the iOS application requires:

- macOS
- a current Xcode installation
- Node.js and npm
- an Apple ID configured in Xcode
- an iPhone enabled for development

## Build and Install

1. Clone or copy the repository to the Mac.
2. Run `npm install`.
3. Run `npm run ios:sync`.
4. Run `npm run ios:verify`.
5. Run `npm run ios:open`.
6. In Xcode, select the `App` target and open **Signing & Capabilities**.
7. Select the appropriate development team and retain
   `com.adamshugart.fitnesslog`. If that identifier cannot be signed, stop and
   resolve ownership instead of changing the compatibility identifier during
   Version 1 work.
8. Confirm the **Sign in with Apple** and **Time Sensitive Notifications** capabilities and
   `App/App.entitlements` are present.
9. Connect the iPhone, select it as the run destination, and press **Run**.
10. On the phone, allow notifications when the app requests permission.

The native app uses bundled assets, not a remote `server.url`. A web deployment
does not update an installed native build; run `npm run ios:sync` and install a
new Xcode build for each native release.

The native wrapper disables iOS Shake to Undo inside this app. Running motion
otherwise repeatedly triggers the system "Undo Typing" dialog after any recent
text entry. This native setting does not control Safari or a Home Screen PWA;
those surfaces follow the iPhone's system Shake to Undo setting.

`Info.plist` contains camera, when-in-use location, and motion usage
descriptions for barcode/meal capture, outdoor GPS, and treadmill sensing. No
permission is requested until the user explicitly starts the related feature.
The fixed `vigorune://auth-complete` URL scheme returns system-browser OAuth to
the native app; authentication codes continue through the one-time PKCE relay.
See `docs/STORE_RELEASE_SETUP.md` for external Apple and Supabase setup.

## Moving Existing PWA Data

The Home Screen PWA and the native wrapper have separate local storage
containers.

1. In the existing PWA, export a JSON backup.
2. Install and open the native app.
3. Restore that JSON backup in the native app.
4. Verify active programs, workout history, nutrition records, and settings
   before deleting the PWA.

## Physical iPhone Timer Test

1. In Settings, tap **Enable outside-app timer alerts**, then tap
   **Test iPhone alert** and confirm the iPhone notification alert plays.
2. Start a workout with at least two sets and complete the first set.
3. Confirm the rest timer is running, then return to the iPhone Home Screen.
4. Verify a sound and notification arrive at expiry.
5. Repeat with the phone locked.
6. Repeat after pausing and resuming.
7. Repeat after adding and subtracting 30 seconds; only the latest scheduled
   time should alert.
8. Dismiss a timer and confirm no alert arrives.
9. Discard and finish workouts with active timers and confirm no stale alert
   arrives.
