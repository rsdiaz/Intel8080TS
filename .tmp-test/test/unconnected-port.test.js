"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const Bus_1 = require("../src/core/Bus");
(0, node_test_1.default)('writeDevice throws clear error for unconnected port', () => {
    const bus = new Bus_1.Bus();
    strict_1.default.throws(() => bus.writeDevice(1, 0x41), /No write device connected on port 1/);
});
(0, node_test_1.default)('readDevice throws clear error for unconnected port', () => {
    const bus = new Bus_1.Bus();
    strict_1.default.throws(() => bus.readDevice(2), /No read device connected on port 2/);
});
