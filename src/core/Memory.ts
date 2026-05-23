import { Bus } from './Bus'

export class Memory {
  private ram: Uint8Array
  private bus: Bus | null
  private bytesUsed: number

  constructor() {
    this.ram = new Uint8Array(0x10000)
    this.bus = null
    this.bytesUsed = 0
  }

  public connectBus(bus: Bus): void {
    this.bus = bus
  }

  public getBytesUsed(): number {
    return this.bytesUsed
  }

  public write(value: number, address: number): void {
    if (typeof this.ram[address] == 'undefined') {
      this.bytesUsed++
    }
    this.ram[address] = value
  }

  public read(addr: number) {
    if (typeof this.ram[addr] != 'undefined') {
      return this.ram[addr]
    } else {
      return 0x0
    }
  }
}
