import assert from 'node:assert/strict'
import test from 'node:test'

import { Bus } from '../src/core/Bus'
import { Intel8080 } from '../src/core/Intel8080'

const runSingleInstruction = (
  cpu: Intel8080,
  bus: Bus,
  opcode: number,
  startAddress = 0x2000
) => {
  bus.writeRam(opcode, startAddress)
  cpu.registers.programCounter = startAddress
  cpu.executeNextInstruction()
}

test('PUSH B stores BC on stack and updates SP', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.B = 0x12
  cpu.registers.C = 0x34
  cpu.registers.stackPointer = 0x4000

  runSingleInstruction(cpu, bus, 0xc5)

  assert.equal(cpu.registers.stackPointer, 0x3ffe)
  assert.equal(bus.readRam(0x3fff), 0x12)
  assert.equal(bus.readRam(0x3ffe), 0x34)
})

test('POP D restores DE from stack and updates SP', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  cpu.registers.stackPointer = 0x3ffe
  bus.writeRam(0xab, 0x3fff)
  bus.writeRam(0xcd, 0x3ffe)

  runSingleInstruction(cpu, bus, 0xd1)

  assert.equal(cpu.registers.D, 0xab)
  assert.equal(cpu.registers.E, 0xcd)
  assert.equal(cpu.registers.stackPointer, 0x4000)
})
