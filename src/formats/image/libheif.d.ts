// libheif-js's bundled module (its WebAssembly inside) ships without types for this entry; only what imageTools.worker.ts uses.
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  type HeifImage = {
    get_width: () => number
    get_height: () => number
    display: (target: { data: Uint8ClampedArray; width: number; height: number }, onDone: (shown: ImageData | null) => void) => void
    free: () => void
  }
  type Libheif = { HeifDecoder: new () => { decode: (bytes: Uint8Array) => HeifImage[] } }
  const createLibheif: () => Libheif | Promise<Libheif>
  export default createLibheif
}
