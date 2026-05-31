import process from 'node:process'

import { ExampleComputer } from '../ExampleComputer'

/**
 * Ejemplo 04: Multiplicación 7 × 6.
 *
 * Aísla la subrutina de multiplicación del ejemplo factorial para
 * mostrar de forma más limpia el patrón CALL/RET y la convención
 * "registros como argumentos".
 *
 * Algoritmo:
 *   A = 7, B = 6 → multiply → A = 42 ('*' ASCII)
 *
 * Convención de la subrutina `multiply`:
 *   Entrada: A = multiplicando, B = multiplicador (asumido > 0)
 *   Salida:  A = A * B
 *   Modifica: C, D
 *   Preserva: B (no se toca)
 */
export default function runMultiply({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)

  const program = [
    // ─── main ────────────────────────────────────────────────
    0x31, 0x00, 0xf0, // 2000: LXI SP, 0xF000
    0x3e, 0x07,       // 2003: MVI A, 0x07         ; multiplicando
    0x06, 0x06,       // 2005: MVI B, 0x06         ; multiplicador
    0xcd, 0x0d, 0x20, // 2007: CALL 0x200D         ; A = A * B
    0xd3, 0x01,       // 200A: OUT 0x01            ; imprime '*' (0x2A = 42)
    0x76,             // 200C: HLT
    // ─── multiply (0x200D) ──────────────────────────────────
    0x4f,             // 200D: MOV C, A            ; C = multiplicando
    0x50,             // 200E: MOV D, B            ; D = contador
    0x3e, 0x00,       // 200F: MVI A, 0x00         ; A = 0 (suma)
    // mul_loop (0x2011):
    0x81,             // 2011: ADD C               ; A += C
    0x15,             // 2012: DCR D               ; D--
    0xc2, 0x11, 0x20, // 2013: JNZ 0x2011
    0xc9              // 2016: RET
  ]

  computer.loadProgram(program)
  computer.executeProgram()

  const result = computer.getRegisterValue('A')
  process.stdout.write(
    `\nResultado: 7 × 6 = ${result} (0x${result.toString(16)} = '${String.fromCharCode(result)}')\n`
  )
}
