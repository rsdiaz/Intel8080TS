import { BdosDevice } from './BdosDevice'
import { Computer } from './core/Computer'

/**
 * Computador configurado para correr binarios .COM de CP/M tipo "diagnóstico"
 * (CPUDIAG.COM, TST8080.COM, 8080EXM.COM, etc.).
 *
 * Conviene saber:
 *  - Los .COM se cargan en 0x0100 (área de programa transitorio, TPA).
 *  - El programa accede al sistema operativo llamando a `CALL 0x0005`
 *    (entrada BDOS). Aquí inyectamos un trampolín mínimo que delega en
 *    `BdosDevice` por el puerto 0xFF.
 *  - En 0x0000 (warm boot) ponemos HLT, así si el programa retorna o
 *    salta a 0, el emulador se detiene.
 */
export class CpuDiagComputer extends Computer {
  constructor(debug = false, bdosOutput?: (char: string) => void) {
    super(debug)

    const bdosDevice = new BdosDevice(this, bdosOutput)
    this.bus.connectDeviceToWritePort(0xff, bdosDevice)

    // Trampolín BDOS en 0x0005: OUT 0xFF ; RET
    this.bus.writeRam(0xd3, 0x0005)
    this.bus.writeRam(0xff, 0x0006)
    this.bus.writeRam(0xc9, 0x0007)

    // Vector de warm boot en 0x0000: HLT
    this.bus.writeRam(0x76, 0x0000)
  }

  public runDiagnostic(
    romPath: string,
    loadAddress = 0x0100,
    stackPointer = 0xf000
  ) {
    this.loadProgramFromFile(romPath, loadAddress)
    this.setStackPointer(stackPointer)
    this.setProgramCounter(loadAddress)
    this.executeProgram()
  }
}
