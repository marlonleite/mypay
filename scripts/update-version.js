import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Lê o package.json para pegar a versão
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))

// Cria o objeto de versão
const versionInfo = {
  version: packageJson.version,
  buildTime: new Date().toISOString()
}

// Escreve no public/version.json
const versionPath = path.join(__dirname, '..', 'public', 'version.json')
fs.writeFileSync(versionPath, JSON.stringify(versionInfo, null, 2))

console.log(`✅ Version updated to ${versionInfo.version} at ${versionInfo.buildTime}`)
