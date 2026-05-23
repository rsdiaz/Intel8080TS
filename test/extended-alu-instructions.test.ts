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

const isFlagSet = (cpu: Intel8080, flag: Flag) =>
  (cpu.flags & (1 << flag)) !== 0

test('ADC and SBB include carry/borrow input', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x10
  cpu.registers.B = 0x0f
  cpu.flags |= 1 << Flag.C
  runInstruction(cpu, bus, [0x88])
  assert.equal(cpu.registers.A, 0x20)

  cpu.registers.C = 0x01
  cpu.flags |= 1 << Flag.C
  runInstruction(cpu, bus, [0x99])
  assert.equal(cpu.registers.A, 0x1e)
})

test('Immediate ALU opcodes mutate accumulator as expected', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x20
  runInstruction(cpu, bus, [0xc6, 0x10])
  assert.equal(cpu.registers.A, 0x30)

  cpu.flags |= 1 << Flag.C
  runInstruction(cpu, bus, [0xce, 0x01])
  assert.equal(cpu.registers.A, 0x32)

  runInstruction(cpu, bus, [0xd6, 0x02])
  assert.equal(cpu.registers.A, 0x30)

  cpu.flags |= 1 << Flag.C
  runInstruction(cpu, bus, [0xde, 0x01])
  assert.equal(cpu.registers.A, 0x2e)

  runInstruction(cpu, bus, [0xe6, 0x0f])
  assert.equal(cpu.registers.A, 0x0e)
  assert.equal(isFlagSet(cpu, Flag.C), false)

  runInstruction(cpu, bus, [0xee, 0x03])
  assert.equal(cpu.registers.A, 0x0d)

  runInstruction(cpu, bus, [0xf6, 0x80])
  assert.equal(cpu.registers.A, 0x8d)
})

test('CMP and CPI update flags without modifying accumulator', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.A = 0x22
  cpu.registers.D = 0x22
  runInstruction(cpu, bus, [0xba])
  assert.equal(cpu.registers.A, 0x22)
  assert.equal(isFlagSet(cpu, Flag.Z), true)

  runInstruction(cpu, bus, [0xfe, 0x30])
  assert.equal(cpu.registers.A, 0x22)
  assert.equal(isFlagSet(cpu, Flag.C), true)
})
