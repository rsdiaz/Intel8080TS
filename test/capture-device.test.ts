import assert from 'node:assert/strict'
import test from 'node:test'

import { CaptureDevice } from '../src/CaptureDevice'

test('CaptureDevice accumulates characters written to it', () => {
  const device = new CaptureDevice()
  device.write(0x01, 0x41)
  device.write(0x01, 0x42)
  device.write(0x01, 0x43)
  assert.equal(device.output, 'ABC')
})

test('CaptureDevice read returns 0', () => {
  const device = new CaptureDevice()
  assert.equal(device.read(), 0)
})

test('CaptureDevice masks values to 8 bits', () => {
  const device = new CaptureDevice()
  device.write(0x01, 0x141)
  assert.equal(device.output, 'A')
})
