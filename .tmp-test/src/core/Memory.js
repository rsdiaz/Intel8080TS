"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Memory = void 0;
class Memory {
    ram;
    bus;
    bytesUsed;
    constructor() {
        this.ram = new Uint8Array(0x10000);
        this.bus = null;
        this.bytesUsed = 0;
    }
    connectBus(bus) {
        this.bus = bus;
    }
    getBytesUsed() {
        return this.bytesUsed;
    }
    write(value, address) {
        if (typeof this.ram[address] == 'undefined') {
            this.bytesUsed++;
        }
        this.ram[address] = value;
    }
    read(addr) {
        if (typeof this.ram[addr] != 'undefined') {
            return this.ram[addr];
        }
        else {
            return 0x0;
        }
    }
}
exports.Memory = Memory;
