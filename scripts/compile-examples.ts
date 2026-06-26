import fs from 'node:fs'
import path from 'node:path'

import { examples } from '../src/examples/data'

const outDir = path.resolve(__dirname, '..', 'roms', 'examples')

fs.mkdirSync(outDir, { recursive: true })

for (const ex of examples) {
  const outPath = path.join(outDir, `${ex.name}.com`)
  fs.writeFileSync(outPath, Buffer.from(ex.bytes))
  process.stdout.write(`Wrote ${outPath} (${ex.bytes.length} bytes)\n`)
}
