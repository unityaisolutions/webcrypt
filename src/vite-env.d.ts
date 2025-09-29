/// <reference types="vite/client" />

interface EmscriptenModule {
  onRuntimeInitialized?: () => void;
  ccall?: (...args: unknown[]) => unknown;
  cwrap?: (...args: unknown[]) => unknown;
  _malloc(size: number): number;
  _free(ptr: number): void;
}