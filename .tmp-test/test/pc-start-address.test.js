"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const Computer_1 = require("../src/core/Computer");
(0, node_test_1.default)('executeProgram runs from loadProgram startAddress', () => {
    const computer = new Computer_1.Computer();
    computer.loadProgram([0x76], 0x3000);
    computer.executeProgram();
    strict_1.default.equal(computer.getProgramCounter(), 0x3001);
});
