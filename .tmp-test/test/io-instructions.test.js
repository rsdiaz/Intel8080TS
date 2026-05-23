"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Bus_1 = require("../src/core/Bus");
const Intel8080_1 = require("../src/core/Intel8080");
class InputDeviceStub {
    value;
    constructor(value) {
        this.value = value;
    }
    read() {
        return this.value;
    }
    write() {
        throw new Error('write should not be called for InputDeviceStub');
    }
}
class OutputDeviceSpy {
    writes = [];
    read() {
        throw new Error('read should not be called for OutputDeviceSpy');
    }
    write(port, value) {
        this.writes.push({ port, value });
    }
}
(0, node_test_1.default)('IN reads from bus device and stores value in accumulator', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    const inputDevice = new InputDeviceStub(0xab);
    bus.connectDeviceToReadPort(0x02, inputDevice);
    bus.writeRam(0xdb, 0x2000);
    bus.writeRam(0x02, 0x2001);
    cpu.registers.programCounter = 0x2000;
    cpu.executeNextInstruction();
    strict_1.default.equal(cpu.registers.A, 0xab);
    strict_1.default.equal(cpu.registers.programCounter, 0x2002);
});
(0, node_test_1.default)('IN then OUT forwards input byte to output device', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    const inputDevice = new InputDeviceStub(0x41);
    const outputDevice = new OutputDeviceSpy();
    bus.connectDeviceToReadPort(0x02, inputDevice);
    bus.connectDeviceToWritePort(0x01, outputDevice);
    const program = [0xdb, 0x02, 0xd3, 0x01, 0x76];
    for (const [index, opcode] of program.entries()) {
        bus.writeRam(opcode, 0x2100 + index);
    }
    cpu.registers.programCounter = 0x2100;
    while (!cpu.halted) {
        cpu.executeNextInstruction();
    }
    strict_1.default.equal(cpu.registers.A, 0x41);
    strict_1.default.deepEqual(outputDevice.writes, [{ port: 0x01, value: 0x41 }]);
});
