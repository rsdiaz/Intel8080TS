"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const Computer_1 = require("../src/core/Computer");
(0, node_test_1.default)('JZ and JNZ control program flow as expected', () => {
    const computer = new Computer_1.Computer();
    const program = [
        0x06, 0x01, 0x05, 0xca, 0x0c, 0x20, 0x3e, 0x77, 0xc3, 0x11, 0x20, 0x00,
        0x3e, 0x55, 0xc2, 0x11, 0x20, 0x76
    ];
    computer.loadProgram(program, 0x2000);
    computer.executeProgram();
    strict_1.default.equal(computer.getRegisterValue('A'), 0x55);
    strict_1.default.equal(computer.getRegisterValue('B'), 0x00);
    strict_1.default.equal(computer.getProgramCounter(), 0x2012);
});
