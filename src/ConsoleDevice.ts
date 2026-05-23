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
    if (!this.debug) {
      return
    }
    process.stdout.write(`Port ${port} received value ${value}\n`)
  }
}
