# WebCrypt

WebCrypt compiles **OpenSSL** to **WebAssembly**, exposing a minimal JavaScript API and a demo UI that showcases cryptographic primitives directly in the browser.

## Features

- Automated build pipeline that:
  - Installs and activates Emscripten SDK locally in `toolchains/`
  - Downloads and builds OpenSSL (configurable via `OPENSSL_VERSION`)
  - Produces optimized `.min.js` + `.wasm` artifacts and copies them into `public/openssl/`
- TypeScript + Vite demo application with interactive UI for:
  - SHA-256 hashing
  - Random byte generation
  - Base64 encoding / decoding
- Utility wrappers that expose a safe JavaScript interface over OpenSSL’s C APIs

## Prerequisites

- Node.js **>= 20.12** (latest LTS recommended)
- Python 3 (required by OpenSSL build scripts)
- Build-essential toolchain (make, perl)

## Getting Started

Install dependencies:

```bash
npm ci
```

Build the OpenSSL WebAssembly artifacts:

```bash
npm run build:openssl
```

Build the demo site:

```bash
npm run build:demo
```

Start the development server:

```bash
npm run dev
```

The demo will be available at `http://localhost:4173`.

## Project Structure

```
├── native/                 # C shim exposing curated OpenSSL surfaces
├── scripts/build-openssl.mjs
├── src/                    # TypeScript demo UI
├── public/                 # Static assets and generated wasm/js
└── dist/                   # Build output (ignored by git)
```

## Scripts

- `npm run build:openssl` – compile OpenSSL to WebAssembly and minified JS
- `npm run build:demo` – produce a static production build of the demo via Vite
- `npm run dev` – Vite dev server with HMR
- `npm run lint` – Biome lint/format checks
- `npm run typecheck` – TypeScript type checking
- `npm run test:unit` – Vitest unit suite
- `npm test` – composite command running lint → typecheck → unit tests

## Configuration

- Set `OPENSSL_VERSION` environment variable to build a specific OpenSSL release.
- Artifacts are written to both `dist/openssl` and `public/openssl` so that Vite can serve them during development.

## License

This repository contains the OpenSSL source code during the build step. OpenSSL is licensed under the [Apache License 2.0](https://www.openssl.org/source/license.html).
