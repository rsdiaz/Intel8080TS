"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ExampleComputer_1 = require("./ExampleComputer");
const computer = new ExampleComputer_1.ExampleComputer(true);
// Programa de prueba en código de máquina
const program = [
    0x3e,
    0x41, // MVI A, 'A' ; Cargar 'A' en A
    0xd3,
    0x01, // OUT 1      ; Imprimir A
    0x3e,
    0x42, // MVI A, 'B' ; Cargar 'B' en A
    0xd3,
    0x01, // OUT 1      ; Imprimir B
    0x76 // HLT        ; Detener ejecución
];
computer.loadProgram(program);
computer.executeProgram();
