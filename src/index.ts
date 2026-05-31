import process from 'node:process'

process.stdout.write(`
Intel8080TS — emulador didáctico del Intel 8080

Scripts disponibles:
  pnpm run example             Lista los ejemplos disponibles
  pnpm run example <nombre>    Ejecuta un ejemplo concreto (hello, factorial, ...)
  pnpm run cpudiag [rom.COM]   Ejecuta un ROM de diagnóstico (CPUDIAG, TST8080, ...)
  pnpm run repl [rom.COM]      Abre el debugger interactivo

Añade --trace a cualquiera de los anteriores para ver el trace de
instrucciones por stderr.

Documentación completa: README.md
`)
