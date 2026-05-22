import { Device } from "./core/Device"

export class ConsoleDevice implements Device {
  read(): void {
    throw new Error("Method not implemented.");
  }

  write(port: number, value: number): void {
    console.log(`Port ${port} received value ${value}`);
  }
}