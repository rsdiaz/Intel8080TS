import process from 'node:process'

import { ExampleComputer } from '../ExampleComputer'

/**
 * Ejemplo 02: Factorial de 5.
 *
 * Calcula 5! = 120 usando una subrutina de multiplicación basada en
 * sumas sucesivas (el 8080 no tiene instrucción MUL).
 *
 * Algoritmo:
 *   A = 1                ; acumulador del producto
 *   B = 5                ; contador
 *   loop: A = A * B      ; vía subrutina
 *         B = B - 1
 *         si B != 0 → loop
 *   OUT A                ; envía 120 al puerto 1 (carácter 'x')
 *
 * Instrucciones nuevas respecto al ejemplo 01:
 *   - LXI SP, d16  : inicializa el stack pointer.
 *   - CALL addr    : llama subrutina.
 *   - RET          : retorna de subrutina.
 *   - DCR r        : decrementa registro y actualiza flag Z.
 *   - JNZ addr     : salta si Z == 0.
 *   - ADD r, MOV r,r.
 */
export default function runFactorial({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)

  // Cargado en 0x2000 (default de loadProgram).
  // Cada comentario indica la dirección absoluta del opcode.
  const program = [
    // ─── main ────────────────────────────────────────────────
    0x31, 0x00, 0xf0, // 2000: LXI SP, 0xF000      ; stack en zona alta
    0x3e, 0x01,       // 2003: MVI A, 0x01         ; producto = 1
    0x06, 0x05,       // 2005: MVI B, 0x05         ; contador  = 5
    // loop (0x2007):
    0xcd, 0x11, 0x20, // 2007: CALL 0x2011         ; A = A * B
    0x05,             // 200A: DCR B               ; B--
    0xc2, 0x07, 0x20, // 200B: JNZ 0x2007          ; si B != 0, vuelve
    0xd3, 0x01,       // 200E: OUT 0x01            ; imprime 120 = 'x'
    0x76,             // 2010: HLT
    // ─── multiply (0x2011) ───────────────────────────────────
    // entrada: A = multiplicando, B = multiplicador (asumido > 0)
    // salida:  A = A * B   (modifica C y D; B se preserva)
    0x4f,             // 2011: MOV C, A            ; C = multiplicando
    0x50,             // 2012: MOV D, B            ; D = contador local
    0x3e, 0x00,       // 2013: MVI A, 0x00         ; A = 0 (suma)
    // mul_loop (0x2015):
    0x81,             // 2015: ADD C               ; A += C
    0x15,             // 2016: DCR D               ; D--
    0xc2, 0x15, 0x20, // 2017: JNZ 0x2015          ; si D != 0, vuelve
    0xc9              // 201A: RET
  ]

  computer.loadProgram(program)
  computer.executeProgram()

  const result = computer.getRegisterValue('A')
  process.stdout.write(`\nResultado: 5! = ${result} (0x${result.toString(16)})\n`)
}
