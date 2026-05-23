import assert from 'node:assert/strict'
import test from 'node:test'

import { Bus } from '../src/core/Bus'
import { Intel8080 } from '../src/core/Intel8080'

const runInstructionAt = (
  cpu: Intel8080,
  bus: Bus,
  startAddress: number,
  bytes: number[]
) => {
  for (const [index, value] of bytes.entries()) {
    bus.writeRam(value, startAddress + index)
  }

  cpu.registers.programCounter = startAddress
  cpu.executeNextInstruction()
}

test('CALL pushes return address and jumps to target', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)
  cpu.registers.stackPointer = 0x5000

  runInstructionAt(cpu, bus, 0x2000, [0xcd, 0x34, 0x12])

  assert.equal(cpu.registers.programCounter, 0x1234)
  assert.equal(cpu.registers.stackPointer, 0x4ffe)
  assert.equal(bus.readRam(0x4fff), 0x20)
  assert.equal(bus.readRam(0x4ffe), 0x03)
})

test('RET pops return address into program counter', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.stackPointer = 0x4ffe
  bus.writeRam(0x20, 0x4fff)
  bus.writeRam(0x03, 0x4ffe)

  runInstructionAt(cpu, bus, 0x1234, [0xc9])

  assert.equal(cpu.registers.programCounter, 0x2003)
  assert.equal(cpu.registers.stackPointer, 0x5000)
})
