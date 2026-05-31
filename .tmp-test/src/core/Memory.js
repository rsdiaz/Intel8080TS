"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Memory = void 0;
class Memory {
    ram;
    bus;
    constructor() {
        this.ram = new Uint8Array(0x10000);
        this.bus = null;
    }
    connectBus(bus) {
        this.bus = bus;
    }
    write(value, address) {
        this.ram[address & 0xffff] = value & 0xff;
    }
    read(address) {
        return this.ram[address & 0xffff];
    }
}
exports.Memory = Memory;
