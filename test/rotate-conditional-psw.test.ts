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

test('Rotate and carry instructions mutate A/carry correctly', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x81
  runInstruction(cpu, bus, [0x07])
  assert.equal(cpu.registers.A, 0x03)
  assert.equal((cpu.flags & (1 << Flag.C)) !== 0, true)

  runInstruction(cpu, bus, [0x0f])
  assert.equal(cpu.registers.A, 0x81)

  runInstruction(cpu, bus, [0x37])
  assert.equal((cpu.flags & (1 << Flag.C)) !== 0, true)

  runInstruction(cpu, bus, [0x3f])
  assert.equal((cpu.flags & (1 << Flag.C)) !== 0, false)
})

test('Conditional jumps/calls/returns use carry condition', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.flags |= 1 << Flag.C
  runInstruction(cpu, bus, [0xda, 0x34, 0x12])
  assert.equal(cpu.registers.programCounter, 0x1234)

  cpu.registers.stackPointer = 0x5000
  runInstruction(cpu, bus, [0xdc, 0x78, 0x56], 0x3000)
  assert.equal(cpu.registers.programCounter, 0x5678)
  assert.equal(cpu.registers.stackPointer, 0x4ffe)

  bus.writeRam(0x03, 0x4ffe)
  bus.writeRam(0x30, 0x4fff)
  runInstruction(cpu, bus, [0xd8], 0x5678)
  assert.equal(cpu.registers.programCounter, 0x3003)
})

test('PUSH/POP PSW preserves accumulator and flags', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x5a
  cpu.flags = 0
  cpu.flags |= 1 << Flag.C
  cpu.flags |= 1 << Flag.Z
  cpu.registers.stackPointer = 0x4000

  runInstruction(cpu, bus, [0xf5])

  cpu.registers.A = 0x00
  cpu.flags = 0
  runInstruction(cpu, bus, [0xf1], 0x2001)

  assert.equal(cpu.registers.A, 0x5a)
  assert.equal((cpu.flags & (1 << Flag.C)) !== 0, true)
  assert.equal((cpu.flags & (1 << Flag.Z)) !== 0, true)
})
