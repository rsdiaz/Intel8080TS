import { Bus } from './Bus'
import { Intel8080 } from './Intel8080'
import { Memory } from './Memory'

export class Computer {
  private cpu: Intel8080
  private memory: Memory
  public bus: Bus

  constructor(debug = false) {
    this.cpu = new Intel8080(debug)
    this.memory = new Memory()
    this.bus = new Bus()

    this.cpu.connectBus(this.bus)
    this.bus.connectCPU(this.cpu)

    this.memory.connectBus(this.bus)
    this.bus.connectMemory(this.memory)
  }

  public loadProgram(program: number[], startAddress: number = 0x2000) {
    for (let i = 0; i < program.length; i++) {
      this.bus.writeRam(program[i], startAddress + i)
    }
    this.cpu.registers.programCounter = startAddress

    return this.memory.getBytesUsed()
  }

  public getProgramCounter() {
    return this.cpu.registers.programCounter
  }

  public getRegisterValue(register: keyof Intel8080['registers']) {
    return this.cpu.registers[register]
  }

  public executeProgram() {
    while (!this.cpu.halted) {
      this.cpu.executeNextInstruction()
    }
  }
}
