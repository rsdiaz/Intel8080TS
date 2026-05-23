"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Computer = void 0;
const Bus_1 = require("./Bus");
const Intel8080_1 = require("./Intel8080");
const Memory_1 = require("./Memory");
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
        return this.memory.getBytesUsed();
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
