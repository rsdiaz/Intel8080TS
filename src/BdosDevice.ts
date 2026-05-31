import process from 'node:process'

import { Computer } from './core/Computer'
import { Device } from './core/Device'

/**
 * Mínimo stub de CP/M BDOS. Se invoca cuando el programa hace `CALL 0x0005`.
 * Soporta las dos llamadas usadas por CPUDIAG y la mayoría de diagnósticos:
 *   - Function 2 (C=2): imprimir el carácter contenido en E.
 *   - Function 9 (C=9): imprimir cadena terminada en '$' apuntada por DE.
 */
export class BdosDevice implements Device {
  constructor(private computer: Computer) {}

  read(port: number): number {
    throw new Error(`BDOS read not supported on port ${port}`)
  }

  write(_port: number, _value: number): void {
    const functionCode = this.computer.getRegisterValue('C') & 0xff

    if (functionCode === 2) {
      const charCode = this.computer.getRegisterValue('E') & 0xff
      process.stdout.write(String.fromCharCode(charCode))
      return
    }

    if (functionCode === 9) {
      const highByte = this.computer.getRegisterValue('D') & 0xff
      const lowByte = this.computer.getRegisterValue('E') & 0xff
      let address = (highByte << 8) | lowByte

      // Salvaguarda: máximo 64KB de cadena.
      for (let i = 0; i < 0x10000; i++) {
        const byte = this.computer.bus.readRam(address)
        if (byte === 0x24) {
          // '$' marca el fin de la cadena en CP/M.
          return
        }
        process.stdout.write(String.fromCharCode(byte))
        address = (address + 1) & 0xffff
      }
    }
  }
}
