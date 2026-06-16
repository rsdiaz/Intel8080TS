# ROMs de diagnóstico

Este directorio aloja binarios usados para validar el emulador. Están **excluidos del repositorio** por motivos de procedencia/licencia: tienes que descargarlos manualmente.

## CPUDIAG.COM (recomendado)

Programa de diagnóstico clásico de Microcosm Associates (1980). Verifica el set de instrucciones del 8080 e imprime `CPU IS OPERATIONAL` si todo está bien.

Coloca el archivo en `roms/CPUDIAG.COM` y ejecuta:

```bash
pnpm run cpudiag
```

Fuentes comunes:
- https://altairclone.com/downloads/cpu_tests/
- Buscar `cpudiag.bin` o `CPUDIAG.COM` (~2 KB, suma MD5 documentada en varios foros retro).

## Otros diagnósticos compatibles

El mismo `CpuDiagComputer` (que stub-ea BDOS funciones 2 y 9) sirve para:

- `TST8080.COM` — Kelly Smith, más simple.
- `8080EXM.COM` — Ian Bartholomew, exhaustivo (tarda minutos).
- `8080PRE.COM` — pre-test rápido.

Para correr otro binario:

```bash
pnpm run cpudiag roms/TST8080.COM
```
