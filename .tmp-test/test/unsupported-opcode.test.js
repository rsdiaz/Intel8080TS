"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const Intel8080_1 = require("../src/core/Intel8080");
const Bus_1 = require("../src/core/Bus");
(0, node_test_1.default)('throws unsupported opcode with opcode and address context', () => {
    const cpu = new Intel8080_1.Intel8080();
    const bus = new Bus_1.Bus();
    cpu.connectBus(bus);
    bus.connectCPU(cpu);
    bus.writeRam(0xff, 0x2000);
    cpu.registers.programCounter = 0x2000;
    strict_1.default.throws(() => cpu.executeNextInstruction(), /Opcode no soportado: 0xFF en 0x2000/);
});
