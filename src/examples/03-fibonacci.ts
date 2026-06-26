import process from 'node:process'

import { ExampleComputer } from '../ExampleComputer'

import { examples } from './data'

const def = examples.find((e) => e.name === 'fibonacci')!

export default function runFibonacci({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)
  computer.loadProgram(def.bytes, 0x0100)
  computer.executeProgram()

  const values: number[] = []
  for (let i = 0; i < 10; i++) {
    values.push(computer.bus.readRam(0x3000 + i))
  }

  process.stdout.write(
    `\nFibonacci (10 primeros) en 0x3000: ${values.join(', ')}\n`
  )
}
