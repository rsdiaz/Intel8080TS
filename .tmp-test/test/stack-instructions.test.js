"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Bus_1 = require("../src/core/Bus");
const Intel8080_1 = require("../src/core/Intel8080");
const runSingleInstruction = (cpu, bus, opcode, startAddress = 0x2000) => {
    bus.writeRam(opcode, startAddress);
    cpu.registers.programCounter = startAddress;
    cpu.executeNextInstruction();
};
(0, node_test_1.default)('PUSH B stores BC on stack and updates SP', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.B = 0x12;
    cpu.registers.C = 0x34;
    cpu.registers.stackPointer = 0x4000;
    runSingleInstruction(cpu, bus, 0xc5);
    strict_1.default.equal(cpu.registers.stackPointer, 0x3ffe);
    strict_1.default.equal(bus.readRam(0x3fff), 0x12);
    strict_1.default.equal(bus.readRam(0x3ffe), 0x34);
});
(0, node_test_1.default)('POP D restores DE from stack and updates SP', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.stackPointer = 0x3ffe;
    bus.writeRam(0xab, 0x3fff);
    bus.writeRam(0xcd, 0x3ffe);
    runSingleInstruction(cpu, bus, 0xd1);
    strict_1.default.equal(cpu.registers.D, 0xab);
    strict_1.default.equal(cpu.registers.E, 0xcd);
    strict_1.default.equal(cpu.registers.stackPointer, 0x4000);
});
