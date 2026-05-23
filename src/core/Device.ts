export interface Device {
  read(port: number): number
  write(port: number, value: number): void
}
