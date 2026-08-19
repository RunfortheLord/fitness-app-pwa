import { access, readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const requiredFiles = [
  'capacitor.config.ts',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/App/App.entitlements',
  'ios/App/App/Info.plist',
  'ios/App/App/PrivacyInfo.xcprivacy',
  'ios/App/App/es.lproj/InfoPlist.strings',
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  'ios/App/App/rest-complete-chime.wav',
  'ios/App/CapApp-SPM/Package.swift',
]

await Promise.all(requiredFiles.map((path) => access(new URL(path, root))))

const packageSource = await readFile(
  new URL('ios/App/CapApp-SPM/Package.swift', root),
  'utf8',
)
if (packageSource.includes('\\')) {
  throw new Error('Capacitor Swift package paths still contain backslashes.')
}
if (!packageSource.includes('CapacitorLocalNotifications')) {
  throw new Error('Capacitor Local Notifications Swift package is missing.')
}

const projectSource = await readFile(
  new URL('ios/App/App.xcodeproj/project.pbxproj', root),
  'utf8',
)
for (const expected of [
  'App/App.entitlements',
  'PrivacyInfo.xcprivacy in Resources',
  'InfoPlist.strings in Resources',
  'rest-complete-chime.wav in Resources',
  'PRODUCT_BUNDLE_IDENTIFIER = com.adamshugart.fitnesslog;',
  'MARKETING_VERSION = 1.0;',
  'CURRENT_PROJECT_VERSION = 1;',
  'TARGETED_DEVICE_FAMILY = 1;',
]) {
  if (!projectSource.includes(expected)) {
    throw new Error(`iOS project is missing ${expected}.`)
  }
}

const infoPlistSource = await readFile(
  new URL('ios/App/App/Info.plist', root),
  'utf8',
)
for (const expected of [
  '<key>ITSAppUsesNonExemptEncryption</key>',
  '<key>NSCameraUsageDescription</key>',
  '<key>NSLocationWhenInUseUsageDescription</key>',
  '<key>NSMotionUsageDescription</key>',
  '<string>vigorune</string>',
]) {
  if (!infoPlistSource.includes(expected)) {
    throw new Error(`iOS Info.plist is missing ${expected}.`)
  }
}

const privacyManifestSource = await readFile(
  new URL('ios/App/App/PrivacyInfo.xcprivacy', root),
  'utf8',
)
for (const expected of [
  '<key>NSPrivacyTracking</key>',
  '<key>NSPrivacyCollectedDataTypes</key>',
  'NSPrivacyCollectedDataTypeHealth',
  'NSPrivacyCollectedDataTypeFitness',
  'NSPrivacyCollectedDataTypePhotosorVideos',
]) {
  if (!privacyManifestSource.includes(expected)) {
    throw new Error(`iOS privacy manifest is missing ${expected}.`)
  }
}

const entitlementsSource = await readFile(
  new URL('ios/App/App/App.entitlements', root),
  'utf8',
)
for (const expected of [
  'com.apple.developer.applesignin',
  'com.apple.developer.usernotifications.time-sensitive',
]) {
  if (!entitlementsSource.includes(expected)) {
    throw new Error(`iOS entitlements are missing ${expected}.`)
  }
}

const spanishInfoSource = await readFile(
  new URL('ios/App/App/es.lproj/InfoPlist.strings', root),
  'utf8',
)
for (const expected of [
  'NSCameraUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSMotionUsageDescription',
]) {
  if (!spanishInfoSource.includes(expected)) {
    throw new Error(`Spanish iOS permission copy is missing ${expected}.`)
  }
}

const appIcon = await readFile(
  new URL(
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
    root,
  ),
)
const pngSignature = '89504e470d0a1a0a'
if (appIcon.subarray(0, 8).toString('hex') !== pngSignature) {
  throw new Error('The iOS App Store icon is not a valid PNG.')
}
if (appIcon.readUInt32BE(16) !== 1024 || appIcon.readUInt32BE(20) !== 1024) {
  throw new Error('The iOS App Store icon must be 1024 by 1024 pixels.')
}

console.log('iOS wrapper structure verified.')
