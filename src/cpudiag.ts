import process from 'node:process'

import { CpuDiagComputer } from './CpuDiagComputer'

const args = process.argv.slice(2)
const trace = args.includes('--trace')
const romPath = args.find((arg) => !arg.startsWith('--')) ?? 'roms/CPUDIAG.COM'

process.stdout.write(`\n[Intel8080] Running diagnostic ROM: ${romPath}\n`)
if (trace) {
  process.stdout.write('[Intel8080] Trace mode enabled (stderr)\n')
}
process.stdout.write('\n')

const computer = new CpuDiagComputer(trace)

try {
  computer.runDiagnostic(romPath)
} catch (error) {
  process.stderr.write(
    `\n[Intel8080] Diagnostic stopped: ${(error as Error).message}\n`
  )
  process.exit(1)
}

process.stdout.write('\n\n[Intel8080] Diagnostic finished (CPU halted).\n')
