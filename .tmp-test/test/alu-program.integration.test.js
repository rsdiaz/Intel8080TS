"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Computer_1 = require("../src/core/Computer");
(0, node_test_1.default)('ALU mini program reaches expected accumulator and program counter', () => {
    const computer = new Computer_1.Computer();
    const program = [0x3e, 0x0a, 0x06, 0x03, 0x80, 0x05, 0x90, 0x76];
    computer.loadProgram(program, 0x2200);
    computer.executeProgram();
    strict_1.default.equal(computer.getRegisterValue('A'), 0x0b);
    strict_1.default.equal(computer.getRegisterValue('B'), 0x02);
    strict_1.default.equal(computer.getProgramCounter(), 0x2208);
});
