import { ExampleComputer } from '../ExampleComputer'

/**
 * Ejemplo 05: Impresión de cadena terminada en '$'.
 *
 * Convención CP/M clásica: una cadena se delimita por el carácter '$'
 * (0x24). El programa recorre la cadena byte por byte, imprime cada
 * carácter por el puerto 1 y se detiene cuando encuentra el centinela.
 *
 * Algoritmo:
 *   HL = dirección de la cadena
 *   loop:
 *     A = *HL
 *     si A == '$' → done
 *     OUT 1
 *     HL++
 *     JMP loop
 *   done: HLT
 *
 * Instrucciones nuevas:
 *   - CPI d8   : compara acumulador con inmediato (setea flags).
 *   - JZ addr  : salta si Z == 1.
 *   - JMP addr : salto incondicional.
 */
export default function runStringPrint({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)

  //
  //   0x2000  31 00 F0       LXI SP, 0xF000
  //   0x2003  21 13 20       LXI H, 0x2013      ; puntero a la cadena
  //   0x2006  7E             MOV A, M            ; A = *HL          ; loop:
  //   0x2007  FE 24          CPI 0x24            ; ¿A == '$'?
  //   0x2009  CA 12 20       JZ 0x2012           ; si sí, salir
  //   0x200C  D3 01          OUT 0x01            ; imprime carácter
  //   0x200E  23             INX H               ; HL++
  //   0x200F  C3 06 20       JMP 0x2006          ; vuelve a loop
  //   0x2012  76             HLT                  ; done
  //   0x2013  "Hello, 8080!\n$"                   ; datos
  //
  const program = [
    0x31, 0x00, 0xf0,
    0x21, 0x13, 0x20,
    0x7e,
    0xfe, 0x24,
    0xca, 0x12, 0x20,
    0xd3, 0x01,
    0x23,
    0xc3, 0x06, 0x20,
    0x76,
    // Cadena "Hello, 8080!\n$"
    0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20,
    0x38, 0x30, 0x38, 0x30, 0x21, 0x0a, 0x24
  ]

  computer.loadProgram(program)
  computer.executeProgram()
}
