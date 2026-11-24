// gifenc (MIT) ships no types; only what the video worker uses.
declare module 'gifenc' {
  type Palette = number[][]
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number; repeat?: number }): void
    finish(): void
    bytes(): Uint8Array
  }
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number): Palette
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette): Uint8Array
}
