"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleComputer = void 0;
const ConsoleDevice_1 = require("./ConsoleDevice");
const Computer_1 = require("./core/Computer");
class ExampleComputer extends Computer_1.Computer {
    consoleDevice;
    constructor(debug = false) {
        super(debug);
        this.consoleDevice = new ConsoleDevice_1.ConsoleDevice(debug);
        this.bus.connectDeviceToWritePort(0x01, this.consoleDevice);
    }
}
exports.ExampleComputer = ExampleComputer;
