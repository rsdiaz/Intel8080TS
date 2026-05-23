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
const isFlagSet = (cpu, flag) => (cpu.flags & (1 << flag)) !== 0;
(0, node_test_1.default)('ADC and SBB include carry/borrow input', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x10;
    cpu.registers.B = 0x0f;
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runInstruction(cpu, bus, [0x88]);
    strict_1.default.equal(cpu.registers.A, 0x20);
    cpu.registers.C = 0x01;
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runInstruction(cpu, bus, [0x99]);
    strict_1.default.equal(cpu.registers.A, 0x1e);
});
(0, node_test_1.default)('Immediate ALU opcodes mutate accumulator as expected', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x20;
    runInstruction(cpu, bus, [0xc6, 0x10]);
    strict_1.default.equal(cpu.registers.A, 0x30);
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runInstruction(cpu, bus, [0xce, 0x01]);
    strict_1.default.equal(cpu.registers.A, 0x32);
    runInstruction(cpu, bus, [0xd6, 0x02]);
    strict_1.default.equal(cpu.registers.A, 0x30);
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runInstruction(cpu, bus, [0xde, 0x01]);
    strict_1.default.equal(cpu.registers.A, 0x2e);
    runInstruction(cpu, bus, [0xe6, 0x0f]);
    strict_1.default.equal(cpu.registers.A, 0x0e);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.C), false);
    runInstruction(cpu, bus, [0xee, 0x03]);
    strict_1.default.equal(cpu.registers.A, 0x0d);
    runInstruction(cpu, bus, [0xf6, 0x80]);
    strict_1.default.equal(cpu.registers.A, 0x8d);
});
(0, node_test_1.default)('CMP and CPI update flags without modifying accumulator', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x22;
    cpu.registers.D = 0x22;
    runInstruction(cpu, bus, [0xba]);
    strict_1.default.equal(cpu.registers.A, 0x22);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.Z), true);
    runInstruction(cpu, bus, [0xfe, 0x30]);
    strict_1.default.equal(cpu.registers.A, 0x22);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.C), true);
});
