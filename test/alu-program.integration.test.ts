import assert from 'node:assert/strict'
import test from 'node:test'

import { Computer } from '../src/core/Computer'

test('ALU mini program reaches expected accumulator and program counter', () => {
  const computer = new Computer()

  const program = [0x3e, 0x0a, 0x06, 0x03, 0x80, 0x05, 0x90, 0x76]

  computer.loadProgram(program, 0x2200)
  computer.executeProgram()

  assert.equal(computer.getRegisterValue('A'), 0x0b)
  assert.equal(computer.getRegisterValue('B'), 0x02)
  assert.equal(computer.getProgramCounter(), 0x2208)
})
