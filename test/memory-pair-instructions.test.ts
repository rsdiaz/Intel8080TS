import assert from 'node:assert/strict'
import test from 'node:test'

import { Bus } from '../src/core/Bus'
import { Flag, Intel8080 } from '../src/core/Intel8080'

const runInstruction = (
  cpu: Intel8080,
  bus: Bus,
  bytes: number[],
  startAddress = 0x2000
) => {
  for (const [index, byte] of bytes.entries()) {
    bus.writeRam(byte, startAddress + index)
  }

  cpu.registers.programCounter = startAddress
  cpu.executeNextInstruction()
}

test('INX/DCX/DAD work for register pairs and carry', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.B = 0x12
  cpu.registers.C = 0xff
  runInstruction(cpu, bus, [0x03])
  assert.equal(cpu.registers.B, 0x13)
  assert.equal(cpu.registers.C, 0x00)

  runInstruction(cpu, bus, [0x0b])
  assert.equal(cpu.registers.B, 0x12)
  assert.equal(cpu.registers.C, 0xff)

  cpu.registers.H = 0xff
  cpu.registers.L = 0xff
  runInstruction(cpu, bus, [0x09])
  assert.equal(cpu.registers.H, 0x12)
  assert.equal(cpu.registers.L, 0xfe)
  assert.equal((cpu.flags & (1 << Flag.C)) !== 0, true)
})

test('LDA/STA and LHLD/SHLD transfer memory correctly', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x77
  runInstruction(cpu, bus, [0x32, 0x00, 0x40])
  assert.equal(bus.readRam(0x4000), 0x77)

  cpu.registers.A = 0x00
  runInstruction(cpu, bus, [0x3a, 0x00, 0x40])
  assert.equal(cpu.registers.A, 0x77)

  cpu.registers.H = 0x12
  cpu.registers.L = 0x34
  runInstruction(cpu, bus, [0x22, 0x10, 0x40])
  assert.equal(bus.readRam(0x4010), 0x34)
  assert.equal(bus.readRam(0x4011), 0x12)

  cpu.registers.H = 0x00
  cpu.registers.L = 0x00
  runInstruction(cpu, bus, [0x2a, 0x10, 0x40])
  assert.equal(cpu.registers.H, 0x12)
  assert.equal(cpu.registers.L, 0x34)
})

test('LDAX/STAX, XCHG and SPHL work as expected', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.B = 0x40
  cpu.registers.C = 0x20
  cpu.registers.A = 0x9a
  runInstruction(cpu, bus, [0x02])
  assert.equal(bus.readRam(0x4020), 0x9a)

  bus.writeRam(0x5b, 0x4020)
  runInstruction(cpu, bus, [0x0a])
  assert.equal(cpu.registers.A, 0x5b)

  cpu.registers.D = 0x12
  cpu.registers.E = 0x34
  cpu.registers.H = 0xab
  cpu.registers.L = 0xcd
  runInstruction(cpu, bus, [0xeb])
  assert.equal(cpu.registers.D, 0xab)
  assert.equal(cpu.registers.E, 0xcd)
  assert.equal(cpu.registers.H, 0x12)
  assert.equal(cpu.registers.L, 0x34)

  runInstruction(cpu, bus, [0xf9])
  assert.equal(cpu.registers.stackPointer, 0x1234)
})
