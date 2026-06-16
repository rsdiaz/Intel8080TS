import { Bus } from './Bus'
import { Intel8080 } from './Intel8080'
import { Memory } from './Memory'
import fs from 'node:fs'

export class Computer {
  public readonly cpu: Intel8080
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

  public loadProgram(program: number[] | Uint8Array, startAddress: number = 0x2000) {
    for (let i = 0; i < program.length; i++) {
      this.bus.writeRam(program[i], startAddress + i)
    }
    this.cpu.registers.programCounter = startAddress
  }

  public loadProgramFromFile(path: string, startAddress: number = 0x0100) {
    const buffer = fs.readFileSync(path)
    this.loadProgram(buffer, startAddress)
  }

  public setStackPointer(address: number) {
    this.cpu.registers.stackPointer = address & 0xffff
  }

  public setProgramCounter(address: number) {
    this.cpu.registers.programCounter = address & 0xffff
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

  public step() {
    return this.cpu.executeNextInstruction()
  }

  public isHalted() {
    return this.cpu.halted
  }

  /**
   * Reinicia los registros, flags y estado de la CPU. **No** modifica
   * la memoria — útil en el REPL para volver a ejecutar el programa
   * cargado sin recargar bytes.
   */
  public reset(programCounter = 0x0000, stackPointer = 0xffff) {
    this.cpu.registers.A = 0
    this.cpu.registers.B = 0
    this.cpu.registers.C = 0
    this.cpu.registers.D = 0
    this.cpu.registers.E = 0
    this.cpu.registers.H = 0
    this.cpu.registers.L = 0
    this.cpu.registers.stackPointer = stackPointer & 0xffff
    this.cpu.registers.programCounter = programCounter & 0xffff
    this.cpu.flags = 0x02
    this.cpu.halted = false
    this.cpu.interruptsEnabled = false
  }
}
