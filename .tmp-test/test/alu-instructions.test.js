"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Bus_1 = require("../src/core/Bus");
const Intel8080_1 = require("../src/core/Intel8080");
const runSingleInstruction = (cpu, bus, opcode, operand) => {
    const startAddress = 0x2000;
    bus.writeRam(opcode, startAddress);
    if (typeof operand === 'number') {
        bus.writeRam(operand, startAddress + 1);
    }
    cpu.registers.programCounter = startAddress;
    cpu.executeNextInstruction();
};
const isFlagSet = (cpu, flag) => (cpu.flags & (1 << flag)) !== 0;
(0, node_test_1.default)('ADD updates accumulator and flags correctly', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x8f;
    cpu.registers.B = 0x81;
    runSingleInstruction(cpu, bus, 0x80);
    strict_1.default.equal(cpu.registers.A, 0x10);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.C), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.A), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.Z), false);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.S), false);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.P), false);
});
(0, node_test_1.default)('SUB updates accumulator and flags correctly', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.A = 0x10;
    cpu.registers.C = 0x11;
    runSingleInstruction(cpu, bus, 0x91);
    strict_1.default.equal(cpu.registers.A, 0xff);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.C), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.A), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.Z), false);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.S), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.P), true);
});
(0, node_test_1.default)('INR updates ZSP and AC but preserves carry', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.B = 0xff;
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runSingleInstruction(cpu, bus, 0x04);
    strict_1.default.equal(cpu.registers.B, 0x00);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.C), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.Z), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.S), false);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.P), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.A), true);
});
(0, node_test_1.default)('DCR updates ZSP and AC but preserves carry', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    cpu.registers.D = 0x00;
    cpu.flags |= 1 << Intel8080_1.Flag.C;
    runSingleInstruction(cpu, bus, 0x15);
    strict_1.default.equal(cpu.registers.D, 0xff);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.C), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.Z), false);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.S), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.P), true);
    strict_1.default.equal(isFlagSet(cpu, Intel8080_1.Flag.A), true);
});
