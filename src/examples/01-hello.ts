import { ExampleComputer } from '../ExampleComputer'

/**
 * Ejemplo 01: Hello.
 *
 * El programa más simple: carga dos caracteres en el acumulador y los
 * envía por el puerto 1 (consola). Termina con HLT.
 *
 * Instrucciones usadas:
 *   - MVI r, d8   : carga un byte inmediato en un registro.
 *   - OUT port    : envía el contenido del acumulador a un puerto.
 *   - HLT         : detiene la CPU.
 */
export default function runHello({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)

  const program = [
    0x3e, 0x41, // MVI A, 0x41   ; A = 'A'
    0xd3, 0x01, // OUT 0x01      ; envía A al puerto 1
    0x3e, 0x42, // MVI A, 0x42   ; A = 'B'
    0xd3, 0x01, // OUT 0x01      ; envía A al puerto 1
    0x76 // HLT           ; detiene la CPU
  ]

  computer.loadProgram(program)
  computer.executeProgram()
}
