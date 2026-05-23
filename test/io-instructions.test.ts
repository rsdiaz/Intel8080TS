import assert from 'node:assert/strict'
import test from 'node:test'

import { Bus } from '../src/core/Bus'
import { Device } from '../src/core/Device'
import { Intel8080 } from '../src/core/Intel8080'

class InputDeviceStub implements Device {
  constructor(private readonly value: number) {}

  read(): number {
    return this.value
  }

  write(): void {
    throw new Error('write should not be called for InputDeviceStub')
  }
}

class OutputDeviceSpy implements Device {
  public writes: Array<{ port: number; value: number }> = []

  read(): number {
    throw new Error('read should not be called for OutputDeviceSpy')
  }

  write(port: number, value: number): void {
    this.writes.push({ port, value })
  }
}

test('IN reads from bus device and stores value in accumulator', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  const inputDevice = new InputDeviceStub(0xab)
  bus.connectDeviceToReadPort(0x02, inputDevice)

  bus.writeRam(0xdb, 0x2000)
  bus.writeRam(0x02, 0x2001)
  cpu.registers.programCounter = 0x2000

  cpu.executeNextInstruction()

  assert.equal(cpu.registers.A, 0xab)
  assert.equal(cpu.registers.programCounter, 0x2002)
})

test('IN then OUT forwards input byte to output device', () => {
  const cpu = new Intel8080()
  const bus = new Bus()
  cpu.connectBus(bus)
  bus.connectCPU(cpu)

  const inputDevice = new InputDeviceStub(0x41)
  const outputDevice = new OutputDeviceSpy()
  bus.connectDeviceToReadPort(0x02, inputDevice)
  bus.connectDeviceToWritePort(0x01, outputDevice)

  const program = [0xdb, 0x02, 0xd3, 0x01, 0x76]
  for (const [index, opcode] of program.entries()) {
    bus.writeRam(opcode, 0x2100 + index)
  }

  cpu.registers.programCounter = 0x2100
  while (!cpu.halted) {
    cpu.executeNextInstruction()
  }

  assert.equal(cpu.registers.A, 0x41)
  assert.deepEqual(outputDevice.writes, [{ port: 0x01, value: 0x41 }])
})
