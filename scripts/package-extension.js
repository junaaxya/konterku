import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rootDir = path.resolve(__dirname, "..")
const extensionDir = path.join(rootDir, "extension-android-bank")
const outDir = path.join(rootDir, "dist-extension")

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const manifestPath = path.join(extensionDir, "manifest.json")
if (!fs.existsSync(manifestPath)) {
  console.error("Error: manifest.json not found in extension-android-bank")
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
console.log(`Packaging ${manifest.name} v${manifest.version} for Firefox Android...`)

const zipName = `konterku-bank-connector-v${manifest.version}.xpi`
const zipPath = path.join(outDir, zipName)

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath)
}

try {
  execSync(`cd "${extensionDir}" && zip -q -r "${zipPath}" . -x "*.DS_Store"`, {
    stdio: "inherit",
  })
  const size = fs.statSync(zipPath).size
  console.log(`Successfully built Firefox Android XPI add-on:`)
  console.log(`  Output: ${zipPath}`)
  console.log(`  Size: ${size} bytes`)
} catch (err) {
  console.error("Failed to create zip/xpi archive:", err.message)
  process.exit(1)
}
