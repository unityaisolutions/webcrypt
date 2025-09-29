import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../");
const buildRoot = path.join(projectRoot, "build");
const distRoot = path.join(projectRoot, "dist/openssl");
const publicRoot = path.join(projectRoot, "public/openssl");
const toolchainRoot = path.join(projectRoot, "toolchains/emsdk");

const OPENSSL_VERSION = process.env.OPENSSL_VERSION ?? "3.3.2";
const OPENSSL_URL = `https://www.openssl.org/source/openssl-${OPENSSL_VERSION}.tar.gz`;

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function run(command, options = {}) {
  const cwd = options.cwd ?? projectRoot;
  const env = { ...process.env, ...options.env };
  return new Promise((resolve, reject) => {
    console.log(`$ ${command}`);
    const child = spawn("bash", ["-lc", command], {
      cwd,
      env,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}: ${command}`));
        return;
      }
      resolve();
    });
  });
}

let cachedEmsdkEnv;

async function ensureToolchain() {
  if (!fs.existsSync(toolchainRoot)) {
    await ensureDir(path.dirname(toolchainRoot));
    await run(`git clone --depth 1 https://github.com/emscripten-core/emsdk.git "${toolchainRoot}"`);
  }

  const emsdkCmd = path.join(toolchainRoot, "emsdk");
  await run(`"${emsdkCmd}" install latest`, { cwd: toolchainRoot });
  await run(`"${emsdkCmd}" activate latest`, { cwd: toolchainRoot });
}

async function loadEmsdkEnvironment() {
  if (cachedEmsdkEnv) {
    return cachedEmsdkEnv;
  }

  const envScript = path.join(toolchainRoot, "emsdk_env.sh");

  const envOutput = await new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", `source "${envScript}" >/dev/null 2>&1 && env -0`], {
      stdio: ["ignore", "pipe", "inherit"],
    });

    const chunks = [];
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to load emsdk environment (exit ${code})`));
        return;
      }
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });

  const env = {};
  for (const entry of envOutput.split("\0")) {
    if (!entry) continue;
    const idx = entry.indexOf("=");
    if (idx === -1) continue;
    const key = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    env[key] = value;
  }

  const emscriptenBin = path.join(toolchainRoot, "upstream/emscripten");
  const pathEntries = new Set(
    [toolchainRoot, emscriptenBin, env.PATH ?? "", process.env.PATH ?? ""].filter(Boolean).flatMap((segment) => segment.split(":")),
  );

  env.PATH = Array.from(pathEntries).filter(Boolean).join(":");
  const emccPath = path.join(emscriptenBin, "emcc");
  const emxxPath = path.join(emscriptenBin, "em++");
  const emarPath = path.join(emscriptenBin, "emar");
  const emranlibPath = path.join(emscriptenBin, "emranlib");
  const emnmPath = path.join(emscriptenBin, "emnm");
  const emconfigurePath = path.join(emscriptenBin, "emconfigure");
  const emmakePath = path.join(emscriptenBin, "emmake");

  env.CC = emccPath;
  env.CXX = emxxPath;
  env.AR = emarPath;
  env.RANLIB = emranlibPath;
  env.NM = emnmPath;
  env.LD = emccPath;
  env.EMCONFIGURE = emconfigurePath;
  env.EMMAKE = emmakePath;
  env.PERL = env.PERL ?? "perl";
  env.CROSS_COMPILE = "";

  cachedEmsdkEnv = env;
  return env;
}

async function downloadOpenSSL() {
  const tarballPath = path.join(buildRoot, `openssl-${OPENSSL_VERSION}.tar.gz`);
  const sourceDir = path.join(buildRoot, `openssl-${OPENSSL_VERSION}`);

  await ensureDir(buildRoot);

  if (!fs.existsSync(tarballPath)) {
    await run(`curl -L "${OPENSSL_URL}" -o "${tarballPath}"`);
  }

  if (fs.existsSync(sourceDir)) {
    await fs.promises.rm(sourceDir, { recursive: true, force: true });
  }

  await run(`tar -xzf "${tarballPath}" -C "${buildRoot}"`);

  return sourceDir;
}

async function configureAndBuild(opensslDir, env) {
  await run(
    `"${env.EMCONFIGURE}" ./Configure linux-generic32 no-asm no-threads no-shared no-dso no-engine no-ui-console no-tests --prefix=/ --cross-compile-prefix=""`,
    {
      cwd: opensslDir,
      env,
    },
  );

  const jobs = Math.max(os.cpus().length - 1, 1);

  await run(`"${env.EMMAKE}" make -j${jobs} build_generated`, {
    cwd: opensslDir,
    env,
  });

  await run(`"${env.EMMAKE}" make -j${jobs} build_libs`, {
    cwd: opensslDir,
    env,
  });
}

async function buildShim(opensslDir, env) {
  const shimSource = path.join(projectRoot, "native/openssl_shim.c");
  const shimObject = path.join(buildRoot, "openssl_shim.o");

  await ensureDir(buildRoot);

  await run(
    `"${env.CC}" -c "${shimSource}" -o "${shimObject}" -I"${opensslDir}/include" -I"${opensslDir}" -O3`,
    {
      env,
    },
  );

  return shimObject;
}

async function linkModule(opensslDir, shimObject, env) {
  await ensureDir(distRoot);
  await ensureDir(publicRoot);

  const outputBase = path.join(distRoot, "openssl");
  const publicBase = path.join(publicRoot, "openssl");

  const exportedFunctions = [
    "_wasm_sha256",
    "_wasm_random_bytes",
    "_wasm_base64_encode",
    "_wasm_base64_decode",
    "_wasm_get_last_error",
    "_malloc",
    "_free",
  ];

  const exportedRuntime = [
    "ccall",
    "cwrap",
    "UTF8ToString",
    "stringToUTF8",
    "lengthBytesUTF8",
    "setValue",
    "getValue",
  ];

  const linkFlags = [
    "--no-entry",
    "-sWASM=1",
    "-sMODULARIZE=1",
    "-sEXPORT_NAME=createOpenSSLModule",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sENVIRONMENT=web,node",
    "-sEXIT_RUNTIME=0",
    "-sINITIAL_MEMORY=134217728",
    "-sSTACK_SIZE=5242880",
    "-sFILESYSTEM=0",
    "-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=[]",
    "-sASSERTIONS=0",
    `-sEXPORTED_FUNCTIONS=${JSON.stringify(exportedFunctions)}`,
    `-sEXPORTED_RUNTIME_METHODS=${JSON.stringify(exportedRuntime)}`,
  ];

  const command = `"${env.CC}" "${shimObject}" "${path.join(opensslDir, "libssl.a")}" "${path.join(opensslDir, "libcrypto.a")}" -O3 ${linkFlags.join(" ")} -o "${outputBase}.min.js"`;

  await run(command, { env });

  await fs.promises.copyFile(`${outputBase}.min.js`, `${publicBase}.min.js`);
  await fs.promises.copyFile(`${outputBase}.min.wasm`, `${publicBase}.wasm`);

  console.log(`Artifacts written to ${distRoot} and ${publicRoot}`);
}

async function main() {
  await ensureDir(path.join(projectRoot, "native"));
  await ensureDir(distRoot);
  await ensureDir(publicRoot);

  await ensureToolchain();
  const emsdkEnv = await loadEmsdkEnvironment();
  const baseEnv = { ...process.env, ...emsdkEnv };

  const opensslDir = await downloadOpenSSL();

  await configureAndBuild(opensslDir, baseEnv);
  const shimObject = await buildShim(opensslDir, baseEnv);
  await linkModule(opensslDir, shimObject, baseEnv);

  console.log("OpenSSL WebAssembly build complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});