export interface EmscriptenModule {
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  ccall: (...args: unknown[]) => unknown;
  cwrap: (...args: unknown[]) => unknown;
  lengthBytesUTF8(str: string): number;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  _malloc(size: number): number;
  _free(ptr: number): void;
}

export type EmscriptenModuleFactory<T extends EmscriptenModule = EmscriptenModule> = (
  moduleOverrides?: Partial<T>,
) => Promise<T>;

declare module "../public/openssl/openssl.min.js" {
  interface OpenSSLModule extends EmscriptenModule {
    _wasm_sha256(inputPtr: number, length: number, digestPtr: number): number;
    _wasm_random_bytes(bufferPtr: number, length: number): number;
    _wasm_base64_encode(inputPtr: number, length: number, outputPtr: number, outSize: number): number;
    _wasm_base64_decode(inputPtr: number, outputPtr: number, outSize: number): number;
    _wasm_get_last_error(): number;
  }

  const createModule: EmscriptenModuleFactory<OpenSSLModule>;
  export default createModule;
}