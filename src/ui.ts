import { loadOpenSSL } from "./wasm";
import { bytesToHex, formatBytes } from "./utils";

export function renderDemo(): HTMLElement {
  const container = document.createElement("div");
  container.className = "demo";

  const title = document.createElement("h1");
  title.textContent = "OpenSSL WebAssembly Demo";
  container.append(title);

  const description = document.createElement("p");
  description.textContent = "This demo shows SHA-256 hashing, random bytes, and Base64 encoding using OpenSSL compiled for the web.";
  container.append(description);

  const status = document.createElement("pre");
  status.className = "status";
  status.textContent = "Loading OpenSSL...";
  container.append(status);

  const form = document.createElement("form");
  form.className = "card";
  form.innerHTML = `
    <label class="field">
      <span>Input text</span>
      <textarea name="input" rows="4" placeholder="Enter text to hash or encode"></textarea>
    </label>
    <div class="actions">
      <button data-action="hash" type="button">Hash (SHA-256)</button>
      <button data-action="random" type="button">Random 32 bytes</button>
      <button data-action="encode" type="button">Base64 Encode</button>
      <button data-action="decode" type="button">Base64 Decode</button>
    </div>
  `;
  container.append(form);

  const output = document.createElement("pre");
  output.className = "output";
  output.textContent = "Awaiting input...";
  container.append(output);

  loadOpenSSL()
    .then((openssl) => {
      status.textContent = "OpenSSL loaded";

      function handleError(message: string) {
        output.textContent = `Error: ${message}\nOpenSSL: ${openssl.getLastError() ?? "<none>"}`;
        output.classList.add("error");
      }

      async function handleAction(action: string) {
        output.classList.remove("error");
        const inputEl = form.querySelector<HTMLTextAreaElement>("textarea[name=input]");
        if (!inputEl) {
          handleError("Input element missing");
          return;
        }
        const value = inputEl.value;
        if (action !== "random" && value.trim().length === 0) {
          handleError("Please provide input text first");
          return;
        }

        try {
          switch (action) {
            case "hash": {
              const digest = openssl.sha256(value);
              output.textContent = `SHA-256\n${bytesToHex(digest)}`;
              break;
            }
            case "random": {
              const random = openssl.randomBytes(32);
              const formatted = formatBytes(random);
              output.textContent = `Random bytes\n${formatted}`;
              break;
            }
            case "encode": {
              const encoded = openssl.base64Encode(value);
              output.textContent = `Base64 (encoded)\n${encoded}`;
              break;
            }
            case "decode": {
              const decoded = openssl.base64Decode(value);
              output.textContent = `Base64 (decoded)\n${decoded}`;
              break;
            }
            default:
              handleError(`Unknown action: ${action}`);
          }
        } catch (error) {
          handleError(error instanceof Error ? error.message : String(error));
        }
      }

      form.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "BUTTON") {
          const action = target.getAttribute("data-action");
          if (action) {
            void handleAction(action);
          }
        }
      });
    })
    .catch((error) => {
      status.textContent = "Failed to load OpenSSL";
      output.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
      output.classList.add("error");
    });

  return container;
}