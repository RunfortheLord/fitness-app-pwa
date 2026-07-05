import { readFile, writeFile } from 'node:fs/promises'

const packagePath = new URL(
  '../ios/App/CapApp-SPM/Package.swift',
  import.meta.url,
)
const source = await readFile(packagePath, 'utf8')
const normalized = source.replaceAll('\\', '/')

if (normalized !== source) {
  await writeFile(packagePath, normalized)
}
