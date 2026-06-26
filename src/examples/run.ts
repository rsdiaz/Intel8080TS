import process from 'node:process'

import { examples } from './data'
import runHello from './01-hello'
import runFactorial from './02-factorial'
import runFibonacci from './03-fibonacci'
import runMultiply from './04-multiply'
import runStringPrint from './05-string-print'

const runners: Record<string, (opts: { trace: boolean }) => void> = {
  hello: runHello,
  factorial: runFactorial,
  fibonacci: runFibonacci,
  multiply: runMultiply,
  'string-print': runStringPrint
}

const printUsage = () => {
  process.stdout.write('\nUsage: pnpm run example <name> [--trace]\n\n')
  process.stdout.write('Available examples:\n')
  for (const ex of examples) {
    process.stdout.write(`  ${ex.name.padEnd(15)} ${ex.description}\n`)
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

if (!(name in runners)) {
  process.stderr.write(`\nUnknown example: "${name}"\n`)
  printUsage()
  process.exit(1)
}

runners[name]({ trace })
