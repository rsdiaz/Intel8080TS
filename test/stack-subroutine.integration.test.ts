import assert from 'node:assert/strict'
import test from 'node:test'

import { Computer } from '../src/core/Computer'

test('CALL/RET with PUSH/POP preserves registers and returns correctly', () => {
  const computer = new Computer()

  const program = [
    0x31, 0x00, 0x40, 0x06, 0x12, 0xcd, 0x10, 0x20, 0x76, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xc5, 0x06, 0x34, 0xc1, 0xc9
  ]

  computer.loadProgram(program, 0x2000)
  computer.executeProgram()

  assert.equal(computer.getRegisterValue('B'), 0x12)
  assert.equal(computer.getProgramCounter(), 0x2009)
})
