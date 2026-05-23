import test from 'node:test'
import assert from 'node:assert/strict'

import { Bus } from '../src/core/Bus'

test('writeDevice throws clear error for unconnected port', () => {
  const bus = new Bus()

  assert.throws(
    () => bus.writeDevice(1, 0x41),
    /No write device connected on port 1/
  )
})

test('readDevice throws clear error for unconnected port', () => {
  const bus = new Bus()

  assert.throws(() => bus.readDevice(2), /No read device connected on port 2/)
})
