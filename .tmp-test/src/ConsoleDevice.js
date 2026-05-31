"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleDevice = void 0;
const node_process_1 = __importDefault(require("node:process"));
class ConsoleDevice {
    debug;
    constructor(debug = false) {
        this.debug = debug;
    }
    read(port) {
        throw new Error(`Read device not implemented for port ${port}`);
    }
    write(port, value) {
        node_process_1.default.stdout.write(String.fromCharCode(value & 0xff));
        if (this.debug) {
            node_process_1.default.stderr.write(`\n[ConsoleDevice] port=${port} value=0x${value.toString(16)}\n`);
        }
    }
}
exports.ConsoleDevice = ConsoleDevice;
