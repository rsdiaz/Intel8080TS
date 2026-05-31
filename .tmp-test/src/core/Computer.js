"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Computer = void 0;
const Bus_1 = require("./Bus");
const Intel8080_1 = require("./Intel8080");
const Memory_1 = require("./Memory");
const node_fs_1 = __importDefault(require("node:fs"));
class Computer {
    cpu;
    memory;
    bus;
    constructor(debug = false) {
        this.cpu = new Intel8080_1.Intel8080(debug);
        this.memory = new Memory_1.Memory();
        this.bus = new Bus_1.Bus();
        this.cpu.connectBus(this.bus);
        this.bus.connectCPU(this.cpu);
        this.memory.connectBus(this.bus);
        this.bus.connectMemory(this.memory);
    }
    loadProgram(program, startAddress = 0x2000) {
        for (let i = 0; i < program.length; i++) {
            this.bus.writeRam(program[i], startAddress + i);
        }
        this.cpu.registers.programCounter = startAddress;
    }
    loadProgramFromFile(path, startAddress = 0x0100) {
        const buffer = node_fs_1.default.readFileSync(path);
        this.loadProgram(buffer, startAddress);
    }
    setStackPointer(address) {
        this.cpu.registers.stackPointer = address & 0xffff;
    }
    setProgramCounter(address) {
        this.cpu.registers.programCounter = address & 0xffff;
    }
    getProgramCounter() {
        return this.cpu.registers.programCounter;
    }
    getRegisterValue(register) {
        return this.cpu.registers[register];
    }
    executeProgram() {
        while (!this.cpu.halted) {
            this.cpu.executeNextInstruction();
        }
    }
}
exports.Computer = Computer;
