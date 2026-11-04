/**
 * Tests for the JSON a build keeps out of its JavaScript: the module holds an address, the file holds the JSON, and the
 * page reads it back.
 *
 * @module
 */
import { gunzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import { packedJson } from "../src/packedText.ts";
import { inlineJson, packedJsonOf } from "../src/vite/packedModule.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("packedJsonOf", () => {
  it("writes the JSON gzipped, named by its content, and answers with what reads it back", () => {
    const written: { fileName: string; source: Uint8Array }[] = [];
    const pack = packedJsonOf((asset) => written.push(asset));
    const value = pack('{"a":1}');
    expect(gunzipSync(written[0]?.source ?? new Uint8Array()).toString()).toBe('{"a":1}');
    expect(written[0]?.fileName).toMatch(/^assets\/[0-9a-f]{12}\.bin$/);
    expect(value).toMatch(/^import\(".*\/packedText\.ts"\)\.then\(\(module\) => module\.packedJson\(/);
    expect(value).toContain(`import.meta.env.BASE_URL + ${JSON.stringify(written[0]?.fileName)}`);
    expect(value).not.toContain("await");
    pack('{"a":1}');
    expect(written[1]?.fileName).toBe(written[0]?.fileName);
  });

  it("leaves the JSON as it is on a dev server", () => {
    expect(inlineJson('{"a":1}')).toBe('{"a":1}');
  });
});

describe("packedJson", () => {
  it("reads a gzipped document back, and says which one could not be loaded", async () => {
    const { gzipSync } = await import("node:zlib");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(gzipSync('{"titles":["A"]}')));
    expect(await packedJson("/assets/12345678.bin")).toEqual({ titles: ["A"] });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("gone", { status: 404 }));
    await expect(packedJson("/assets/gone.bin")).rejects.toThrow(
      "/assets/gone.bin could not be loaded (404)"
    );
  });
});
