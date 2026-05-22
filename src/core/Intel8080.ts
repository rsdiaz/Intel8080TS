import { Bus } from "./Bus";

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
	C = 0,

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

export class Intel8080 {
  registers: Register
  flags: Flag
  halted = false;
  bus!: Bus

  constructor() {
    this.registers = new Register()
    this.flags = 0x2
    this.halted = false;
  }
  
  public connectBus(bus: Bus) {
    this.bus = bus
  }

  private getState() {
    return {
      ...this.registers,
      halted: this.halted,
      flags: {
        C: Flag.C,
        P: Flag.P,
        A: Flag.A,
        Z: Flag.Z,
        S: Flag.S
      },
    }
  }

  private getNextByte() {
    const nextByte = this.bus.readRam(this.registers.programCounter)
    this.registers.programCounter++
    return nextByte
  }

  private getNextWord() {
    const lowByte = this.getNextByte();
    const highByte = this.getNextByte();

    return (highByte << 8) | lowByte;
  }

  private opcodeTable = {
    "0x00": () => ({ Disassemble: "NOP", Ticks: 4 }),
    "0x47": () => this.mov_register("B", "A"),
    "0x78": () => this.mov_register("A", "B"),
    "0x3E": () => this.mvi_register("A", this.getNextByte()),
    "0xD3": () => this.out(this.getNextByte()),
    '0x76': () => this.halt(),
    // Agrega más opcodes según sea necesario
  }

  /**
   * Move value from one register to another.
   *
   * @param {char} regDestination The name of the destination register
   * (A,B,C,D,E,H,L)
   * @param {*} regSource The name of the source register (A,B,C,D,E,H,L)
   * @returns Number of clock cycles used.
   */
  mov_register(destReg: keyof Register, srcReg: keyof Register) {
    this.registers[destReg] = this.registers[srcReg];

    return { Disassemble: `MOV ${destReg}, ${srcReg}`, Ticks: 5 };
  }

  /**
   * Move an immediate 8-bit value into a register.
   *
   * @param {char} regDestination Name of the destination register
   * (A,B,C,D,E,H,L)
   * @param {number} val The 8-bit immediate value to store
   * @returns Number of clock cycles used.
   */
  mvi_register(destReg: keyof Register, val: number) {
    this.registers[destReg] = val & 0xff;
    // this._clock += 7;
    return {
      Disassemble: `MVI ${destReg}, #0x${val.toString(16).padStart(2, "0")}`,
      Ticks: 7,
    };
  }

  in(port: number) {
    // this._registers.A = this._bus.ReadDevice(port);
    // this._clock += 10;
    console.log("Received " + String.fromCharCode(port) + " from device #" + port);
    this.registers.A = port;
    return {
      Disassemble: `IN $#${port.toString(16).padStart(2, "0")}`,
      Ticks: 10,
    };
  }

  /**
   * Contents of the accumulator are sent to the output device with id
   * `deviceID`.
   *
   * @param {number} port Id of device to send to
   * @returns
   */
  out(port: number) {
    this.bus.writeDevice(port, this.registers.A);
    // this._clock += 10;
    console.log(String.fromCharCode(this.registers.A) + " sent to device #" + port);
    return {
      Disassemble: `OUT $#${port.toString(16).padStart(2, "0")}`,
      Ticks: 10,
    };
  }

  halt() {
    this.halted = true
    // this.clock += 7
    return { Disassemble: "HLT", Ticks: 7 }
  }

  public executeNextInstruction() {
    const opcodeAddress = this.registers.programCounter
    const opcode = this.getNextByte()
    const opcode2 = `0x${opcode.toString(16).toUpperCase()}`
    const executeInstruction = this.opcodeTable[opcode2 as keyof typeof this.opcodeTable]

    if (!executeInstruction) {
      throw new Error(`Opcode no soportado: 0x${opcode.toString(16)}`)
    }

    const result = executeInstruction()

    // console.log(result)

    return {
      LastInstructionDisassembly: result.Disassemble,
      LastInstructionTicks: result.Ticks,
      LastInstructionAddress: opcodeAddress,
      CPUState: this.getState(),
    }
  }
}
