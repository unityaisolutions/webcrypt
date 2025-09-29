declare module "../public/openssl/openssl.min.js" {
  import type { EmscriptenModule, EmscriptenModuleFactory } from "./emscripten";

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