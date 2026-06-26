const REG = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A']
const PAIRS = ['B', 'D', 'H', 'SP']
const PUSH_PAIRS = ['B', 'D', 'H', 'PSW']
const JMP_MNE = ['JNZ', 'JZ', 'JNC', 'JC', 'JPO', 'JPE', 'JP', 'JM']
const CALL_MNE = ['CNZ', 'CZ', 'CNC', 'CC', 'CPO', 'CPE', 'CP', 'CM']
const RET_MNE = ['RNZ', 'RZ', 'RNC', 'RC', 'RPO', 'RPE', 'RP', 'RM']

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0')
const hex4 = (v: number) => v.toString(16).toUpperCase().padStart(4, '0')

export function disassembleOpcode(
  opcode: number,
  readByte: (offset: number) => number
): { disassembly: string; length: number } | null {
  const r = opcode & 0x07
  const d = (opcode >> 3) & 0x07
  const p = (opcode >> 4) & 0x03

  switch (opcode) {
    case 0x00:
      return { disassembly: 'NOP', length: 1 }
    case 0x07:
      return { disassembly: 'RLC', length: 1 }
    case 0x0f:
      return { disassembly: 'RRC', length: 1 }
    case 0x17:
      return { disassembly: 'RAL', length: 1 }
    case 0x1f:
      return { disassembly: 'RAR', length: 1 }
    case 0x27:
      return { disassembly: 'DAA', length: 1 }
    case 0x2f:
      return { disassembly: 'CMA', length: 1 }
    case 0x37:
      return { disassembly: 'STC', length: 1 }
    case 0x3f:
      return { disassembly: 'CMC', length: 1 }
    case 0x76:
      return { disassembly: 'HLT', length: 1 }
    case 0xc3: {
      const a = readByte(1) | (readByte(2) << 8)
      return { disassembly: `JMP 0x${hex4(a)}`, length: 3 }
    }
    case 0xc9:
      return { disassembly: 'RET', length: 1 }
    case 0xcd: {
      const a = readByte(1) | (readByte(2) << 8)
      return { disassembly: `CALL 0x${hex4(a)}`, length: 3 }
    }
    case 0xd3:
      return { disassembly: `OUT 0x${hex2(readByte(1))}`, length: 2 }
    case 0xdb:
      return { disassembly: `IN 0x${hex2(readByte(1))}`, length: 2 }
    case 0xe3:
      return { disassembly: 'XTHL', length: 1 }
    case 0xe9:
      return { disassembly: 'PCHL', length: 1 }
    case 0xeb:
      return { disassembly: 'XCHG', length: 1 }
    case 0xf3:
      return { disassembly: 'DI', length: 1 }
    case 0xf9:
      return { disassembly: 'SPHL', length: 1 }
    case 0xfb:
      return { disassembly: 'EI', length: 1 }
  }

  if (opcode >= 0x40 && opcode <= 0x7f) {
    return { disassembly: `MOV ${REG[d]}, ${REG[r]}`, length: 1 }
  }

  const alu = aluTable[opcode]
  if (alu) return alu(REG[r])

  if ((opcode & 0xc7) === 0x04) {
    return { disassembly: `INR ${REG[d]}`, length: 1 }
  }
  if ((opcode & 0xc7) === 0x05) {
    return { disassembly: `DCR ${REG[d]}`, length: 1 }
  }
  if ((opcode & 0xc7) === 0x06) {
    return { disassembly: `MVI ${REG[d]}, #0x${hex2(readByte(1))}`, length: 2 }
  }

  if ((opcode & 0xcf) === 0x01) {
    const w = readByte(1) | (readByte(2) << 8)
    return { disassembly: `LXI ${PAIRS[p]}, #0x${hex4(w)}`, length: 3 }
  }
  if ((opcode & 0xcf) === 0x03) {
    return { disassembly: `INX ${PAIRS[p]}`, length: 1 }
  }
  if ((opcode & 0xcf) === 0x09) {
    return { disassembly: `DAD ${PAIRS[p]}`, length: 1 }
  }
  if ((opcode & 0xcf) === 0x0b) {
    return { disassembly: `DCX ${PAIRS[p]}`, length: 1 }
  }

  if (opcode === 0x02) return { disassembly: 'STAX B', length: 1 }
  if (opcode === 0x12) return { disassembly: 'STAX D', length: 1 }
  if (opcode === 0x0a) return { disassembly: 'LDAX B', length: 1 }
  if (opcode === 0x1a) return { disassembly: 'LDAX D', length: 1 }

  if (opcode === 0x22) {
    const a = readByte(1) | (readByte(2) << 8)
    return { disassembly: `SHLD 0x${hex4(a)}`, length: 3 }
  }
  if (opcode === 0x2a) {
    const a = readByte(1) | (readByte(2) << 8)
    return { disassembly: `LHLD 0x${hex4(a)}`, length: 3 }
  }
  if (opcode === 0x32) {
    const a = readByte(1) | (readByte(2) << 8)
    return { disassembly: `STA 0x${hex4(a)}`, length: 3 }
  }
  if (opcode === 0x3a) {
    const a = readByte(1) | (readByte(2) << 8)
    return { disassembly: `LDA 0x${hex4(a)}`, length: 3 }
  }

  if ((opcode & 0xcf) === 0xc1) {
    return { disassembly: `POP ${PUSH_PAIRS[p]}`, length: 1 }
  }
  if ((opcode & 0xcf) === 0xc5) {
    return { disassembly: `PUSH ${PUSH_PAIRS[p]}`, length: 1 }
  }

  if ((opcode & 0xc7) === 0xc0) {
    return { disassembly: RET_MNE[d], length: 1 }
  }

  if ((opcode & 0xc7) === 0xc2) {
    const a = readByte(1) | (readByte(2) << 8)
    return { disassembly: `${JMP_MNE[d]} 0x${hex4(a)}`, length: 3 }
  }

  if ((opcode & 0xc7) === 0xc4) {
    const a = readByte(1) | (readByte(2) << 8)
    return { disassembly: `${CALL_MNE[d]} 0x${hex4(a)}`, length: 3 }
  }

  if ((opcode & 0xc7) === 0xc7) {
    return { disassembly: `RST ${d}`, length: 1 }
  }

  const imm = immTable[opcode]
  if (imm) {
    return { disassembly: `${imm} #0x${hex2(readByte(1))}`, length: 2 }
  }

  return null
}

const aluTable: Record<
  number,
  (r: string) => { disassembly: string; length: number } | null
> = {
  0x80: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x81: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x82: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x83: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x84: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x85: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x86: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x87: (r) => ({ disassembly: `ADD ${r}`, length: 1 }),
  0x88: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x89: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x8a: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x8b: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x8c: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x8d: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x8e: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x8f: (r) => ({ disassembly: `ADC ${r}`, length: 1 }),
  0x90: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x91: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x92: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x93: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x94: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x95: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x96: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x97: (r) => ({ disassembly: `SUB ${r}`, length: 1 }),
  0x98: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x99: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x9a: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x9b: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x9c: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x9d: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x9e: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0x9f: (r) => ({ disassembly: `SBB ${r}`, length: 1 }),
  0xa0: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa1: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa2: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa3: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa4: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa5: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa6: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa7: (r) => ({ disassembly: `ANA ${r}`, length: 1 }),
  0xa8: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xa9: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xaa: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xab: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xac: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xad: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xae: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xaf: (r) => ({ disassembly: `XRA ${r}`, length: 1 }),
  0xb0: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb1: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb2: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb3: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb4: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb5: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb6: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb7: (r) => ({ disassembly: `ORA ${r}`, length: 1 }),
  0xb8: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xb9: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xba: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xbb: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xbc: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xbd: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xbe: (r) => ({ disassembly: `CMP ${r}`, length: 1 }),
  0xbf: (r) => ({ disassembly: `CMP ${r}`, length: 1 })
}

const immTable: Record<number, string> = {
  0xc6: 'ADI',
  0xce: 'ACI',
  0xd6: 'SUI',
  0xde: 'SBI',
  0xe6: 'ANI',
  0xee: 'XRI',
  0xf6: 'ORI',
  0xfe: 'CPI'
}
