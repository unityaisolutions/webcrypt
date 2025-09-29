import type { EmscriptenModuleFactory } from "../../src/types/emscripten";

export interface OpenSSLModule {
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  lengthBytesUTF8(str: string): number;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _wasm_sha256(inputPtr: number, length: number, digestPtr: number): number;
  _wasm_random_bytes(bufferPtr: number, length: number): number;
  _wasm_base64_encode(inputPtr: number, length: number, outputPtr: number, outSize: number): number;
  _wasm_base64_decode(inputPtr: number, outputPtr: number, outSize: number): number;
  _wasm_get_last_error(): number;
}

declare const factory: EmscriptenModuleFactory<OpenSSLModule>;
export default factory;