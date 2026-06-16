import { Device } from './core/Device'

export class CaptureDevice implements Device {
  public output = ''

  read(): number {
    return 0
  }

  write(_port: number, value: number): void {
    this.output += String.fromCharCode(value & 0xff)
  }
}
