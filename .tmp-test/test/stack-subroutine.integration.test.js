"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Computer_1 = require("../src/core/Computer");
(0, node_test_1.default)('CALL/RET with PUSH/POP preserves registers and returns correctly', () => {
    const computer = new Computer_1.Computer();
    const program = [
        0x31, 0x00, 0x40, 0x06, 0x12, 0xcd, 0x10, 0x20, 0x76, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xc5, 0x06, 0x34, 0xc1, 0xc9
    ];
    computer.loadProgram(program, 0x2000);
    computer.executeProgram();
    strict_1.default.equal(computer.getRegisterValue('B'), 0x12);
    strict_1.default.equal(computer.getProgramCounter(), 0x2009);
});
