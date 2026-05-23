import assert from 'node:assert/strict'
import test from 'node:test'

import { Bus } from '../src/core/Bus'
import { Intel8080 } from '../src/core/Intel8080'

const loadAndRunProgram = (cpu: Intel8080, bus: Bus, program: number[]) => {
  const startAddress = 0x2000
  cpu.registers.programCounter = startAddress

  for (const [index, opcode] of program.entries()) {
    bus.writeRam(opcode, startAddress + index)
  }

  while (!cpu.halted) {
    cpu.executeNextInstruction()
  }
}

test('MOV register-to-register copies source value', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  loadAndRunProgram(cpu, bus, [0x06, 0x12, 0x78, 0x76])

  assert.equal(cpu.registers.B, 0x12)
  assert.equal(cpu.registers.A, 0x12)
})

test('MVI and MOV with memory through M register work', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  loadAndRunProgram(cpu, bus, [0x21, 0x00, 0x40, 0x36, 0x9a, 0x7e, 0x76])

  assert.equal(bus.readRam(0x4000), 0x9a)
  assert.equal(cpu.registers.A, 0x9a)
})

test('LXI loads BC, DE, HL and SP register pairs', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  loadAndRunProgram(
    cpu,
    bus,
    [
      0x01, 0x34, 0x12, 0x11, 0xcd, 0xab, 0x21, 0x0e, 0x0f, 0x31, 0x67, 0x45,
      0x76
    ]
  )

  assert.equal(cpu.registers.B, 0x12)
  assert.equal(cpu.registers.C, 0x34)
  assert.equal(cpu.registers.D, 0xab)
  assert.equal(cpu.registers.E, 0xcd)
  assert.equal(cpu.registers.H, 0x0f)
  assert.equal(cpu.registers.L, 0x0e)
  assert.equal(cpu.registers.stackPointer, 0x4567)
})
