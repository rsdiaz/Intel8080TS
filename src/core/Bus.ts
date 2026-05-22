import { Device } from "./Device"
import { Intel8080 } from "./Intel8080"
import { Memory } from "./Memory"

export class Bus {
  private memory: Memory
  private cpu: Intel8080
  private writeDevices: Device[]
  private readDevices: Device[]

  constructor() {
    this.cpu = new Intel8080()
    this.memory = new Memory()
    this.writeDevices = []
    this.readDevices = []
  }

  public connectCPU(cpu: Intel8080) {
    this.cpu = cpu
  }

  public connectMemory(memory: Memory) {
    this.memory = memory
  }

  public connectDeviceToWritePort(port: number, device: Device) {
    this.writeDevices[port] = device
  }

  public writeRam(value: number, address: number) {
    this.memory.write(value, address)
  }

  public readRam(address: number): number {
    return this.memory.read(address)
  }

  public writeDevice(port: number, value: number) {
    this.writeDevices[port].write(port, value)
  }

  public readDevice(port: number) {
    return this.readDevices[port].read(port)
  }

}