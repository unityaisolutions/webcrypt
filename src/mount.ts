import { renderDemo } from "./ui";

interface MountOptions {
  elementId: string;
}

export function createApp({ elementId }: MountOptions) {
  const container = document.getElementById(elementId);
  if (!container) {
    throw new Error(`Container with id "${elementId}" not found.`);
  }
  container.innerHTML = "";
  container.append(renderDemo());
}