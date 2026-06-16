import process from 'node:process'

import runHello from './01-hello'
import runFactorial from './02-factorial'
import runFibonacci from './03-fibonacci'
import runMultiply from './04-multiply'
import runStringPrint from './05-string-print'

type Example = {
  description: string
  run: (opts: { trace: boolean }) => void
}

const examples: Record<string, Example> = {
  hello: {
    description: 'Print "AB" using OUT',
    run: runHello
  },
  factorial: {
    description: 'Compute 5! = 120 with CALL/RET and DCR/JNZ',
    run: runFactorial
  },
  fibonacci: {
    description: 'Store 10 Fibonacci numbers in memory with MOV M,r',
    run: runFibonacci
  },
  multiply: {
    description: 'Multiply 7 × 6 using a subroutine',
    run: runMultiply
  },
  'string-print': {
    description: 'Print a $-terminated string with a CMP loop',
    run: runStringPrint
  }
}

const printUsage = () => {
  process.stdout.write('\nUsage: pnpm run example <name> [--trace]\n\n')
  process.stdout.write('Available examples:\n')
  for (const [key, { description }] of Object.entries(examples)) {
    process.stdout.write(`  ${key.padEnd(15)} ${description}\n`)
  }
  process.stdout.write(
    '\nAdd --trace to print every executed instruction on stderr.\n'
  )
}

const args = process.argv.slice(2)
const trace = args.includes('--trace')
const name = args.find((arg) => !arg.startsWith('--'))

if (!name) {
  printUsage()
  process.exit(0)
}

if (!(name in examples)) {
  process.stderr.write(`\nUnknown example: "${name}"\n`)
  printUsage()
  process.exit(1)
}

examples[name].run({ trace })
