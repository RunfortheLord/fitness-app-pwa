import { access, readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const requiredFiles = [
  'capacitor.config.ts',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/App/App.entitlements',
  'ios/App/App/Info.plist',
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
  'rest-complete-chime.wav in Resources',
]) {
  if (!projectSource.includes(expected)) {
    throw new Error(`iOS project is missing ${expected}.`)
  }
}

console.log('iOS wrapper structure verified.')
