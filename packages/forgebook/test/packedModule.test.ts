/**
 * Tests for the JSON a build keeps out of its JavaScript: the module holds an address, and the file holds the JSON.
 *
 * @module
 */
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { inlineJson, packedJsonOf } from "../src/vite/packedModule.ts";

describe("packedJsonOf", () => {
  it("writes the JSON gzipped, and answers with what reads it back", () => {
    const written: { fileName: string; source: Uint8Array }[] = [];
    const value = packedJsonOf((asset) => written.push(asset))('{"a":1}');
    expect(gunzipSync(written[0]?.source ?? new Uint8Array()).toString()).toBe('{"a":1}');
    expect(value).toContain("packedJson(import.meta.env.BASE_URL");
    expect(value).toContain(written[0]?.fileName ?? "none");
  });

  it("leaves the JSON as it is on a dev server", () => {
    expect(inlineJson('{"a":1}')).toBe('{"a":1}');
  });
});
