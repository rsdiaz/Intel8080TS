import process from 'node:process'
import readline from 'node:readline'

import { CpuDiagComputer } from './CpuDiagComputer'
import { Intel8080, Flag } from './core/Intel8080'

/**
 * REPL interactivo para inspeccionar y depurar programas 8080.
 *
 * Pensado como un mini-debugger educativo: permite ejecutar paso a paso,
 * poner breakpoints, leer memoria y registros. La sintaxis de comandos
 * sigue convenciones tipo gdb/lldb (en inglés) para facilitar la
 * transferencia de conocimiento a otras herramientas.
 *
 * Uso:
 *   pnpm run repl [ruta/al/programa.COM]
 */

const computer = new CpuDiagComputer(false)
const breakpoints = new Set<number>()
let loadedPath: string | null = null

const args = process.argv.slice(2)
const initialRom = args.find((arg) => !arg.startsWith('--'))

const out = (text: string) => process.stdout.write(text + '\n')

const hex8 = (value: number) =>
  (value & 0xff).toString(16).toUpperCase().padStart(2, '0')

const hex16 = (value: number) =>
  (value & 0xffff).toString(16).toUpperCase().padStart(4, '0')

const parseAddress = (raw: string | undefined): number | null => {
  if (!raw) return null
  const cleaned = raw.replace(/^0x/i, '')
  const value = parseInt(cleaned, 16)
  if (Number.isNaN(value)) return null
  return value & 0xffff
}

const loadRom = (path: string) => {
  try {
    computer.loadProgramFromFile(path, 0x0100)
    computer.setStackPointer(0xf000)
    computer.setProgramCounter(0x0100)
    computer.cpu.halted = false
    loadedPath = path
    out(`Loaded ${path} at 0x0100 (SP=0xF000, PC=0x0100)`)
  } catch (error) {
    out(`Error loading ${path}: ${(error as Error).message}`)
  }
}

if (initialRom) {
  loadRom(initialRom)
}

// ────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────

const cmdHelp = () => {
  out(`
Commands:
  step, s                  Execute one instruction
  run, r                   Execute until HLT or breakpoint
  break <addr>, b <addr>   Set a breakpoint (hex address, e.g. 'b 0x0100')
  break                    List current breakpoints
  unbreak <addr>, ub       Remove a breakpoint
  regs                     Show registers and flags
  mem <addr> [count]       Hex dump (default count = 64 bytes)
  disasm <addr> [count]    Show byte-level layout (default count = 10 instructions)
  load <path>              Load a .COM file at 0x0100
  reset                    Reset CPU registers (memory untouched)
  help, h, ?               Show this help
  quit, q, exit            Exit the REPL

Addresses are hexadecimal (with or without 0x prefix). Counts are decimal.
`)
}

const cmdStep = () => {
  if (computer.isHalted()) {
    out('CPU is halted. Use `reset` to restart.')
    return
  }
  try {
    const result = computer.step()
    out(
      computer.cpu.formatTraceLine(
        result.LastInstructionAddress,
        result.LastInstructionDisassembly,
        result.LastInstructionTicks
      )
    )
    if (computer.isHalted()) {
      out('CPU halted.')
    }
  } catch (error) {
    out(`Error: ${(error as Error).message}`)
  }
}

const cmdRun = () => {
  if (computer.isHalted()) {
    out('CPU is halted. Use `reset` to restart.')
    return
  }
  const MAX_INSTRUCTIONS = 100_000_000
  let count = 0
  while (!computer.isHalted() && count < MAX_INSTRUCTIONS) {
    if (breakpoints.has(computer.cpu.registers.programCounter)) {
      out(
        `Breakpoint hit at 0x${hex16(computer.cpu.registers.programCounter)} (after ${count} instructions)`
      )
      return
    }
    try {
      computer.step()
    } catch (error) {
      out(
        `Error at 0x${hex16(computer.cpu.registers.programCounter)}: ${(error as Error).message}`
      )
      return
    }
    count++
  }
  if (computer.isHalted()) {
    out(`CPU halted after ${count} instructions.`)
  } else {
    out(`Stopped after safety limit of ${MAX_INSTRUCTIONS} instructions.`)
  }
}

const cmdBreak = (rawAddr: string | undefined) => {
  if (!rawAddr) {
    if (breakpoints.size === 0) {
      out('No breakpoints set.')
      return
    }
    out('Active breakpoints:')
    for (const addr of [...breakpoints].sort((a, b) => a - b)) {
      out(`  0x${hex16(addr)}`)
    }
    return
  }
  const addr = parseAddress(rawAddr)
  if (addr === null) {
    out(`Invalid address: ${rawAddr}`)
    return
  }
  breakpoints.add(addr)
  out(`Breakpoint added at 0x${hex16(addr)}`)
}

const cmdUnbreak = (rawAddr: string | undefined) => {
  const addr = parseAddress(rawAddr)
  if (addr === null) {
    out(`Invalid address: ${rawAddr}`)
    return
  }
  if (breakpoints.delete(addr)) {
    out(`Breakpoint removed at 0x${hex16(addr)}`)
  } else {
    out(`No breakpoint at 0x${hex16(addr)}`)
  }
}

const cmdRegs = () => {
  const r = computer.cpu.registers
  const flagChar = (flag: Flag, label: string) =>
    (computer.cpu.flags & (1 << flag)) !== 0 ? label : '.'
  const flags = [
    flagChar(Flag.S, 'S'),
    flagChar(Flag.Z, 'Z'),
    flagChar(Flag.A, 'A'),
    flagChar(Flag.P, 'P'),
    flagChar(Flag.C, 'C')
  ].join('')
  out(`
  A  = 0x${hex8(r.A)}             Flags = [${flags}]   (SZAPC)
  B  = 0x${hex8(r.B)}   C = 0x${hex8(r.C)}    BC = 0x${hex8(r.B)}${hex8(r.C)}
  D  = 0x${hex8(r.D)}   E = 0x${hex8(r.E)}    DE = 0x${hex8(r.D)}${hex8(r.E)}
  H  = 0x${hex8(r.H)}   L = 0x${hex8(r.L)}    HL = 0x${hex8(r.H)}${hex8(r.L)}
  SP = 0x${hex16(r.stackPointer)}        PC = 0x${hex16(r.programCounter)}
  halted = ${computer.cpu.halted}   interrupts = ${computer.cpu.interruptsEnabled ? 'enabled' : 'disabled'}
`)
}

const cmdMem = (rawAddr: string | undefined, rawCount: string | undefined) => {
  const addr = parseAddress(rawAddr)
  if (addr === null) {
    out('Usage: mem <addr> [count]')
    return
  }
  const count = rawCount ? parseInt(rawCount, 10) : 64
  if (Number.isNaN(count) || count <= 0) {
    out(`Invalid count: ${rawCount}`)
    return
  }

  for (let row = 0; row < count; row += 16) {
    const rowAddr = (addr + row) & 0xffff
    const bytes: string[] = []
    const ascii: string[] = []
    for (let i = 0; i < 16 && row + i < count; i++) {
      const byte = computer.bus.readRam((addr + row + i) & 0xffff)
      bytes.push(hex8(byte))
      ascii.push(byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.')
    }
    out(`  0x${hex16(rowAddr)}  ${bytes.join(' ').padEnd(47)}  ${ascii.join('')}`)
  }
}

const cmdDisasm = (
  rawAddr: string | undefined,
  rawCount: string | undefined
) => {
  let addr =
    parseAddress(rawAddr) ?? computer.cpu.registers.programCounter
  const count = rawCount ? parseInt(rawCount, 10) : 10
  if (Number.isNaN(count) || count <= 0) {
    out(`Invalid count: ${rawCount}`)
    return
  }

  for (let i = 0; i < count; i++) {
    const opcode = computer.bus.readRam(addr)
    const length = Intel8080.instructionLength(opcode)
    const bytes: string[] = []
    for (let j = 0; j < length; j++) {
      bytes.push(hex8(computer.bus.readRam((addr + j) & 0xffff)))
    }
    const marker = addr === computer.cpu.registers.programCounter ? '→' : ' '
    out(
      `${marker} 0x${hex16(addr)}: ${bytes.join(' ').padEnd(8)}  (${length} byte${length > 1 ? 's' : ''})`
    )
    addr = (addr + length) & 0xffff
  }
}

const cmdReset = () => {
  const pc = loadedPath ? 0x0100 : 0x0000
  const sp = loadedPath ? 0xf000 : 0xffff
  computer.reset(pc, sp)
  out(`CPU reset (PC=0x${hex16(pc)}, SP=0x${hex16(sp)})`)
}

// ────────────────────────────────────────────────────────────────────
// REPL loop
// ────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '8080> '
})

out('\nIntel8080TS REPL — type `help` for available commands.\n')
cmdHelp()
rl.prompt()

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    rl.prompt()
    return
  }

  const [cmd, ...rest] = trimmed.split(/\s+/)
  const arg1 = rest[0]
  const arg2 = rest[1]

  switch (cmd.toLowerCase()) {
    case 'step':
    case 's':
      cmdStep()
      break
    case 'run':
    case 'r':
      cmdRun()
      break
    case 'break':
    case 'b':
      cmdBreak(arg1)
      break
    case 'unbreak':
    case 'ub':
      cmdUnbreak(arg1)
      break
    case 'regs':
      cmdRegs()
      break
    case 'mem':
    case 'm':
      cmdMem(arg1, arg2)
      break
    case 'disasm':
    case 'd':
      cmdDisasm(arg1, arg2)
      break
    case 'load':
    case 'l':
      if (!arg1) {
        out('Usage: load <path>')
        break
      }
      loadRom(arg1)
      break
    case 'reset':
      cmdReset()
      break
    case 'help':
    case 'h':
    case '?':
      cmdHelp()
      break
    case 'quit':
    case 'q':
    case 'exit':
      rl.close()
      return
    default:
      out(`Unknown command: ${cmd}. Type \`help\` for the list.`)
  }

  rl.prompt()
})

rl.on('close', () => {
  out('\nBye.')
  process.exit(0)
})
