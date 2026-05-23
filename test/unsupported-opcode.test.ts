import test from 'node:test'
import assert from 'node:assert/strict'

import { Intel8080 } from '../src/core/Intel8080'
import { Bus } from '../src/core/Bus'

test('throws unsupported opcode with opcode and address context', () => {
  const cpu = new Intel8080()
  const bus = new Bus()

  cpu.connectBus(bus)
  bus.connectCPU(cpu)
  bus.writeRam(0xff, 0x2000)
  cpu.registers.programCounter = 0x2000

  assert.throws(
    () => cpu.executeNextInstruction(),
    /Opcode no soportado: 0xFF en 0x2000/
  )
})
