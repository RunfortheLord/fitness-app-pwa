# Native iOS Wrapper

The iOS target wraps the existing React application with Capacitor and uses
device-scheduled local notifications for rest-timer completion. The bundled web
application remains local-first and continues to work without a network
connection.

## What Native Notifications Add

- Rest-timer alerts can fire while the app is backgrounded, closed, or the phone
  is locked.
- Starting, pausing, resuming, adding time, subtracting time, dismissing the
  timer, discarding the workout, and finishing the workout all resynchronize or
  cancel the one pending native notification.
- The selected timer sound is bundled as an iOS notification sound.
- Notifications are marked time-sensitive. The user remains in control of
  notification, Focus, sound, and volume settings.
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
7. Select the appropriate development team. If
   `com.adamshugart.fitnesslog` is unavailable, choose a unique bundle
   identifier and keep it stable for future updates.
8. Confirm the **Time Sensitive Notifications** capability and
   `App/App.entitlements` are present.
9. Connect the iPhone, select it as the run destination, and press **Run**.
10. On the phone, allow notifications when the app requests permission.

The native app uses bundled assets, not a remote `server.url`. A web deployment
does not update an installed native build; run `npm run ios:sync` and install a
new Xcode build for each native release.

## Moving Existing PWA Data

The Home Screen PWA and the native wrapper have separate local storage
containers.

1. In the existing PWA, export a JSON backup.
2. Install and open the native app.
3. Restore that JSON backup in the native app.
4. Verify active programs, workout history, nutrition records, and settings
   before deleting the PWA.

## Physical iPhone Timer Test

1. In Settings, enable **Timer completion sound** and tap
   **Enable outside-app timer alerts**.
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
