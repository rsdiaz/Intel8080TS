import { ConsoleDevice } from './ConsoleDevice'
import { Computer } from './core/Computer'

export class ExampleComputer extends Computer {
  consoleDevice: ConsoleDevice

  constructor(debug = false) {
    super(debug)
    this.consoleDevice = new ConsoleDevice(debug)
    this.bus.connectDeviceToWritePort(0x01, this.consoleDevice)
  }
}
