import test from 'node:test'
import assert from 'node:assert/strict'

import { Computer } from '../src/core/Computer'

test('executeProgram runs from loadProgram startAddress', () => {
  const computer = new Computer()
  computer.loadProgram([0x76], 0x3000)

  computer.executeProgram()

  assert.equal(computer.getProgramCounter(), 0x3001)
})
