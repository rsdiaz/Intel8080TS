import assert from 'node:assert/strict'
import test from 'node:test'

import { Flag, Intel8080 } from '../src/core/Intel8080'
import { Bus } from '../src/core/Bus'

const runSingleInstruction = (
  cpu: Intel8080,
  bus: Bus,
  opcode: number,
  lowByte: number,
  highByte: number,
  startAddress = 0x2000
) => {
  bus.writeRam(opcode, startAddress)
  bus.writeRam(lowByte, startAddress + 1)
  bus.writeRam(highByte, startAddress + 2)
  cpu.registers.programCounter = startAddress
  cpu.executeNextInstruction()
}

test('JMP always jumps to target address', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  runSingleInstruction(cpu, bus, 0xc3, 0x34, 0x12)

  assert.equal(cpu.registers.programCounter, 0x1234)
})

test('JZ jumps when zero flag is set', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)
  cpu.flags |= 1 << Flag.Z

  runSingleInstruction(cpu, bus, 0xca, 0x78, 0x56)

  assert.equal(cpu.registers.programCounter, 0x5678)
})

test('JZ does not jump when zero flag is clear', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)
  cpu.flags &= ~(1 << Flag.Z)

  runSingleInstruction(cpu, bus, 0xca, 0x78, 0x56)

  assert.equal(cpu.registers.programCounter, 0x2003)
})

test('JNZ jumps when zero flag is clear', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)
  cpu.flags &= ~(1 << Flag.Z)

  runSingleInstruction(cpu, bus, 0xc2, 0xbc, 0x9a)

  assert.equal(cpu.registers.programCounter, 0x9abc)
})

test('JNZ does not jump when zero flag is set', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)
  cpu.flags |= 1 << Flag.Z

  runSingleInstruction(cpu, bus, 0xc2, 0xbc, 0x9a)

  assert.equal(cpu.registers.programCounter, 0x2003)
})
