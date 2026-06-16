import process from 'node:process'

import { Device } from './core/Device'

export class ConsoleDevice implements Device {
  private debug: boolean

  constructor(debug = false) {
    this.debug = debug
  }

  read(port: number): number {
    throw new Error(`Read device not implemented for port ${port}`)
  }

  write(port: number, value: number): void {
    process.stdout.write(String.fromCharCode(value & 0xff))
    if (this.debug) {
      process.stderr.write(`\n[ConsoleDevice] port=${port} value=0x${value.toString(16)}\n`)
    }
  }
}
