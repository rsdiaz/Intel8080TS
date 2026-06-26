import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'

import { CaptureDevice } from './CaptureDevice'
import { CpuDiagComputer } from './CpuDiagComputer'
import { disassembleOpcode } from './disassemble'

const PORT = 3000
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')
const ROM_DIR = path.resolve(__dirname, '..', 'roms')
const EXAMPLES_DIR = path.resolve(__dirname, '..', 'roms', 'examples')

const consoleCapture = new CaptureDevice()
const bdosCapture = new CaptureDevice()

const computer = new CpuDiagComputer(false, (char: string) => {
  bdosCapture.write(0xff, char.charCodeAt(0))
})
computer.bus.connectDeviceToWritePort(0x01, consoleCapture)

const breakpoints = new Set<number>()
let programLoaded = false

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
}

const hex8 = (value: number) =>
  (value & 0xff).toString(16).toUpperCase().padStart(2, '0')

const parseHex = (value: string | null): number | null => {
  if (!value) return null
  const cleaned = value.replace(/^0x/i, '')
  const n = parseInt(cleaned, 16)
  return Number.isNaN(n) ? null : n & 0xffff
}

function cpuState() {
  const r = computer.cpu.registers
  return {
    registers: {
      A: r.A,
      B: r.B,
      C: r.C,
      D: r.D,
      E: r.E,
      H: r.H,
      L: r.L,
      stackPointer: r.stackPointer,
      programCounter: r.programCounter
    },
    halted: computer.cpu.halted,
    flags: {
      C: (computer.cpu.flags & 0x01) !== 0,
      P: (computer.cpu.flags & 0x04) !== 0,
      A: (computer.cpu.flags & 0x10) !== 0,
      Z: (computer.cpu.flags & 0x40) !== 0,
      S: (computer.cpu.flags & 0x80) !== 0
    }
  }
}

function fullState() {
  return {
    ...cpuState(),
    breakpoints: [...breakpoints].sort((a, b) => a - b),
    consoleOutput: consoleCapture.output,
    bdosOutput: bdosCapture.output
  }
}

const MAX_BODY_BYTES = 64 * 1024

function collectBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', (err) => reject(err))
  })
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const buf = await collectBody(req)
  try {
    return JSON.parse(buf.toString())
  } catch {
    return null
  }
}

// ─── API handlers ───

function handleState() {
  return JSON.stringify(fullState())
}

function handleStep() {
  if (computer.cpu.halted) {
    return JSON.stringify({ error: 'CPU is halted' })
  }
  const result = computer.cpu.executeNextInstruction()
  return JSON.stringify({
    disassembly: result.LastInstructionDisassembly,
    ticks: result.LastInstructionTicks,
    address: result.LastInstructionAddress,
    state: fullState()
  })
}

function handleRun(body: any) {
  const maxInstructions = body?.maxInstructions ?? 100_000
  let count = 0
  while (!computer.cpu.halted && count < maxInstructions) {
    if (breakpoints.has(computer.cpu.registers.programCounter)) {
      return JSON.stringify({
        instructionsExecuted: count,
        halted: false,
        breakpointHit: computer.cpu.registers.programCounter,
        state: fullState()
      })
    }
    computer.cpu.executeNextInstruction()
    count++
  }
  return JSON.stringify({
    instructionsExecuted: count,
    halted: computer.cpu.halted,
    breakpointHit: null,
    state: fullState()
  })
}

function handleReset(body: any) {
  const defaultPC = programLoaded ? 0x0100 : 0x0000
  const defaultSP = programLoaded ? 0xf000 : 0xffff
  const pc = parseHex(body?.programCounter) ?? defaultPC
  const sp = parseHex(body?.stackPointer) ?? defaultSP
  consoleCapture.output = ''
  bdosCapture.output = ''
  computer.reset(pc, sp)
  return JSON.stringify({ state: fullState() })
}

function handleLoad(body: any, rawAddr: string | null, rawBinary?: Buffer) {
  const addr = parseHex(rawAddr) ?? 0x0100
  let program: number[]

  if (rawBinary) {
    program = [...rawBinary]
  } else if (body?.path) {
    const resolved = path.resolve(process.cwd(), body.path)
    const relative = path.relative(process.cwd(), resolved)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return JSON.stringify({ error: 'Invalid path' })
    }
    program = [...fs.readFileSync(resolved)]
  } else {
    return JSON.stringify({ error: 'No binary data or path provided' })
  }

  consoleCapture.output = ''
  bdosCapture.output = ''
  computer.loadProgram(program, addr)
  computer.setStackPointer(0xf000)
  computer.cpu.halted = false
  programLoaded = true

  return JSON.stringify({
    size: program.length,
    loadAddress: addr,
    state: fullState()
  })
}

function handleMemory(url: URL) {
  const addr = parseHex(url.searchParams.get('addr')) ?? 0x0000
  const count = Math.min(
    parseInt(url.searchParams.get('count') ?? '256', 10) || 256,
    4096
  )
  const bytes: number[] = []
  for (let i = 0; i < count; i++) {
    bytes.push(computer.bus.readRam((addr + i) & 0xffff))
  }
  return JSON.stringify({ address: addr, count, bytes })
}

function handleDisasm(url: URL) {
  let addr =
    parseHex(url.searchParams.get('addr')) ?? (programLoaded ? 0x0100 : 0x0000)
  const count = Math.min(
    parseInt(url.searchParams.get('count') ?? '20', 10) || 20,
    256
  )
  const instructions: {
    address: number
    bytes: number[]
    length: number
    disassembly: string
  }[] = []
  for (let i = 0; i < count; i++) {
    const opcode = computer.bus.readRam(addr)
    const readByte = (offset: number) =>
      computer.bus.readRam((addr + offset) & 0xffff)
    const result = disassembleOpcode(opcode, readByte)
    const length = result?.length ?? 1
    const bytes: number[] = []
    for (let j = 0; j < length; j++) {
      bytes.push(computer.bus.readRam((addr + j) & 0xffff))
    }
    instructions.push({
      address: addr,
      bytes,
      length,
      disassembly: result?.disassembly ?? `; DB 0x${hex8(opcode)}`
    })
    addr = (addr + length) & 0xffff
  }
  return JSON.stringify({ instructions })
}

function handleBreakpoint(body: any) {
  if (!body || body.action === 'clear') {
    breakpoints.clear()
  } else if (body.action === 'set') {
    breakpoints.add((body.address ?? 0) & 0xffff)
  } else if (body.action === 'remove') {
    breakpoints.delete((body.address ?? 0) & 0xffff)
  }
  return JSON.stringify({
    breakpoints: [...breakpoints].sort((a, b) => a - b)
  })
}

function handleBreakpoints() {
  return JSON.stringify({
    breakpoints: [...breakpoints].sort((a, b) => a - b)
  })
}

function handleExamples() {
  const entries: { name: string; path: string }[] = []
  try {
    const files = fs.readdirSync(EXAMPLES_DIR)
    for (const file of files.sort()) {
      if (file.endsWith('.com')) {
        entries.push({
          name: file.replace(/\.com$/, ''),
          path: path.relative(process.cwd(), path.join(EXAMPLES_DIR, file))
        })
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return JSON.stringify({ examples: entries })
}

function handleRoms() {
  const entries: { name: string; path: string }[] = []
  try {
    const files = fs.readdirSync(ROM_DIR)
    for (const file of files.sort()) {
      if (file.endsWith('.com')) {
        entries.push({
          name: file.replace(/\.com$/, ''),
          path: path.relative(process.cwd(), path.join(ROM_DIR, file))
        })
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return JSON.stringify({ roms: entries })
}

// ─── Routing ───

const json = (res: http.ServerResponse, data: string) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(data)
}

const jsonError = (res: http.ServerResponse, status: number, msg: string) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: msg }))
}

type RouteHandler = (
  url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse
) => void | Promise<void>

const routes: Record<string, RouteHandler> = {
  'GET /api/state': (_url, _req, res) => json(res, handleState()),
  'GET /api/breakpoints': (_url, _req, res) => json(res, handleBreakpoints()),
  'GET /api/roms': (_url, _req, res) => json(res, handleRoms()),
  'GET /api/examples': (_url, _req, res) => json(res, handleExamples()),
  'GET /api/memory': (url, _req, res) => json(res, handleMemory(url)),
  'GET /api/disasm': (url, _req, res) => json(res, handleDisasm(url)),

  'POST /api/step': async (_url, _req, res) => {
    try {
      json(res, handleStep())
    } catch (e: any) {
      jsonError(res, 500, e.message)
    }
  },

  'POST /api/run': async (_url, req, res) => {
    try {
      const body = await readJsonBody(req)
      json(res, handleRun(body))
    } catch (e: any) {
      jsonError(res, 500, e.message)
    }
  },

  'POST /api/reset': async (_url, req, res) => {
    try {
      const body = await readJsonBody(req)
      json(res, handleReset(body))
    } catch (e: any) {
      jsonError(res, 500, e.message)
    }
  },

  'POST /api/load': async (url, req, res) => {
    try {
      const ct = req.headers['content-type'] || ''
      if (ct.includes('application/json')) {
        const p = await readJsonBody(req)
        json(res, handleLoad(p, url.searchParams.get('addr')))
      } else {
        const raw = await collectBody(req)
        json(res, handleLoad(null, url.searchParams.get('addr'), raw))
      }
    } catch (e: any) {
      jsonError(res, 500, e.message)
    }
  },

  'POST /api/breakpoint': async (_url, req, res) => {
    try {
      const body = await readJsonBody(req)
      json(res, handleBreakpoint(body))
    } catch (e: any) {
      jsonError(res, 500, e.message)
    }
  }
}

// ─── Server ───

const server = http.createServer((req, res) => {
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`
  )
  const method = req.method || 'GET'
  const routeKey = `${method} ${url.pathname}`

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const handler = routes[routeKey]
  if (handler) {
    handler(url, req, res)
    return
  }

  // Static files
  let filePath = path.join(
    PUBLIC_DIR,
    url.pathname === '/' ? 'index.html' : url.pathname
  )

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  const ext = path.extname(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
})

server.listen(PORT, () => {
  process.stdout.write(
    `Intel8080TS Web Debugger running at http://localhost:${PORT}\n`
  )
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    process.stderr.write(`Port ${PORT} is already in use.\n`)
  } else {
    process.stderr.write(`Server error: ${err.message}\n`)
  }
  process.exitCode = 1
})
