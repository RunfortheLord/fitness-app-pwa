# Mac, Xcode, and TestFlight Handoff

Prepared: October 8, 2026

The release uses Capacitor 8.5.3. Its current official requirements are Node.js
22 or newer and Xcode 26 or newer. Apple currently requires iOS uploads to be
built with Xcode 26 or newer and an iOS 26 SDK. Recheck both linked sources on
the day of archive creation.

## 1. Reproduce the native project

Clone or update the release commit on a Mac, then run these commands from the
repository root:

```sh
node --version
xcodebuild -version
xcode-select -p
npm ci
```

Create a git-ignored `.env.local` containing only these public client values:

```text
VITE_PUBLIC_APP_ORIGIN=https://fitness-app-pwa-eight.vercel.app
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_SUPPORT_EMAIL=adamshugart31@gmail.com
```

Do not place the Supabase secret/service-role key, Apple `.p8`, Apple client
secret, OAuth encryption key, Redis values, USDA key, OpenAI key, or any other
server credential in `.env.local`.

Continue with:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run security:check
npm run test
npm run build
npm run test:e2e:prebuilt
npm run ios:sync
npm run ios:verify
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
npm run ios:open
```

`ios:sync` regenerates the ignored native web bundle from the final production
build. Do not archive a clone before running it.

## 2. Inspect the Xcode target

In target **App**:

1. Select the correct Apple Developer team and Automatic signing.
2. Preserve bundle identifier `com.adamshugart.fitnesslog`, marketing version
   `1.0`, and build `1` for the first upload. Increment only the build number
   after an uploaded build.
3. Confirm the **Sign in with Apple** and **Time Sensitive Notifications**
   capabilities and the checked-in entitlements.
4. Confirm the camera, photo-library, when-in-use location, and motion purpose
   strings match actual release behavior.
5. Confirm the app icon, notification sounds, `PrivacyInfo.xcprivacy`,
   `ITSAppUsesNonExemptEncryption = NO`, portrait support, and minimum iOS
   version.
6. Build the Release configuration for **Any iOS Device (arm64)**. Resolve every
   signing, package, privacy-manifest, or required-reason warning before
   archiving.

For a command-line signed archive after the team is selected:

```sh
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/build/Vigorune.xcarchive" \
  archive
```

## 3. Privacy report, validation, and upload

Choose **Product → Archive**. In Organizer:

1. Control-click the archive and choose **Generate Privacy Report**. Save the
   PDF and reconcile it with `APP_STORE_METADATA.md`, App Store Connect privacy
   answers, and the bundled manifest.
2. Inspect the archive and confirm every required third-party SDK privacy
   manifest/signature is present and there are no unexpected tracking domains
   or client-bundled secrets.
3. Choose **Distribute App → App Store Connect → Upload** and run validation.
   Resolve all errors and material warnings before upload.
4. Upload only after the stable-origin preflight passes and the production
   provider credentials/database migration are complete. Uploading to
   TestFlight is authorized by the release plan; submitting for App Review and
   public release are separate approval gates.
5. Record Xcode/iOS SDK versions, release commit, archive checksum, upload/build
   IDs, validation output, and the privacy report in the restricted release
   evidence folder.

After processing, install the exact uploaded build from TestFlight on a
supported physical iPhone and complete every unchecked item in
`IPHONE_QA_CHECKLIST.md`. Capture current screenshots from that signed build
using synthetic data only.

## Current official references

- Capacitor, [Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- Apple, [SDK minimum requirements](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)
- Apple, [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- Apple, [Create your app's privacy report](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)
