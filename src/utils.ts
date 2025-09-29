export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function formatBytes(bytes: Uint8Array, groupSize = 4): string {
  const hex = bytesToHex(bytes);
  const groups: string[] = [];
  for (let i = 0; i < hex.length; i += groupSize * 2) {
    groups.push(hex.slice(i, i + groupSize * 2));
  }
  return groups.join(" ");
}