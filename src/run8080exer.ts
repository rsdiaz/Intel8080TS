import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Intel8080 } from './core/Intel8080'
import { Bus } from './core/Bus'

const BDOS_ADDR = 0x8000

const bdosRom = new Uint8Array(256)
const w = (addr: number, val: number) => {
  bdosRom[addr - BDOS_ADDR] = val
}

let a = BDOS_ADDR

w(a, 0xf5); a++
w(a, 0xc5); a++
w(a, 0xd5); a++
w(a, 0xe5); a++
w(a, 0x79); a++
w(a, 0xfe); a++
w(a, 0x02); a++
w(a, 0xca); a++
w(a, 0x20); a++
w(a, 0x80); a++
w(a, 0xfe); a++
w(a, 0x09); a++
w(a, 0xca); a++
w(a, 0x30); a++
w(a, 0x80); a++
w(a, 0xe1); a++
w(a, 0xd1); a++
w(a, 0xc1); a++
w(a, 0xf1); a++
w(a, 0xc9); a++

while (a < 0x8020) { w(a, 0); a++ }

w(a, 0x7b); a++
w(a, 0xd3); a++
w(a, 0xff); a++
w(a, 0xe1); a++
w(a, 0xd1); a++
w(a, 0xc1); a++
w(a, 0xf1); a++
w(a, 0xc9); a++

while (a < 0x8030) { w(a, 0); a++ }

w(a, 0xeb); a++
const loopAddr = a
w(a, 0x7e); a++
w(a, 0xfe); a++
w(a, 0x24); a++
w(a, 0xca); a++
w(a, 0x42); a++
w(a, 0x80); a++
w(a, 0xd3); a++
w(a, 0xff); a++
w(a, 0x23); a++
w(a, 0xc3); a++
w(a, loopAddr & 0xff); a++
w(a, (loopAddr >> 8) & 0xff); a++

while (a < 0x8042) { w(a, 0); a++ }

w(a, 0xe1); a++
w(a, 0xd1); a++
w(a, 0xc1); a++
w(a, 0xf1); a++
w(a, 0xc9); a++

while (a < 0x8050) { w(a, 0); a++ }

w(a, 0x76); a++

const cpu = new Intel8080(false)
const bus = new Bus()
cpu.connectBus(bus)
bus.connectCPU(cpu)

const capture = new (class {
  output = ''
  read() { return 0 }
  write(_p: number, v: number) { this.output += String.fromCharCode(v & 0xff) }
})()

bus.connectDeviceToWritePort(0xff, capture)

bus.writeRam(0xc3, 0x0000)
bus.writeRam(0x50, 0x0001)
bus.writeRam(0x80, 0x0002)

bus.writeRam(0xc3, 0x0005)
bus.writeRam(0x00, 0x0006)
bus.writeRam(0x80, 0x0007)

for (let i = 0; i < a - BDOS_ADDR; i++) {
  bus.writeRam(bdosRom[i], BDOS_ADDR + i)
}

const comPath = resolve(process.cwd(), '8080EXER.COM')
const program = readFileSync(comPath)

for (let i = 0; i < program.length; i++) {
  bus.writeRam(program[i], 0x0100 + i)
}

cpu.registers.programCounter = 0x0100

let count = 0
const startTime = Date.now()
let lastPrint = Date.now()

try {
  while (!cpu.halted) {
    cpu.executeNextInstruction()
    count++

    if (count % 500000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const rate = (count / ((Date.now() - startTime) / 1000) / 1000000).toFixed(1)
      process.stderr.write(`[${elapsed}s] ${count.toLocaleString()} insns (${rate}M/s) PC=0x${cpu.registers.programCounter.toString(16)} output_len=${capture.output.length}\n`)
    }
  }
} catch (e: any) {
  console.error(`\nERROR at count ${count}: ${e.message}`)
  console.error(`PC: 0x${cpu.registers.programCounter.toString(16)}`)
  process.exit(1)
}

const elapsed = (Date.now() - startTime) / 1000
process.stderr.write(`\nDone! ${count.toLocaleString()} instructions in ${elapsed.toFixed(1)}s (${(count / elapsed / 1000000).toFixed(1)}M/s)\n`)
console.log('=== 8080EXER OUTPUT ===')
console.log(capture.output)
