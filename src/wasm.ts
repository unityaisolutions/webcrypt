import type { EmscriptenModule, EmscriptenModuleFactory } from "./types/emscripten";

interface OpenSSLModule extends EmscriptenModule {
  _wasm_sha256(inputPtr: number, length: number, digestPtr: number): number;
  _wasm_random_bytes(bufferPtr: number, length: number): number;
  _wasm_base64_encode(inputPtr: number, length: number, outputPtr: number, outSize: number): number;
  _wasm_base64_decode(inputPtr: number, outputPtr: number, outSize: number): number;
  _wasm_get_last_error(): number;
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  lengthBytesUTF8(str: string): number;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
}
type OpenSSLModuleFactory = EmscriptenModuleFactory<OpenSSLModule>;

export interface OpenSSLExports {
  sha256(input: string): Uint8Array;
  randomBytes(length: number): Uint8Array;
  base64Encode(input: string): string;
  base64Decode(input: string): string;
  getLastError(): string | null;
}

let factoryPromise: Promise<OpenSSLExports> | undefined;

async function instantiate(): Promise<OpenSSLExports> {
  const { default: createModule } = await import("../public/openssl/openssl.min.js") as {
    default: OpenSSLModuleFactory;
  };

  const module = await createModule();

  function utf8FromString(value: string): { ptr: number; length: number } {
    const length = module.lengthBytesUTF8(value) + 1;
    const ptr = module._malloc(length);
    module.stringToUTF8(value, ptr, length);
    return { ptr, length: length - 1 };
  }

  function fromHeap(ptr: number, length: number): Uint8Array {
    return module.HEAPU8.slice(ptr, ptr + length);
  }

  function getLastError(): string | null {
    const ptr = module._wasm_get_last_error();
    if (!ptr) {
      return null;
    }
    return module.UTF8ToString(ptr);
  }

  return {
    sha256(input: string) {
      const { ptr, length } = utf8FromString(input);
      const digestPtr = module._malloc(32);
      const written = module._wasm_sha256(ptr, length, digestPtr);
      module._free(ptr);
      if (written <= 0) {
        module._free(digestPtr);
        throw new Error(getLastError() ?? "SHA-256 failed");
      }
      const digest = fromHeap(digestPtr, written);
      module._free(digestPtr);
      return digest;
    },
    randomBytes(length: number) {
      const bufferPtr = module._malloc(length);
      const ok = module._wasm_random_bytes(bufferPtr, length);
      if (ok !== 1) {
        module._free(bufferPtr);
        throw new Error(getLastError() ?? "Random bytes failed");
      }
      const bytes = fromHeap(bufferPtr, length);
      module._free(bufferPtr);
      return bytes;
    },
    base64Encode(input: string) {
      const { ptr, length } = utf8FromString(input);
      // Base64 expanded size: 4 * ceil(n/3)
      const outSize = Math.ceil((length + 2) / 3) * 4 + 1;
      const outPtr = module._malloc(outSize);
      const written = module._wasm_base64_encode(ptr, length, outPtr, outSize);
      module._free(ptr);
      if (written <= 0) {
        module._free(outPtr);
        throw new Error(getLastError() ?? "Base64 encode failed");
      }
      const result = module.UTF8ToString(outPtr);
      module._free(outPtr);
      return result;
    },
    base64Decode(input: string) {
      const { ptr } = utf8FromString(input);
      const outSize = Math.floor((input.length * 3) / 4) + 1;
      const outPtr = module._malloc(outSize);
      const written = module._wasm_base64_decode(ptr, outPtr, outSize);
      module._free(ptr);
      if (written <= 0) {
        module._free(outPtr);
        throw new Error(getLastError() ?? "Base64 decode failed");
      }
      const resultBytes = fromHeap(outPtr, written);
      module._free(outPtr);
      return new TextDecoder().decode(resultBytes);
    },
    getLastError,
  } satisfies OpenSSLExports;
}

export function loadOpenSSL(): Promise<OpenSSLExports> {
  if (!factoryPromise) {
    factoryPromise = instantiate();
  }
  return factoryPromise;
}