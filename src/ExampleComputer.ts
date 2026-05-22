import { ConsoleDevice } from "./ConsoleDevice";
import { Computer } from "./core/Computer";

export class ExampleComputer extends Computer {
  consoleDevice: ConsoleDevice

  constructor() {
    super()
    this.consoleDevice = new ConsoleDevice()
    this.bus.connectDeviceToWritePort(0x01, this.consoleDevice)
  }
}