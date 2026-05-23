import assert from 'node:assert/strict'
import test from 'node:test'

import { Computer } from '../src/core/Computer'

test('JZ and JNZ control program flow as expected', () => {
  const computer = new Computer()

  const program = [
    0x06, 0x01, 0x05, 0xca, 0x0c, 0x20, 0x3e, 0x77, 0xc3, 0x11, 0x20, 0x00,
    0x3e, 0x55, 0xc2, 0x11, 0x20, 0x76
  ]

  computer.loadProgram(program, 0x2000)
  computer.executeProgram()

  assert.equal(computer.getRegisterValue('A'), 0x55)
  assert.equal(computer.getRegisterValue('B'), 0x00)
  assert.equal(computer.getProgramCounter(), 0x2012)
})
