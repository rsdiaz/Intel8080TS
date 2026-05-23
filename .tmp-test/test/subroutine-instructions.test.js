"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Bus_1 = require("../src/core/Bus");
const Intel8080_1 = require("../src/core/Intel8080");
const runInstructionAt = (cpu, bus, startAddress, bytes) => {
    for (const [index, value] of bytes.entries()) {
        bus.writeRam(value, startAddress + index);
    }
    cpu.registers.programCounter = startAddress;
    cpu.executeNextInstruction();
};
(0, node_test_1.default)('CALL pushes return address and jumps to target', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.stackPointer = 0x5000;
    runInstructionAt(cpu, bus, 0x2000, [0xcd, 0x34, 0x12]);
    strict_1.default.equal(cpu.registers.programCounter, 0x1234);
    strict_1.default.equal(cpu.registers.stackPointer, 0x4ffe);
    strict_1.default.equal(bus.readRam(0x4fff), 0x20);
    strict_1.default.equal(bus.readRam(0x4ffe), 0x03);
});
(0, node_test_1.default)('RET pops return address into program counter', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.stackPointer = 0x4ffe;
    bus.writeRam(0x20, 0x4fff);
    bus.writeRam(0x03, 0x4ffe);
    runInstructionAt(cpu, bus, 0x1234, [0xc9]);
    strict_1.default.equal(cpu.registers.programCounter, 0x2003);
    strict_1.default.equal(cpu.registers.stackPointer, 0x5000);
});
