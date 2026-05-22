export interface Device {
  read(port: number): void
  write(port: number, value: number): void
}