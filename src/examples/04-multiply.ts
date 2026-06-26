import process from 'node:process'

import { ExampleComputer } from '../ExampleComputer'

import { examples } from './data'

const def = examples.find((e) => e.name === 'multiply')!

export default function runMultiply({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)
  computer.loadProgram(def.bytes, 0x0100)
  computer.executeProgram()

  const result = computer.getRegisterValue('A')
  process.stdout.write(
    `\nResultado: 7 × 6 = ${result} (0x${result.toString(16)} = '${String.fromCharCode(result)}')\n`
  )
}
