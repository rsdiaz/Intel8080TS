import { Bus } from './Bus'

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
    // this._clock += 10;
    this.log(String.fromCharCode(this.registers.A) + ' sent to device #' + port)
    return {
      Disassemble: `OUT $#${port.toString(16).padStart(2, '0')}`,
      Ticks: 10
    }
  }

  halt() {
    this.halted = true
    // this.clock += 7
    return { Disassemble: 'HLT', Ticks: 7 }
  }

  public executeNextInstruction() {
    const opcodeAddress = this.registers.programCounter
    const opcode = this.getNextByte()
    const transferResult = this.executeTransferInstruction(opcode)
    if (transferResult) {
      return {
        LastInstructionDisassembly: transferResult.Disassemble,
        LastInstructionTicks: transferResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const aluResult = this.executeAluInstruction(opcode)
    if (aluResult) {
      return {
        LastInstructionDisassembly: aluResult.Disassemble,
        LastInstructionTicks: aluResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const controlFlowResult = this.executeControlFlowInstruction(opcode)
    if (controlFlowResult) {
      return {
        LastInstructionDisassembly: controlFlowResult.Disassemble,
        LastInstructionTicks: controlFlowResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const stackResult = this.executeStackInstruction(opcode)
    if (stackResult) {
      return {
        LastInstructionDisassembly: stackResult.Disassemble,
        LastInstructionTicks: stackResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const subroutineResult = this.executeSubroutineInstruction(opcode)
    if (subroutineResult) {
      return {
        LastInstructionDisassembly: subroutineResult.Disassemble,
        LastInstructionTicks: subroutineResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const rotateResult = this.executeRotateInstruction(opcode)
    if (rotateResult) {
      return {
        LastInstructionDisassembly: rotateResult.Disassemble,
        LastInstructionTicks: rotateResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const memoryPairResult = this.executeMemoryAndPairInstruction(opcode)
    if (memoryPairResult) {
      return {
        LastInstructionDisassembly: memoryPairResult.Disassemble,
        LastInstructionTicks: memoryPairResult.Ticks,
        LastInstructionAddress: opcodeAddress,
        CPUState: this.getState()
      }
    }

    const opcodeKey = this.formatOpcodeKey(opcode)
    const executeInstruction =
      this.opcodeTable[opcodeKey as keyof typeof this.opcodeTable]

    if (!executeInstruction) {
      throw new Error(
        `Opcode no soportado: ${opcodeKey} en 0x${opcodeAddress.toString(16).toUpperCase().padStart(4, '0')}`
      )
    }

    const result = executeInstruction()

    // console.log(result)

    return {
      LastInstructionDisassembly: result.Disassemble,
      LastInstructionTicks: result.Ticks,
      LastInstructionAddress: opcodeAddress,
      CPUState: this.getState()
    }
  }
}
