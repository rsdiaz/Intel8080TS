import { ExampleComputer } from '../ExampleComputer'

import { examples } from './data'

const def = examples.find((e) => e.name === 'string-print')!

export default function runStringPrint({ trace }: { trace: boolean }) {
  const computer = new ExampleComputer(trace)
  computer.loadProgram(def.bytes, 0x0100)
  computer.executeProgram()
}
