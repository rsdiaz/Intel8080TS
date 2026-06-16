import process from 'node:process'

import { Bus } from './Bus'

/**
 * Emulador del procesador Intel 8080 (1974).
 *
 * Arquitectura modelada:
 *  - 7 registros de 8 bits de propósito general: A (acumulador), B, C, D, E,
 *    H, L. Los pares BC, DE y HL pueden usarse como registros de 16 bits.
 *  - Registro M (pseudo-registro): referencia indirecta a memoria a través
 *    de HL. La CPU lo trata como un "registro" más en muchas instrucciones.
 *  - Registro PSW (Program Status Word): combina el acumulador con el byte
 *    de flags. Los flags son S, Z, A (auxiliary carry), P, C.
 *  - Stack Pointer (SP, 16 bits) y Program Counter (PC, 16 bits).
 *  - Bus de 16 bits de direcciones (64 KB) y 8 bits de datos.
 *  - Bus de I/O separado con 256 puertos (instrucciones IN/OUT).
 *
 * Modelo de ejecución:
 *  1. FETCH:   lee el byte apuntado por PC, incrementa PC.
 *  2. DECODE:  identifica la familia mediante máscaras de bits sobre el
 *              opcode (ver métodos `execute*Instruction`).
 *  3. EXECUTE: ejecuta la operación, actualiza registros y flags, y, si
 *              corresponde, lee operandos adicionales (1 ó 2 bytes).
 *
 * No se modelan ciclos máquina ni timing real: cada instrucción devuelve
 * la cantidad de "Ticks" que tomaría en hardware real, pero el bucle de
 * ejecución no la respeta.
 */

export enum Flag {
  /** Sign flag. */
  S = 7,

  /** Zero flag. */
  Z = 6,

  /** Auxiliary Carry flag (also called AC). */
  A = 4,

  /** Parity flag. */
  P = 2,

  /** Carry flag. */
  C = 0
}

class Register {
  /* Accumulator (register A) */
  public A = 0x0

  /* register B */
  public B = 0x0

  /* register C */
  public C = 0x0

  /* register D */
  public D = 0x0

  /* register E */
  public E = 0x0

  /* register H */
  public H = 0x0

  /* register L */
  public L = 0x0

  /* 16-bit stack pointer register */
  public stackPointer = 0xffff

  /* Program counter */
  public programCounter = 0
}

type RegisterOrMemoryName = 'B' | 'C' | 'D' | 'E' | 'H' | 'L' | 'M' | 'A'
type RegisterPairName = 'B' | 'D' | 'H' | 'SP'
type RegisterPairStackName = 'B' | 'D' | 'H' | 'PSW'

export class Intel8080 {
  registers: Register
  flags: number
  halted = false
  interruptsEnabled = false
  bus!: Bus
  private debug: boolean

  constructor(debug = false) {
    this.registers = new Register()
    this.flags = 0x2
    this.halted = false
    this.debug = debug
  }

  /**
   * Logs a message to the console if debug mode is enabled.
   */ 
  private log(message: string) {
    if (!this.debug) {
      return
    }
    process.stdout.write(`${message}\n`)
  }

  /**
   * The 
   * @param bus The bus to connect to the CPU, allowing it to read and write memory and I/O ports.
   */
  public connectBus(bus: Bus) {
    this.bus = bus
  }

  private getState() {
    return {
      ...this.registers,
      halted: this.halted,
      flags: {
        C: this.isFlagSet(Flag.C),
        P: this.isFlagSet(Flag.P),
        A: this.isFlagSet(Flag.A),
        Z: this.isFlagSet(Flag.Z),
        S: this.isFlagSet(Flag.S)
      }
    }
  }

  private isFlagSet(flag: Flag) {
    return (this.flags & (1 << flag)) !== 0
  }

  private setFlag(flag: Flag, value: boolean) {
    if (value) {
      this.flags |= 1 << flag
      return
    }

    this.flags &= ~(1 << flag)
  }

  private hasEvenParity(value: number) {
    let bits = value & 0xff
    let setBitsCount = 0

    while (bits > 0) {
      setBitsCount += bits & 1
      bits >>= 1
    }

    return setBitsCount % 2 === 0
  }

  private updateZeroSignParityFlags(value: number) {
    const value8Bit = value & 0xff
    this.setFlag(Flag.Z, value8Bit === 0)
    this.setFlag(Flag.S, (value8Bit & 0x80) !== 0)
    this.setFlag(Flag.P, this.hasEvenParity(value8Bit))
  }

  /**
   * Construye el byte de flags (Program Status, parte baja del PSW)
   * con el layout oficial del 8080:
   *
   *   bit  7  6  5  4  3  2  1  0
   *        S  Z  0  A  0  P  1  C
   *
   * Los bits 5 y 3 están **siempre a 0**, y el bit 1 está **siempre a 1**.
   * Esto es importante porque cualquier programa que haga PUSH PSW + POP
   * PSW espera recuperar exactamente el mismo byte, incluidos esos bits
   * "ficticios". Si no respetamos esa convención, CPUDIAG falla.
   */
  private getFlagsByte() {
    let flagsByte = 0x02
    if (this.isFlagSet(Flag.C)) {
      flagsByte |= 1 << Flag.C
    }
    if (this.isFlagSet(Flag.P)) {
      flagsByte |= 1 << Flag.P
    }
    if (this.isFlagSet(Flag.A)) {
      flagsByte |= 1 << Flag.A
    }
    if (this.isFlagSet(Flag.Z)) {
      flagsByte |= 1 << Flag.Z
    }
    if (this.isFlagSet(Flag.S)) {
      flagsByte |= 1 << Flag.S
    }

    return flagsByte & 0xff
  }

  private setFlagsFromByte(flagsByte: number) {
    const normalizedFlags = flagsByte & 0xff
    this.flags = 0x02
    this.setFlag(Flag.C, (normalizedFlags & (1 << Flag.C)) !== 0)
    this.setFlag(Flag.P, (normalizedFlags & (1 << Flag.P)) !== 0)
    this.setFlag(Flag.A, (normalizedFlags & (1 << Flag.A)) !== 0)
    this.setFlag(Flag.Z, (normalizedFlags & (1 << Flag.Z)) !== 0)
    this.setFlag(Flag.S, (normalizedFlags & (1 << Flag.S)) !== 0)
  }

  /**
   * Calcula el resultado de una suma 8-bit y actualiza S, Z, A, P, C.
   *
   * El bit de auxiliary carry (A) se activa si hubo acarreo del nibble
   * bajo al nibble alto. Es necesario para que DAA ajuste correctamente
   * el resultado a BCD.
   */
  private applyAddFlags(accumulatorValue: number, value: number, carryIn = 0) {
    const result = accumulatorValue + value + carryIn
    const result8Bit = result & 0xff

    this.updateZeroSignParityFlags(result8Bit)
    this.setFlag(Flag.C, result > 0xff)
    this.setFlag(
      Flag.A,
      (accumulatorValue & 0x0f) + (value & 0x0f) + carryIn > 0x0f
    )

    return result8Bit
  }

  /**
   * Calcula el resultado de una resta 8-bit y actualiza S, Z, A, P, C.
   *
   * El flag C aquí actúa como "borrow" (préstamo): se activa cuando el
   * minuendo es menor que el sustraendo, indicando que la operación
   * "pidió prestado". El auxiliary carry sigue la misma lógica a nivel
   * de nibble bajo.
   */
  private applySubFlags(accumulatorValue: number, value: number, borrowIn = 0) {
    const result = accumulatorValue - value - borrowIn
    const result8Bit = result & 0xff

    this.updateZeroSignParityFlags(result8Bit)
    this.setFlag(Flag.C, accumulatorValue < value + borrowIn)
    this.setFlag(
      Flag.A,
      (accumulatorValue & 0x0f) - (value & 0x0f) - borrowIn < 0
    )

    return result8Bit
  }

  private applyLogicalFlags(result: number, auxiliaryCarry: boolean) {
    const result8Bit = result & 0xff
    this.updateZeroSignParityFlags(result8Bit)
    this.setFlag(Flag.C, false)
    this.setFlag(Flag.A, auxiliaryCarry)
    return result8Bit
  }

  /**
   * Tabla de condiciones del 8080. Cada instrucción condicional
   * (Jcc, Ccc, Rcc) codifica una de estas 8 condiciones en sus bits 5-3.
   *
   *   código  mnemónico  condición
   *   ------  ---------  --------------------------
   *     0       NZ       Not Zero  (Z = 0)
   *     1       Z        Zero      (Z = 1)
   *     2       NC       No Carry  (C = 0)
   *     3       C        Carry     (C = 1)
   *     4       PO       Parity Odd  (P = 0)
   *     5       PE       Parity Even (P = 1)
   *     6       P        Positive  (S = 0)
   *     7       M        Minus     (S = 1)
   */
  private evaluateCondition(conditionCode: number) {
    switch (conditionCode & 0x07) {
      case 0:
        return !this.isFlagSet(Flag.Z)
      case 1:
        return this.isFlagSet(Flag.Z)
      case 2:
        return !this.isFlagSet(Flag.C)
      case 3:
        return this.isFlagSet(Flag.C)
      case 4:
        return !this.isFlagSet(Flag.P)
      case 5:
        return this.isFlagSet(Flag.P)
      case 6:
        return !this.isFlagSet(Flag.S)
      default:
        return this.isFlagSet(Flag.S)
    }
  }

  private getNextByte() {
    const nextByte = this.bus.readRam(this.registers.programCounter)
    this.registers.programCounter++
    return nextByte
  }

  private getNextWord() {
    const lowByte = this.getNextByte()
    const highByte = this.getNextByte()

    return (highByte << 8) | lowByte
  }

  private opcodeTable = {
    '0x00': () => ({ Disassemble: 'NOP', Ticks: 4 }),
    '0xD3': () => this.out(this.getNextByte()),
    '0xDB': () => this.in(this.getNextByte()),
    '0x76': () => this.halt(),
    '0xF3': () => ({ Disassemble: 'DI', Ticks: 4 }),
    '0xFB': () => ({ Disassemble: 'EI', Ticks: 4 })
  }

  private registerCodeMap: RegisterOrMemoryName[] = [
    'B',
    'C',
    'D',
    'E',
    'H',
    'L',
    'M',
    'A'
  ]

  private formatOpcodeKey(opcode: number) {
    return `0x${opcode.toString(16).toUpperCase().padStart(2, '0')}`
  }

  private getHLAddress() {
    return ((this.registers.H & 0xff) << 8) | (this.registers.L & 0xff)
  }

  private getRegisterNameByCode(registerCode: number) {
    return this.registerCodeMap[registerCode]
  }

  private readRegisterOrMemory(registerCode: number) {
    const registerName = this.getRegisterNameByCode(registerCode)
    if (registerName === 'M') {
      return this.bus.readRam(this.getHLAddress())
    }

    return this.registers[registerName]
  }

  private writeRegisterOrMemory(registerCode: number, value: number) {
    const registerName = this.getRegisterNameByCode(registerCode)
    const value8Bit = value & 0xff

    if (registerName === 'M') {
      this.bus.writeRam(value8Bit, this.getHLAddress())
      return
    }

    this.registers[registerName] = value8Bit
  }

  private setRegisterPair(pairName: RegisterPairName, value: number) {
    const value16Bit = value & 0xffff
    const lowByte = value16Bit & 0xff
    const highByte = (value16Bit >> 8) & 0xff

    if (pairName === 'B') {
      this.registers.B = highByte
      this.registers.C = lowByte
      return
    }

    if (pairName === 'D') {
      this.registers.D = highByte
      this.registers.E = lowByte
      return
    }

    if (pairName === 'H') {
      this.registers.H = highByte
      this.registers.L = lowByte
      return
    }

    this.registers.stackPointer = value16Bit
  }

  private getRegisterPairValue(pairName: RegisterPairStackName) {
    if (pairName === 'B') {
      return ((this.registers.B & 0xff) << 8) | (this.registers.C & 0xff)
    }

    if (pairName === 'D') {
      return ((this.registers.D & 0xff) << 8) | (this.registers.E & 0xff)
    }

    return ((this.registers.H & 0xff) << 8) | (this.registers.L & 0xff)
  }

  private writeStackWord(value: number) {
    const value16Bit = value & 0xffff
    const highByte = (value16Bit >> 8) & 0xff
    const lowByte = value16Bit & 0xff

    this.registers.stackPointer = (this.registers.stackPointer - 1) & 0xffff
    this.bus.writeRam(highByte, this.registers.stackPointer)

    this.registers.stackPointer = (this.registers.stackPointer - 1) & 0xffff
    this.bus.writeRam(lowByte, this.registers.stackPointer)
  }

  private readStackWord() {
    const lowByte = this.bus.readRam(this.registers.stackPointer)
    this.registers.stackPointer = (this.registers.stackPointer + 1) & 0xffff

    const highByte = this.bus.readRam(this.registers.stackPointer)
    this.registers.stackPointer = (this.registers.stackPointer + 1) & 0xffff

    return ((highByte & 0xff) << 8) | (lowByte & 0xff)
  }

  private executeTransferInstruction(opcode: number) {
    if (opcode >= 0x40 && opcode <= 0x7f && opcode !== 0x76) {
      const destRegisterCode = (opcode >> 3) & 0x07
      const srcRegisterCode = opcode & 0x07
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.writeRegisterOrMemory(destRegisterCode, value)

      const destRegisterName = this.getRegisterNameByCode(destRegisterCode)
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const ticks = destRegisterName === 'M' || srcRegisterName === 'M' ? 7 : 5

      return {
        Disassemble: `MOV ${destRegisterName}, ${srcRegisterName}`,
        Ticks: ticks
      }
    }

    if ((opcode & 0xc7) === 0x06) {
      const destRegisterCode = (opcode >> 3) & 0x07
      const destRegisterName = this.getRegisterNameByCode(destRegisterCode)
      const immediateValue = this.getNextByte()
      this.writeRegisterOrMemory(destRegisterCode, immediateValue)

      return {
        Disassemble: `MVI ${destRegisterName}, #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: destRegisterName === 'M' ? 10 : 7
      }
    }

    const lxiPairs: RegisterPairName[] = ['B', 'D', 'H', 'SP']
    if ((opcode & 0xcf) === 0x01) {
      const pairIndex = (opcode >> 4) & 0x03
      const pairName = lxiPairs[pairIndex]
      if (pairName) {
        const immediateWord = this.getNextWord()
        this.setRegisterPair(pairName, immediateWord)
        return {
          Disassemble: `LXI ${pairName}, #0x${immediateWord.toString(16).toUpperCase().padStart(4, '0')}`,
          Ticks: 10
        }
      }
    }

    return null
  }

  private executeAluInstruction(opcode: number) {
    if ((opcode & 0xf8) === 0x88) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      const carryIn = this.isFlagSet(Flag.C) ? 1 : 0
      this.registers.A = this.applyAddFlags(this.registers.A, value, carryIn)

      return {
        Disassemble: `ADC ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0x80) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.registers.A = this.applyAddFlags(this.registers.A, value)

      return {
        Disassemble: `ADD ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0x98) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      const borrowIn = this.isFlagSet(Flag.C) ? 1 : 0
      this.registers.A = this.applySubFlags(this.registers.A, value, borrowIn)

      return {
        Disassemble: `SBB ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0x90) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.registers.A = this.applySubFlags(this.registers.A, value)

      return {
        Disassemble: `SUB ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0xa0) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.registers.A = this.applyLogicalFlags(this.registers.A & value, true)

      return {
        Disassemble: `ANA ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0xa8) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.registers.A = this.applyLogicalFlags(this.registers.A ^ value, false)

      return {
        Disassemble: `XRA ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0xb0) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.registers.A = this.applyLogicalFlags(this.registers.A | value, false)

      return {
        Disassemble: `ORA ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xf8) === 0xb8) {
      const srcRegisterCode = opcode & 0x07
      const srcRegisterName = this.getRegisterNameByCode(srcRegisterCode)
      const value = this.readRegisterOrMemory(srcRegisterCode)
      this.applySubFlags(this.registers.A, value)

      return {
        Disassemble: `CMP ${srcRegisterName}`,
        Ticks: srcRegisterName === 'M' ? 7 : 4
      }
    }

    if ((opcode & 0xc7) === 0x04) {
      const targetRegisterCode = (opcode >> 3) & 0x07
      const targetRegisterName = this.getRegisterNameByCode(targetRegisterCode)
      const value = this.readRegisterOrMemory(targetRegisterCode)
      const result = (value + 1) & 0xff
      this.writeRegisterOrMemory(targetRegisterCode, result)

      this.updateZeroSignParityFlags(result)
      this.setFlag(Flag.A, (value & 0x0f) + 1 > 0x0f)

      return {
        Disassemble: `INR ${targetRegisterName}`,
        Ticks: targetRegisterName === 'M' ? 10 : 5
      }
    }

    if ((opcode & 0xc7) === 0x05) {
      const targetRegisterCode = (opcode >> 3) & 0x07
      const targetRegisterName = this.getRegisterNameByCode(targetRegisterCode)
      const value = this.readRegisterOrMemory(targetRegisterCode)
      const result = (value - 1) & 0xff
      this.writeRegisterOrMemory(targetRegisterCode, result)

      this.updateZeroSignParityFlags(result)
      this.setFlag(Flag.A, (value & 0x0f) === 0)

      return {
        Disassemble: `DCR ${targetRegisterName}`,
        Ticks: targetRegisterName === 'M' ? 10 : 5
      }
    }

    if (opcode === 0xc6) {
      const immediateValue = this.getNextByte()
      this.registers.A = this.applyAddFlags(this.registers.A, immediateValue)
      return {
        Disassemble: `ADI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xce) {
      const immediateValue = this.getNextByte()
      const carryIn = this.isFlagSet(Flag.C) ? 1 : 0
      this.registers.A = this.applyAddFlags(
        this.registers.A,
        immediateValue,
        carryIn
      )
      return {
        Disassemble: `ACI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xd6) {
      const immediateValue = this.getNextByte()
      this.registers.A = this.applySubFlags(this.registers.A, immediateValue)
      return {
        Disassemble: `SUI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xde) {
      const immediateValue = this.getNextByte()
      const borrowIn = this.isFlagSet(Flag.C) ? 1 : 0
      this.registers.A = this.applySubFlags(
        this.registers.A,
        immediateValue,
        borrowIn
      )
      return {
        Disassemble: `SBI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xe6) {
      const immediateValue = this.getNextByte()
      this.registers.A = this.applyLogicalFlags(
        this.registers.A & immediateValue,
        true
      )
      return {
        Disassemble: `ANI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xee) {
      const immediateValue = this.getNextByte()
      this.registers.A = this.applyLogicalFlags(
        this.registers.A ^ immediateValue,
        false
      )
      return {
        Disassemble: `XRI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xf6) {
      const immediateValue = this.getNextByte()
      this.registers.A = this.applyLogicalFlags(
        this.registers.A | immediateValue,
        false
      )
      return {
        Disassemble: `ORI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    if (opcode === 0xfe) {
      const immediateValue = this.getNextByte()
      this.applySubFlags(this.registers.A, immediateValue)
      return {
        Disassemble: `CPI #0x${immediateValue.toString(16).padStart(2, '0')}`,
        Ticks: 7
      }
    }

    return null
  }

  private executeControlFlowInstruction(opcode: number) {
    if (opcode === 0xc3) {
      const address = this.getNextWord()
      this.registers.programCounter = address
      return {
        Disassemble: `JMP 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 10
      }
    }

    if (opcode === 0xca) {
      const address = this.getNextWord()
      if (this.isFlagSet(Flag.Z)) {
        this.registers.programCounter = address
      }
      return {
        Disassemble: `JZ 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 10
      }
    }

    if (opcode === 0xc2) {
      const address = this.getNextWord()
      if (!this.isFlagSet(Flag.Z)) {
        this.registers.programCounter = address
      }
      return {
        Disassemble: `JNZ 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 10
      }
    }

    if ((opcode & 0xc7) === 0xc2) {
      const conditionCode = (opcode >> 3) & 0x07
      const jumpMnemonics = ['JNZ', 'JZ', 'JNC', 'JC', 'JPO', 'JPE', 'JP', 'JM']
      const address = this.getNextWord()
      if (this.evaluateCondition(conditionCode)) {
        this.registers.programCounter = address
      }
      return {
        Disassemble: `${jumpMnemonics[conditionCode]} 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 10
      }
    }

    return null
  }

  private executeStackInstruction(opcode: number) {
    const pushPairs: RegisterPairStackName[] = ['B', 'D', 'H', 'PSW']
    if ((opcode & 0xcf) === 0xc5) {
      const pairIndex = (opcode >> 4) & 0x03
      const pairName = pushPairs[pairIndex]
      if (pairName) {
        const pairValue =
          pairName === 'PSW'
            ? ((this.registers.A & 0xff) << 8) | this.getFlagsByte()
            : this.getRegisterPairValue(pairName)
        this.writeStackWord(pairValue)
        return {
          Disassemble: `PUSH ${pairName}`,
          Ticks: 11
        }
      }
    }

    const popPairs: RegisterPairStackName[] = ['B', 'D', 'H', 'PSW']
    if ((opcode & 0xcf) === 0xc1) {
      const pairIndex = (opcode >> 4) & 0x03
      const pairName = popPairs[pairIndex]
      if (pairName) {
        const value = this.readStackWord()
        if (pairName === 'PSW') {
          this.registers.A = (value >> 8) & 0xff
          this.setFlagsFromByte(value & 0xff)
        } else {
          this.setRegisterPair(pairName, value)
        }
        return {
          Disassemble: `POP ${pairName}`,
          Ticks: 10
        }
      }
    }

    return null
  }

  private executeSubroutineInstruction(opcode: number) {
    if (opcode === 0xcd) {
      const targetAddress = this.getNextWord()
      const returnAddress = this.registers.programCounter
      this.writeStackWord(returnAddress)
      this.registers.programCounter = targetAddress
      return {
        Disassemble: `CALL 0x${targetAddress.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 17
      }
    }

    if (opcode === 0xc9) {
      const returnAddress = this.readStackWord()
      this.registers.programCounter = returnAddress
      return {
        Disassemble: 'RET',
        Ticks: 10
      }
    }

    if ((opcode & 0xc7) === 0xc4) {
      const conditionCode = (opcode >> 3) & 0x07
      const callMnemonics = ['CNZ', 'CZ', 'CNC', 'CC', 'CPO', 'CPE', 'CP', 'CM']
      const targetAddress = this.getNextWord()
      if (this.evaluateCondition(conditionCode)) {
        const returnAddress = this.registers.programCounter
        this.writeStackWord(returnAddress)
        this.registers.programCounter = targetAddress
      }
      return {
        Disassemble: `${callMnemonics[conditionCode]} 0x${targetAddress.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 17
      }
    }

    if ((opcode & 0xc7) === 0xc0) {
      const conditionCode = (opcode >> 3) & 0x07
      const returnMnemonics = [
        'RNZ',
        'RZ',
        'RNC',
        'RC',
        'RPO',
        'RPE',
        'RP',
        'RM'
      ]
      if (this.evaluateCondition(conditionCode)) {
        const returnAddress = this.readStackWord()
        this.registers.programCounter = returnAddress
      }
      return {
        Disassemble: returnMnemonics[conditionCode],
        Ticks: 11
      }
    }

    if ((opcode & 0xc7) === 0xc7) {
      const restartNumber = (opcode >> 3) & 0x07
      const targetAddress = restartNumber * 8
      this.writeStackWord(this.registers.programCounter)
      this.registers.programCounter = targetAddress
      return {
        Disassemble: `RST ${restartNumber}`,
        Ticks: 11
      }
    }

    return null
  }

  private executeRotateInstruction(opcode: number) {
    if (opcode === 0x07) {
      const bit7 = (this.registers.A >> 7) & 1
      this.registers.A = ((this.registers.A << 1) | bit7) & 0xff
      this.setFlag(Flag.C, bit7 === 1)
      return {
        Disassemble: 'RLC',
        Ticks: 4
      }
    }

    if (opcode === 0x0f) {
      const bit0 = this.registers.A & 1
      this.registers.A = ((bit0 << 7) | (this.registers.A >> 1)) & 0xff
      this.setFlag(Flag.C, bit0 === 1)
      return {
        Disassemble: 'RRC',
        Ticks: 4
      }
    }

    if (opcode === 0x17) {
      const oldCarry = this.isFlagSet(Flag.C) ? 1 : 0
      const bit7 = (this.registers.A >> 7) & 1
      this.registers.A = ((this.registers.A << 1) | oldCarry) & 0xff
      this.setFlag(Flag.C, bit7 === 1)
      return {
        Disassemble: 'RAL',
        Ticks: 4
      }
    }

    if (opcode === 0x1f) {
      const oldCarry = this.isFlagSet(Flag.C) ? 1 : 0
      const bit0 = this.registers.A & 1
      this.registers.A = ((oldCarry << 7) | (this.registers.A >> 1)) & 0xff
      this.setFlag(Flag.C, bit0 === 1)
      return {
        Disassemble: 'RAR',
        Ticks: 4
      }
    }

    if (opcode === 0x37) {
      this.setFlag(Flag.C, true)
      return {
        Disassemble: 'STC',
        Ticks: 4
      }
    }

    if (opcode === 0x3f) {
      this.setFlag(Flag.C, !this.isFlagSet(Flag.C))
      return {
        Disassemble: 'CMC',
        Ticks: 4
      }
    }

    if (opcode === 0x2f) {
      this.registers.A = (~this.registers.A) & 0xff
      return {
        Disassemble: 'CMA',
        Ticks: 4
      }
    }

    if (opcode === 0x27) {
      const oldA = this.registers.A
      const oldC = this.isFlagSet(Flag.C)
      let newA = oldA
      let ac = false

      if ((newA & 0x0f) > 9 || this.isFlagSet(Flag.A)) {
        newA += 6
        ac = (newA & 0x10) !== 0
      }

      if ((newA >> 4) > 9 || oldC) {
        newA += 0x60
        this.setFlag(Flag.C, true)
      } else {
        this.setFlag(Flag.C, false)
      }

      this.setFlag(Flag.A, ac)
      this.registers.A = newA & 0xff
      this.updateZeroSignParityFlags(this.registers.A)

      return {
        Disassemble: 'DAA',
        Ticks: 4
      }
    }

    return null
  }

  private executeMemoryAndPairInstruction(opcode: number) {
    if ((opcode & 0xcf) === 0x03) {
      const pairIndex = (opcode >> 4) & 0x03
      const pairs: RegisterPairName[] = ['B', 'D', 'H', 'SP']
      const pairName = pairs[pairIndex]
      const currentValue =
        pairName === 'SP'
          ? this.registers.stackPointer
          : pairName === 'B'
            ? ((this.registers.B & 0xff) << 8) | (this.registers.C & 0xff)
            : pairName === 'D'
              ? ((this.registers.D & 0xff) << 8) | (this.registers.E & 0xff)
              : ((this.registers.H & 0xff) << 8) | (this.registers.L & 0xff)
      const nextValue = (currentValue + 1) & 0xffff
      this.setRegisterPair(pairName, nextValue)
      return {
        Disassemble: `INX ${pairName}`,
        Ticks: 5
      }
    }

    if ((opcode & 0xcf) === 0x0b) {
      const pairIndex = (opcode >> 4) & 0x03
      const pairs: RegisterPairName[] = ['B', 'D', 'H', 'SP']
      const pairName = pairs[pairIndex]
      const currentValue =
        pairName === 'SP'
          ? this.registers.stackPointer
          : pairName === 'B'
            ? ((this.registers.B & 0xff) << 8) | (this.registers.C & 0xff)
            : pairName === 'D'
              ? ((this.registers.D & 0xff) << 8) | (this.registers.E & 0xff)
              : ((this.registers.H & 0xff) << 8) | (this.registers.L & 0xff)
      const nextValue = (currentValue - 1) & 0xffff
      this.setRegisterPair(pairName, nextValue)
      return {
        Disassemble: `DCX ${pairName}`,
        Ticks: 5
      }
    }

    if ((opcode & 0xcf) === 0x09) {
      const pairIndex = (opcode >> 4) & 0x03
      const pairs: RegisterPairName[] = ['B', 'D', 'H', 'SP']
      const pairName = pairs[pairIndex]
      const hlValue = this.getHLAddress()
      const sourceValue =
        pairName === 'SP'
          ? this.registers.stackPointer
          : pairName === 'B'
            ? ((this.registers.B & 0xff) << 8) | (this.registers.C & 0xff)
            : pairName === 'D'
              ? ((this.registers.D & 0xff) << 8) | (this.registers.E & 0xff)
              : ((this.registers.H & 0xff) << 8) | (this.registers.L & 0xff)
      const sum = hlValue + sourceValue
      this.setRegisterPair('H', sum)
      this.setFlag(Flag.C, sum > 0xffff)
      return {
        Disassemble: `DAD ${pairName}`,
        Ticks: 10
      }
    }

    if (opcode === 0xeb) {
      // XCHG: intercambia HL ↔ DE.
      // Útil porque la mayoría de las instrucciones de acceso indirecto
      // (LDAX, MOV M,r) usan HL; XCHG permite "rotar" DE a HL para
      // aprovechar esas instrucciones sin perder el contenido original.
      const oldD = this.registers.D
      const oldE = this.registers.E
      this.registers.D = this.registers.H
      this.registers.E = this.registers.L
      this.registers.H = oldD
      this.registers.L = oldE
      return {
        Disassemble: 'XCHG',
        Ticks: 4
      }
    }

    if (opcode === 0xe9) {
      this.registers.programCounter = this.getHLAddress()
      return {
        Disassemble: 'PCHL',
        Ticks: 5
      }
    }

    if (opcode === 0xf9) {
      // SPHL: SP ← HL. Permite mover el stack a una zona arbitraria de
      // memoria sin necesidad de cargarlo con LXI SP (que ocupa 3 bytes).
      this.registers.stackPointer = this.getHLAddress()
      return {
        Disassemble: 'SPHL',
        Ticks: 5
      }
    }

    if (opcode === 0x3a) {
      const address = this.getNextWord()
      this.registers.A = this.bus.readRam(address)
      return {
        Disassemble: `LDA 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 13
      }
    }

    if (opcode === 0x32) {
      const address = this.getNextWord()
      this.bus.writeRam(this.registers.A, address)
      return {
        Disassemble: `STA 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 13
      }
    }

    if (opcode === 0x2a) {
      const address = this.getNextWord()
      const lowByte = this.bus.readRam(address)
      const highByte = this.bus.readRam((address + 1) & 0xffff)
      this.registers.L = lowByte
      this.registers.H = highByte
      return {
        Disassemble: `LHLD 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 16
      }
    }

    if (opcode === 0x22) {
      const address = this.getNextWord()
      this.bus.writeRam(this.registers.L, address)
      this.bus.writeRam(this.registers.H, (address + 1) & 0xffff)
      return {
        Disassemble: `SHLD 0x${address.toString(16).toUpperCase().padStart(4, '0')}`,
        Ticks: 16
      }
    }

    if (opcode === 0x0a) {
      const address =
        ((this.registers.B & 0xff) << 8) | (this.registers.C & 0xff)
      this.registers.A = this.bus.readRam(address)
      return {
        Disassemble: 'LDAX B',
        Ticks: 7
      }
    }

    if (opcode === 0x1a) {
      const address =
        ((this.registers.D & 0xff) << 8) | (this.registers.E & 0xff)
      this.registers.A = this.bus.readRam(address)
      return {
        Disassemble: 'LDAX D',
        Ticks: 7
      }
    }

    if (opcode === 0x02) {
      const address =
        ((this.registers.B & 0xff) << 8) | (this.registers.C & 0xff)
      this.bus.writeRam(this.registers.A, address)
      return {
        Disassemble: 'STAX B',
        Ticks: 7
      }
    }

    if (opcode === 0x12) {
      const address =
        ((this.registers.D & 0xff) << 8) | (this.registers.E & 0xff)
      this.bus.writeRam(this.registers.A, address)
      return {
        Disassemble: 'STAX D',
        Ticks: 7
      }
    }

    return null
  }

  private executeMiscInstruction(opcode: number) {
    if (opcode === 0x00) {
      return { Disassemble: 'NOP', Ticks: 4 }
    }

    if (opcode === 0x76) {
      return this.halt()
    }

    if (opcode === 0xd3) {
      return this.out(this.getNextByte())
    }

    if (opcode === 0xdb) {
      return this.in(this.getNextByte())
    }

    if (opcode === 0x2f) {
      this.registers.A = ~this.registers.A & 0xff
      return { Disassemble: 'CMA', Ticks: 4 }
    }

    if (opcode === 0xe9) {
      this.registers.programCounter = this.getHLAddress()
      return { Disassemble: 'PCHL', Ticks: 5 }
    }

    if (opcode === 0xf3) {
      this.interruptsEnabled = false
      return { Disassemble: 'DI', Ticks: 4 }
    }

    if (opcode === 0xfb) {
      this.interruptsEnabled = true
      return { Disassemble: 'EI', Ticks: 4 }
    }

    if (opcode === 0xe3) {
      // XTHL: intercambia HL con la palabra en el tope de la pila.
      // No usa los helpers de stack porque NO mueve el SP: solo permuta
      // los dos bytes del tope con H y L.
      const spLow = this.bus.readRam(this.registers.stackPointer)
      const spHigh = this.bus.readRam(
        (this.registers.stackPointer + 1) & 0xffff
      )
      this.bus.writeRam(this.registers.L, this.registers.stackPointer)
      this.bus.writeRam(
        this.registers.H,
        (this.registers.stackPointer + 1) & 0xffff
      )
      this.registers.L = spLow
      this.registers.H = spHigh
      return { Disassemble: 'XTHL', Ticks: 18 }
    }

    if (opcode === 0x27) {
      // DAA: Decimal Adjust Accumulator.
      //
      // El 8080 no tiene aritmética BCD nativa: las instrucciones ADD,
      // SUB, etc. trabajan en binario. DAA "corrige" el acumulador tras
      // una operación aritmética para que el resultado sea válido en
      // BCD (Binary-Coded Decimal, donde cada nibble representa un
      // dígito decimal 0-9).
      //
      // Reglas (oficial Intel):
      //   1. Si el nibble bajo > 9 ó AC=1, se suma 0x06 al acumulador.
      //   2. Si tras el paso 1 el nibble alto > 9 ó C=1, se suma 0x60.
      //   3. Los flags S, Z, P se calculan sobre el resultado final;
      //      C se setea si hubo carry en el paso 2 (o ya estaba a 1);
      //      AC se setea si hubo carry del nibble bajo en el paso 1.
      const value = this.registers.A
      let correction = 0
      let carry = this.isFlagSet(Flag.C)
      const lowNibble = value & 0x0f

      if (lowNibble > 9 || this.isFlagSet(Flag.A)) {
        correction |= 0x06
      }

      if (value > 0x99 || this.isFlagSet(Flag.C)) {
        correction |= 0x60
        carry = true
      }

      const result = value + correction
      const result8Bit = result & 0xff

      this.setFlag(Flag.A, lowNibble + (correction & 0x0f) > 0x0f)
      this.setFlag(Flag.C, carry)
      this.updateZeroSignParityFlags(result8Bit)
      this.registers.A = result8Bit
      return { Disassemble: 'DAA', Ticks: 4 }
    }

    return null
  }

  in(port: number) {
    const value = this.bus.readDevice(port)
    this.registers.A = value & 0xff
    this.log(
      `Received ${String.fromCharCode(this.registers.A)} from device #${port}`
    )
    return {
      Disassemble: `IN $#${port.toString(16).padStart(2, '0')}`,
      Ticks: 10
    }
  }

  /**
   * Contents of the accumulator are sent to the output device with id
   * `deviceID`.
   *
   * @param {number} port Id of device to send to
   * @returns
   */
  out(port: number) {
    this.bus.writeDevice(port, this.registers.A)
    this.log(String.fromCharCode(this.registers.A) + ' sent to device #' + port)
    return {
      Disassemble: `OUT $#${port.toString(16).padStart(2, '0')}`,
      Ticks: 10
    }
  }

  halt() {
    this.halted = true
    return { Disassemble: 'HLT', Ticks: 7 }
  }

  /**
   * Devuelve la longitud en bytes de una instrucción 8080 dado su opcode.
   *
   * Las instrucciones del 8080 ocupan 1, 2 ó 3 bytes:
   *  - 1 byte: solo opcode (la mayoría).
   *  - 2 bytes: opcode + dato inmediato de 8 bits (MVI, ADI, IN, OUT, ...).
   *  - 3 bytes: opcode + dato/dirección inmediato de 16 bits (LXI, JMP,
   *    CALL, LDA, STA, LHLD, SHLD, saltos y llamadas condicionales).
   *
   * Útil para el modo trace y para que un disassembler pueda avanzar el
   * cursor sin ejecutar.
   */
  public static instructionLength(opcode: number): number {
    // 3 bytes
    if ((opcode & 0xcf) === 0x01) return 3 // LXI rp, d16
    if (opcode === 0x22 || opcode === 0x2a) return 3 // SHLD, LHLD
    if (opcode === 0x32 || opcode === 0x3a) return 3 // STA, LDA
    if (opcode === 0xc3 || opcode === 0xcd) return 3 // JMP, CALL
    if ((opcode & 0xc7) === 0xc2) return 3 // Jcc
    if ((opcode & 0xc7) === 0xc4) return 3 // Ccc

    // 2 bytes
    if ((opcode & 0xc7) === 0x06) return 2 // MVI r, d8
    if (opcode === 0xc6 || opcode === 0xce) return 2 // ADI, ACI
    if (opcode === 0xd6 || opcode === 0xde) return 2 // SUI, SBI
    if (opcode === 0xe6 || opcode === 0xee) return 2 // ANI, XRI
    if (opcode === 0xf6 || opcode === 0xfe) return 2 // ORI, CPI
    if (opcode === 0xd3 || opcode === 0xdb) return 2 // OUT, IN

    return 1
  }

  private hex8(value: number) {
    return (value & 0xff).toString(16).toUpperCase().padStart(2, '0')
  }

  private hex16(value: number) {
    return (value & 0xffff).toString(16).toUpperCase().padStart(4, '0')
  }

  /**
   * Devuelve una línea de trace estilo debugger con la forma:
   *
   *   0x0100  3E 41        MVI A, #0x41      A=41 BC=0000 DE=0000 HL=0000 SP=F000 [..A.C] (7t)
   *
   * Útil para el modo `--trace` y para el REPL.
   */
  public formatTraceLine(
    opcodeAddress: number,
    disassembly: string,
    ticks: number
  ): string {
    const opcode = this.bus.readRam(opcodeAddress)
    const length = Intel8080.instructionLength(opcode)

    const bytes: string[] = []
    for (let i = 0; i < length; i++) {
      bytes.push(this.hex8(this.bus.readRam((opcodeAddress + i) & 0xffff)))
    }

    const addrStr = `0x${this.hex16(opcodeAddress)}`
    const bytesStr = bytes.join(' ').padEnd(8)
    const mnemStr = disassembly.padEnd(18)

    const regs = [
      `A=${this.hex8(this.registers.A)}`,
      `BC=${this.hex8(this.registers.B)}${this.hex8(this.registers.C)}`,
      `DE=${this.hex8(this.registers.D)}${this.hex8(this.registers.E)}`,
      `HL=${this.hex8(this.registers.H)}${this.hex8(this.registers.L)}`,
      `SP=${this.hex16(this.registers.stackPointer)}`
    ].join(' ')

    const flagBits = [
      this.isFlagSet(Flag.S) ? 'S' : '.',
      this.isFlagSet(Flag.Z) ? 'Z' : '.',
      this.isFlagSet(Flag.A) ? 'A' : '.',
      this.isFlagSet(Flag.P) ? 'P' : '.',
      this.isFlagSet(Flag.C) ? 'C' : '.'
    ].join('')

    return `${addrStr}  ${bytesStr}  ${mnemStr}  ${regs} [${flagBits}] (${ticks}t)`
  }

  public executeNextInstruction() {
    const opcodeAddress = this.registers.programCounter
    const opcode = this.getNextByte()

    const result =
      this.executeTransferInstruction(opcode) ??
      this.executeAluInstruction(opcode) ??
      this.executeControlFlowInstruction(opcode) ??
      this.executeStackInstruction(opcode) ??
      this.executeSubroutineInstruction(opcode) ??
      this.executeRotateInstruction(opcode) ??
      this.executeMemoryAndPairInstruction(opcode) ??
      this.executeMiscInstruction(opcode)

    if (!result) {
      const opcodeKey = this.formatOpcodeKey(opcode)
      throw new Error(
        `Opcode no soportado: ${opcodeKey} en 0x${this.hex16(opcodeAddress)}`
      )
    }

    if (this.debug) {
      process.stderr.write(
        this.formatTraceLine(opcodeAddress, result.Disassemble, result.Ticks) +
          '\n'
      )
    }

    return {
      LastInstructionDisassembly: result.Disassemble,
      LastInstructionTicks: result.Ticks,
      LastInstructionAddress: opcodeAddress,
      CPUState: this.getState()
    }
  }
}
