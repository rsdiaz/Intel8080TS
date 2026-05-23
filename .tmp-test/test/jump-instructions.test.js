"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Intel8080_1 = require("../src/core/Intel8080");
const Bus_1 = require("../src/core/Bus");
const runSingleInstruction = (cpu, bus, opcode, lowByte, highByte, startAddress = 0x2000) => {
    bus.writeRam(opcode, startAddress);
    bus.writeRam(lowByte, startAddress + 1);
    bus.writeRam(highByte, startAddress + 2);
    cpu.registers.programCounter = startAddress;
    cpu.executeNextInstruction();
};
(0, node_test_1.default)('JMP always jumps to target address', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    runSingleInstruction(cpu, bus, 0xc3, 0x34, 0x12);
    strict_1.default.equal(cpu.registers.programCounter, 0x1234);
});
(0, node_test_1.default)('JZ jumps when zero flag is set', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.flags |= 1 << Intel8080_1.Flag.Z;
    runSingleInstruction(cpu, bus, 0xca, 0x78, 0x56);
    strict_1.default.equal(cpu.registers.programCounter, 0x5678);
});
(0, node_test_1.default)('JZ does not jump when zero flag is clear', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.flags &= ~(1 << Intel8080_1.Flag.Z);
    runSingleInstruction(cpu, bus, 0xca, 0x78, 0x56);
    strict_1.default.equal(cpu.registers.programCounter, 0x2003);
});
(0, node_test_1.default)('JNZ jumps when zero flag is clear', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.flags &= ~(1 << Intel8080_1.Flag.Z);
    runSingleInstruction(cpu, bus, 0xc2, 0xbc, 0x9a);
    strict_1.default.equal(cpu.registers.programCounter, 0x9abc);
});
(0, node_test_1.default)('JNZ does not jump when zero flag is set', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.flags |= 1 << Intel8080_1.Flag.Z;
    runSingleInstruction(cpu, bus, 0xc2, 0xbc, 0x9a);
    strict_1.default.equal(cpu.registers.programCounter, 0x2003);
});
