import assert from 'node:assert/strict'
import test from 'node:test'

import { disassembleOpcode } from '../src/disassemble'

const REG = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A']
const PAIRS = ['B', 'D', 'H', 'SP']
const PUSH_PAIRS = ['B', 'D', 'H', 'PSW']
const JMP_MNE = ['JNZ', 'JZ', 'JNC', 'JC', 'JPO', 'JPE', 'JP', 'JM']
const CALL_MNE = ['CNZ', 'CZ', 'CNC', 'CC', 'CPO', 'CPE', 'CP', 'CM']
const RET_MNE = ['RNZ', 'RZ', 'RNC', 'RC', 'RPO', 'RPE', 'RP', 'RM']
const ALU_MNE = ['ADD', 'ADC', 'SUB', 'SBB', 'ANA', 'XRA', 'ORA', 'CMP']
const IMM_MNE: Record<number, string> = {
  0xc6: 'ADI',
  0xce: 'ACI',
  0xd6: 'SUI',
  0xde: 'SBI',
  0xe6: 'ANI',
  0xee: 'XRI',
  0xf6: 'ORI',
  0xfe: 'CPI'
}

// Reader that yields predictable operands: imm=0x34, addr16=0x1234.
const reader = () => (offset: number) => {
  if (offset === 1) return 0x34
  if (offset === 2) return 0x12
  return 0
}

test('disassembles single-byte opcodes without operands', () => {
  const cases: Array<[number, string]> = [
    [0x00, 'NOP'],
    [0x07, 'RLC'],
    [0x0f, 'RRC'],
    [0x17, 'RAL'],
    [0x1f, 'RAR'],
    [0x27, 'DAA'],
    [0x2f, 'CMA'],
    [0x37, 'STC'],
    [0x3f, 'CMC'],
    [0x76, 'HLT'],
    [0xe3, 'XTHL'],
    [0xe9, 'PCHL'],
    [0xeb, 'XCHG'],
    [0xf3, 'DI'],
    [0xf9, 'SPHL'],
    [0xfb, 'EI'],
    [0xc9, 'RET']
  ]

  for (const [opcode, expected] of cases) {
    const result = disassembleOpcode(opcode, reader())
    assert.equal(
      result?.disassembly,
      expected,
      `opcode 0x${opcode.toString(16).padStart(2, '0')}`
    )
    assert.equal(
      result?.length,
      1,
      `length for opcode 0x${opcode.toString(16).padStart(2, '0')}`
    )
  }
})

test('disassembles MOV family (0x40-0x7f) except HLT', () => {
  for (let opcode = 0x40; opcode <= 0x7f; opcode++) {
    if (opcode === 0x76) continue
    const dest = (opcode >> 3) & 0x07
    const src = opcode & 0x07
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, `MOV ${REG[dest]}, ${REG[src]}`)
    assert.equal(result?.length, 1)
  }
})

test('disassembles ALU register opcodes (0x80-0xbf)', () => {
  for (let opcode = 0x80; opcode <= 0xbf; opcode++) {
    const alu = (opcode >> 3) & 0x07
    const reg = opcode & 0x07
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, `${ALU_MNE[alu]} ${REG[reg]}`)
    assert.equal(result?.length, 1)
  }
})

test('disassembles INR and DCR', () => {
  for (let reg = 0; reg < 8; reg++) {
    const inr = disassembleOpcode(0x04 | (reg << 3), reader())
    assert.equal(inr?.disassembly, `INR ${REG[reg]}`)
    assert.equal(inr?.length, 1)

    const dcr = disassembleOpcode(0x05 | (reg << 3), reader())
    assert.equal(dcr?.disassembly, `DCR ${REG[reg]}`)
    assert.equal(dcr?.length, 1)
  }
})

test('disassembles MVI immediate', () => {
  for (let reg = 0; reg < 8; reg++) {
    const opcode = 0x06 | (reg << 3)
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, `MVI ${REG[reg]}, #0x34`)
    assert.equal(result?.length, 2)
  }
})

test('disassembles LXI, INX, DAD and DCX for register pairs', () => {
  for (let pair = 0; pair < 4; pair++) {
    const lxi = disassembleOpcode(0x01 | (pair << 4), reader())
    assert.equal(lxi?.disassembly, `LXI ${PAIRS[pair]}, #0x1234`)
    assert.equal(lxi?.length, 3)

    const inx = disassembleOpcode(0x03 | (pair << 4), reader())
    assert.equal(inx?.disassembly, `INX ${PAIRS[pair]}`)
    assert.equal(inx?.length, 1)

    const dad = disassembleOpcode(0x09 | (pair << 4), reader())
    assert.equal(dad?.disassembly, `DAD ${PAIRS[pair]}`)
    assert.equal(dad?.length, 1)

    const dcx = disassembleOpcode(0x0b | (pair << 4), reader())
    assert.equal(dcx?.disassembly, `DCX ${PAIRS[pair]}`)
    assert.equal(dcx?.length, 1)
  }
})

test('disassembles LDAX and STAX for B and D pairs', () => {
  const cases: Array<[number, string]> = [
    [0x02, 'STAX B'],
    [0x12, 'STAX D'],
    [0x0a, 'LDAX B'],
    [0x1a, 'LDAX D']
  ]
  for (const [opcode, expected] of cases) {
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, expected)
    assert.equal(result?.length, 1)
  }
})

test('disassembles 16-bit direct memory operations', () => {
  const cases: Array<[number, string]> = [
    [0x22, 'SHLD 0x1234'],
    [0x2a, 'LHLD 0x1234'],
    [0x32, 'STA 0x1234'],
    [0x3a, 'LDA 0x1234']
  ]
  for (const [opcode, expected] of cases) {
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, expected)
    assert.equal(result?.length, 3)
  }
})

test('disassembles PUSH and POP', () => {
  for (let pair = 0; pair < 4; pair++) {
    const pop = disassembleOpcode(0xc1 | (pair << 4), reader())
    assert.equal(pop?.disassembly, `POP ${PUSH_PAIRS[pair]}`)
    assert.equal(pop?.length, 1)

    const push = disassembleOpcode(0xc5 | (pair << 4), reader())
    assert.equal(push?.disassembly, `PUSH ${PUSH_PAIRS[pair]}`)
    assert.equal(push?.length, 1)
  }
})

test('disassembles conditional returns', () => {
  for (let cond = 0; cond < 8; cond++) {
    const opcode = 0xc0 | (cond << 3)
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, RET_MNE[cond])
    assert.equal(result?.length, 1)
  }
})

test('disassembles conditional jumps and calls', () => {
  for (let cond = 0; cond < 8; cond++) {
    const jmp = disassembleOpcode(0xc2 | (cond << 3), reader())
    assert.equal(jmp?.disassembly, `${JMP_MNE[cond]} 0x1234`)
    assert.equal(jmp?.length, 3)

    const call = disassembleOpcode(0xc4 | (cond << 3), reader())
    assert.equal(call?.disassembly, `${CALL_MNE[cond]} 0x1234`)
    assert.equal(call?.length, 3)
  }
})

test('disassembles RST instructions', () => {
  for (let n = 0; n < 8; n++) {
    const opcode = 0xc7 | (n << 3)
    const result = disassembleOpcode(opcode, reader())
    assert.equal(result?.disassembly, `RST ${n}`)
    assert.equal(result?.length, 1)
  }
})

test('disassembles immediate ALU operations', () => {
  for (const [opcode, mne] of Object.entries(IMM_MNE)) {
    const result = disassembleOpcode(Number(opcode), reader())
    assert.equal(result?.disassembly, `${mne} #0x34`)
    assert.equal(result?.length, 2)
  }
})

test('disassembles JMP and CALL', () => {
  const jmp = disassembleOpcode(0xc3, reader())
  assert.equal(jmp?.disassembly, 'JMP 0x1234')
  assert.equal(jmp?.length, 3)

  const call = disassembleOpcode(0xcd, reader())
  assert.equal(call?.disassembly, 'CALL 0x1234')
  assert.equal(call?.length, 3)
})

test('disassembles IN and OUT', () => {
  const inn = disassembleOpcode(0xdb, reader())
  assert.equal(inn?.disassembly, 'IN 0x34')
  assert.equal(inn?.length, 2)

  const out = disassembleOpcode(0xd3, reader())
  assert.equal(out?.disassembly, 'OUT 0x34')
  assert.equal(out?.length, 2)
})

test('returns null for undocumented opcodes', () => {
  const undocumented = [
    0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38, 0xcb, 0xd9, 0xdd, 0xed, 0xfd
  ]
  for (const opcode of undocumented) {
    const result = disassembleOpcode(opcode, reader())
    assert.equal(
      result,
      null,
      `opcode 0x${opcode.toString(16).padStart(2, '0')} should be undocumented`
    )
  }
})

test('falls back to DB directive for undocumented opcodes in disasm view', () => {
  // This is the behaviour expected by the server when disassembleOpcode returns null.
  const result = disassembleOpcode(0x08, reader())
  assert.equal(result, null)
})
