"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Bus_1 = require("../src/core/Bus");
const Intel8080_1 = require("../src/core/Intel8080");
const runInstruction = (cpu, bus, bytes, startAddress = 0x2000) => {
    for (const [index, byte] of bytes.entries()) {
        bus.writeRam(byte, startAddress + index);
    }
    cpu.registers.programCounter = startAddress;
    cpu.executeNextInstruction();
};
(0, node_test_1.default)('Rotate and carry instructions mutate A/carry correctly', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x81;
    runInstruction(cpu, bus, [0x07]);
    strict_1.default.equal(cpu.registers.A, 0x03);
    strict_1.default.equal((cpu.flags & (1 << Intel8080_1.Flag.C)) !== 0, true);
    runInstruction(cpu, bus, [0x0f]);
    strict_1.default.equal(cpu.registers.A, 0x81);
    runInstruction(cpu, bus, [0x37]);
    strict_1.default.equal((cpu.flags & (1 << Intel8080_1.Flag.C)) !== 0, true);
    runInstruction(cpu, bus, [0x3f]);
    strict_1.default.equal((cpu.flags & (1 << Intel8080_1.Flag.C)) !== 0, false);
});
(0, node_test_1.default)('Conditional jumps/calls/returns use carry condition', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runInstruction(cpu, bus, [0xda, 0x34, 0x12]);
    strict_1.default.equal(cpu.registers.programCounter, 0x1234);
    cpu.registers.stackPointer = 0x5000;
    runInstruction(cpu, bus, [0xdc, 0x78, 0x56], 0x3000);
    strict_1.default.equal(cpu.registers.programCounter, 0x5678);
    strict_1.default.equal(cpu.registers.stackPointer, 0x4ffe);
    bus.writeRam(0x03, 0x4ffe);
    bus.writeRam(0x30, 0x4fff);
    runInstruction(cpu, bus, [0xd8], 0x5678);
    strict_1.default.equal(cpu.registers.programCounter, 0x3003);
});
(0, node_test_1.default)('PUSH/POP PSW preserves accumulator and flags', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x5a;
    cpu.flags = 0;
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    cpu.flags |= 1 << Intel8080_1.Flag.Z;
    cpu.registers.stackPointer = 0x4000;
    runInstruction(cpu, bus, [0xf5]);
    cpu.registers.A = 0x00;
    cpu.flags = 0;
    runInstruction(cpu, bus, [0xf1], 0x2001);
    strict_1.default.equal(cpu.registers.A, 0x5a);
    strict_1.default.equal((cpu.flags & (1 << Intel8080_1.Flag.C)) !== 0, true);
    strict_1.default.equal((cpu.flags & (1 << Intel8080_1.Flag.Z)) !== 0, true);
});
