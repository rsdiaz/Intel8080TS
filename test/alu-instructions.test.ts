import assert from 'node:assert/strict'
import test from 'node:test'

import { Bus } from '../src/core/Bus'
import { Flag, Intel8080 } from '../src/core/Intel8080'

const runSingleInstruction = (
  cpu: Intel8080,
  bus: Bus,
  opcode: number,
  operand?: number
) => {
  const startAddress = 0x2000
  bus.writeRam(opcode, startAddress)
  if (typeof operand === 'number') {
    bus.writeRam(operand, startAddress + 1)
  }
  cpu.registers.programCounter = startAddress
  cpu.executeNextInstruction()
}

const isFlagSet = (cpu: Intel8080, flag: Flag) =>
  (cpu.flags & (1 << flag)) !== 0

test('ADD updates accumulator and flags correctly', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x8f
  cpu.registers.B = 0x81

  runSingleInstruction(cpu, bus, 0x80)

  assert.equal(cpu.registers.A, 0x10)
  assert.equal(isFlagSet(cpu, Flag.C), true)
  assert.equal(isFlagSet(cpu, Flag.A), true)
  assert.equal(isFlagSet(cpu, Flag.Z), false)
  assert.equal(isFlagSet(cpu, Flag.S), false)
  assert.equal(isFlagSet(cpu, Flag.P), false)
})

test('SUB updates accumulator and flags correctly', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x10
  cpu.registers.C = 0x11

  runSingleInstruction(cpu, bus, 0x91)

  assert.equal(cpu.registers.A, 0xff)
  assert.equal(isFlagSet(cpu, Flag.C), true)
  assert.equal(isFlagSet(cpu, Flag.A), true)
  assert.equal(isFlagSet(cpu, Flag.Z), false)
  assert.equal(isFlagSet(cpu, Flag.S), true)
  assert.equal(isFlagSet(cpu, Flag.P), true)
})

test('INR updates ZSP and AC but preserves carry', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.B = 0xff
  cpu.flags |= 1 << Flag.C

  runSingleInstruction(cpu, bus, 0x04)

  assert.equal(cpu.registers.B, 0x00)
  assert.equal(isFlagSet(cpu, Flag.C), true)
  assert.equal(isFlagSet(cpu, Flag.Z), true)
  assert.equal(isFlagSet(cpu, Flag.S), false)
  assert.equal(isFlagSet(cpu, Flag.P), true)
  assert.equal(isFlagSet(cpu, Flag.A), true)
})

test('DCR updates ZSP and AC but preserves carry', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.D = 0x00
  cpu.flags |= 1 << Flag.C

  runSingleInstruction(cpu, bus, 0x15)

  assert.equal(cpu.registers.D, 0xff)
  assert.equal(isFlagSet(cpu, Flag.C), true)
  assert.equal(isFlagSet(cpu, Flag.Z), false)
  assert.equal(isFlagSet(cpu, Flag.S), true)
  assert.equal(isFlagSet(cpu, Flag.P), true)
  assert.equal(isFlagSet(cpu, Flag.A), true)
})
