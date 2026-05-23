"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Bus_1 = require("../src/core/Bus");
const Intel8080_1 = require("../src/core/Intel8080");
const loadAndRunProgram = (cpu, bus, program) => {
    const startAddress = 0x2000;
    cpu.registers.programCounter = startAddress;
    for (const [index, opcode] of program.entries()) {
        bus.writeRam(opcode, startAddress + index);
    }
    while (!cpu.halted) {
        cpu.executeNextInstruction();
    }
};
(0, node_test_1.default)('MOV register-to-register copies source value', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    loadAndRunProgram(cpu, bus, [0x06, 0x12, 0x78, 0x76]);
    strict_1.default.equal(cpu.registers.B, 0x12);
    strict_1.default.equal(cpu.registers.A, 0x12);
});
(0, node_test_1.default)('MVI and MOV with memory through M register work', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    loadAndRunProgram(cpu, bus, [0x21, 0x00, 0x40, 0x36, 0x9a, 0x7e, 0x76]);
    strict_1.default.equal(bus.readRam(0x4000), 0x9a);
    strict_1.default.equal(cpu.registers.A, 0x9a);
});
(0, node_test_1.default)('LXI loads BC, DE, HL and SP register pairs', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    loadAndRunProgram(cpu, bus, [
        0x01, 0x34, 0x12, 0x11, 0xcd, 0xab, 0x21, 0x0e, 0x0f, 0x31, 0x67, 0x45,
        0x76
    ]);
    strict_1.default.equal(cpu.registers.B, 0x12);
    strict_1.default.equal(cpu.registers.C, 0x34);
    strict_1.default.equal(cpu.registers.D, 0xab);
    strict_1.default.equal(cpu.registers.E, 0xcd);
    strict_1.default.equal(cpu.registers.H, 0x0f);
    strict_1.default.equal(cpu.registers.L, 0x0e);
    strict_1.default.equal(cpu.registers.stackPointer, 0x4567);
});
