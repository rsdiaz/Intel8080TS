import { Bus } from './Bus'

export class Memory {
  private ram: Uint8Array
  private bus: Bus | null

  constructor() {
    this.ram = new Uint8Array(0x10000)
    this.bus = null
  }

  public connectBus(bus: Bus): void {
    this.bus = bus
  }

  public write(value: number, address: number): void {
    this.ram[address & 0xffff] = value & 0xff
  }

  public read(address: number): number {
    return this.ram[address & 0xffff]
  }
}
