import process from 'node:process'

import { ExampleComputer } from '../ExampleComputer'

/**
 * Ejemplo 03: Fibonacci.
 *
 * Calcula los primeros 10 números de Fibonacci (comenzando en 1) y los
 * almacena en memoria a partir de la dirección 0x3000.
 *
 * Algoritmo:
 *   HL = 0x3000          ; puntero de escritura
 *   B  = 0               ; fib(n-1)
 *   C  = 1               ; fib(n)
 *   D  = 10              ; contador
 *   loop:
 *     M = C              ; *HL = C
 *     A = B + C          ; siguiente Fibonacci
 *     B = C
 *     C = A
 *     HL++
 *     D--
 *     si D != 0 → loop
 *
 * Instrucciones nuevas respecto al ejemplo anterior:
 *   - LXI H, d16  : carga un valor de 16 bits en HL.
 *   - MOV M, r    : escribe en memoria apuntada por HL.
 *   - INX H       : incrementa HL (par de 16 bits).
 */
export default function runFibonacci({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)

  const program = [
    0x31, 0x00, 0xf0, // 2000: LXI SP, 0xF000
    0x21, 0x00, 0x30, // 2003: LXI H, 0x3000     ; HL = puntero a buffer
    0x06, 0x00,       // 2006: MVI B, 0x00       ; fib(n-1) = 0
    0x0e, 0x01,       // 2008: MVI C, 0x01       ; fib(n)   = 1
    0x16, 0x0a,       // 200A: MVI D, 0x0A       ; contador = 10
    // loop (0x200C):
    0x71,             // 200C: MOV M, C          ; *HL = C
    0x78,             // 200D: MOV A, B          ; A = B
    0x81,             // 200E: ADD C             ; A = B + C
    0x41,             // 200F: MOV B, C          ; B = C
    0x4f,             // 2010: MOV C, A          ; C = A
    0x23,             // 2011: INX H             ; HL++
    0x15,             // 2012: DCR D             ; D--
    0xc2, 0x0c, 0x20, // 2013: JNZ 0x200C
    0x76              // 2016: HLT
  ]

  computer.loadProgram(program)
  computer.executeProgram()

  // Leemos los 10 bytes resultantes desde memoria.
  const values: number[] = []
  for (let i = 0; i < 10; i++) {
    values.push(computer.bus.readRam(0x3000 + i))
  }

  process.stdout.write(
    `\nFibonacci (10 primeros) en 0x3000: ${values.join(', ')}\n`
  )
}
