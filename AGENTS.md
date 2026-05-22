# AGENTS Notes

## Repo reality check
- Single-package TypeScript project (no monorepo/workspaces).
- Package manager is `pnpm` (`pnpm-lock.yaml` is present).
- There is no real test setup yet: `npm/pnpm test` intentionally exits with error.

## High-value commands
- Dev run: `pnpm run dev` (runs `nodemon --exec ts-node src/index.ts`).
- One-off run without watcher: `pnpm exec ts-node src/index.ts`.
- Typecheck: `pnpm exec tsc --noEmit`.
- Lint (no script defined): `pnpm exec eslint "src/**/*.{ts,js}"`.

## Architecture map
- Main executable entrypoint is `src/index.ts`.
- `src/ExampleComputer.ts` wires a `ConsoleDevice` onto bus write port `0x01`.
- Core emulator pieces live under `src/core/`:
  - `Intel8080.ts` CPU + opcode dispatch table.
  - `Bus.ts` RAM/device routing.
  - `Memory.ts` 64KB RAM model.
  - `Computer.ts` composition root for CPU + bus + memory.

## Agent gotchas
- Opcode dispatch keys in `Intel8080.ts` are uppercase hex strings like `"0xD3"`; keep new keys in the same normalized format used by `executeNextInstruction()`.
- `Computer.executeProgram()` currently hard-resets PC to `0x2000`; `loadProgram(..., startAddress)` sets PC too, but execute will override it.
- `ts-node` is used by scripts but is not listed in `devDependencies`; if command execution fails in a fresh install, add it before assuming code regressions.
