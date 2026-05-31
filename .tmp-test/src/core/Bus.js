"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bus = void 0;
const Memory_1 = require("./Memory");
class Bus {
    memory;
    cpu;
    writeDevices;
    readDevices;
    constructor() {
        this.memory = new Memory_1.Memory();
        this.writeDevices = [];
        this.readDevices = [];
    }
    connectCPU(cpu) {
        this.cpu = cpu;
    }
    connectMemory(memory) {
        this.memory = memory;
    }
    connectDeviceToWritePort(port, device) {
        this.writeDevices[port] = device;
    }
    connectDeviceToReadPort(port, device) {
        this.readDevices[port] = device;
    }
    writeRam(value, address) {
        this.memory.write(value, address);
    }
    readRam(address) {
        return this.memory.read(address);
    }
    writeDevice(port, value) {
        const device = this.writeDevices[port];
        if (!device) {
            throw new Error(`No write device connected on port ${port}`);
        }
        device.write(port, value);
    }
    readDevice(port) {
        const device = this.readDevices[port];
        if (!device) {
            throw new Error(`No read device connected on port ${port}`);
        }
        return device.read(port);
    }
}
exports.Bus = Bus;
