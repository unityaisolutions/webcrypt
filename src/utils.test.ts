import { describe, expect, it } from "vitest";
import { bytesToHex, formatBytes } from "./utils";

describe("bytesToHex", () => {
  it("converts bytes to lowercase hex", () => {
    const input = new Uint8Array([0, 15, 16, 255]);
    expect(bytesToHex(input)).toBe("000f10ff");
  });
});

describe("formatBytes", () => {
  it("groups hex output", () => {
    const input = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(formatBytes(input, 2)).toBe("0001 0203 0405 0607");
  });
});