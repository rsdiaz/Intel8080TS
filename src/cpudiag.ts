import process from 'node:process'

import { CpuDiagComputer } from './CpuDiagComputer'

const romPath = process.argv[2] ?? 'roms/CPUDIAG.COM'

process.stdout.write(`\n[Intel8080] Running diagnostic ROM: ${romPath}\n\n`)

const computer = new CpuDiagComputer(false)

try {
  computer.runDiagnostic(romPath)
} catch (error) {
  process.stderr.write(`\n[Intel8080] Diagnostic stopped: ${(error as Error).message}\n`)
  process.exit(1)
}

process.stdout.write('\n\n[Intel8080] Diagnostic finished (CPU halted).\n')
