import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'electron', 'icons')
const outPath = join(outDir, 'icon.png')
const svgPath = join(root, 'public', 'logo-mypay.svg')

// Match logo rounded-rect fill #0D1B5A
const BG = { r: 13, g: 27, b: 90, alpha: 1 }

await mkdir(outDir, { recursive: true })
await sharp(svgPath)
  .resize(1024, 1024, { fit: 'contain', background: BG })
  .png()
  .toFile(outPath)

console.log('Wrote', outPath)
