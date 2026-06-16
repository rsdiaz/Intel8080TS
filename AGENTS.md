# AGENTS Notes

## Repo reality check
- Single-package TypeScript project (no monorepo/workspaces).
- Package manager is `pnpm` (`pnpm-lock.yaml` is present).
- Tests live under `test/` and use `node:test`. Run with `pnpm test`.

## High-value commands
- Dev run: `pnpm run dev` (runs `nodemon --exec ts-node src/index.ts`).
- One-off run without watcher: `pnpm exec ts-node src/index.ts`.
- Typecheck: `pnpm run typecheck` (or `pnpm exec tsc --noEmit`).
- Lint: `pnpm run lint`.
- Tests: `pnpm test`.
- Run CPU diagnostic ROM: `pnpm run cpudiag [path/to/rom.COM]` (defaults to `roms/CPUDIAG.COM`).

## Architecture map
- Main executable entrypoint is `src/index.ts`.
- `src/ExampleComputer.ts` wires a `ConsoleDevice` onto bus write port `0x01`.
- `src/CpuDiagComputer.ts` wires a `BdosDevice` on port `0xFF` and patches a CP/M BDOS trampoline at `0x0005` to run `.COM` diagnostic ROMs.
- Core emulator pieces live under `src/core/`:
  - `Intel8080.ts` CPU + opcode dispatch (decodificación por patrones de bits).
  - `Bus.ts` RAM/device routing.
  - `Memory.ts` 64KB RAM model.
  - `Computer.ts` composition root for CPU + bus + memory. Provides `loadProgram`, `loadProgramFromFile`, `setStackPointer`, `setProgramCounter`, `executeProgram`.

## Opcode coverage
Set oficial completo del Intel 8080 implementado (~244 opcodes), incluyendo DAA, CMA, XTHL, PCHL, DI, EI y RST 0-7. Los 12 opcodes indocumentados (`0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38, 0xCB, 0xD9, 0xDD, 0xED, 0xFD`) lanzan `Opcode no soportado`.

## Agent gotchas
- Toda la decodificación se hace en métodos `execute*Instruction` con máscaras de bits. Para añadir un opcode nuevo, encuentra el método más afín y agrega una rama; evita reintroducir tablas grandes.
- `Bus` auto-inicializa un `Memory` en su constructor para que los tests puedan usarlo sin `connectMemory`. El `cpu` sí requiere `connectCPU` (usa `definite assignment`).
- `Computer.executeProgram()` corre `while (!cpu.halted)`. No resetea PC.
- `ts-node` no está listado en `devDependencies` pero los scripts lo usan; si falla un comando en una instalación nueva, añádelo antes de asumir regresiones.
