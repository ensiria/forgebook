/**
 * The server a build's first load is measured on.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { serveStatic } from "./staticServer.ts";

const PORT = 62_190;

describe("serveStatic", () => {
  it("serves a file with its type, knows its gzipped size, and refuses to guess one", async () => {
    const root = mkdtempSync(join(tmpdir(), "bench-static-"));
    writeFileSync(join(root, "index.html"), "<p>home</p>");
    writeFileSync(join(root, "a.js"), "x".repeat(10_000));
    const server = await serveStatic(root, "127.0.0.1", PORT);
    try {
      expect(await (await fetch(server.base)).text()).toBe("<p>home</p>");
      const script = await fetch(`${server.base}a.js`);
      expect(script.headers.get("content-type")).toBe("text/javascript");
      expect(server.gzippedSize("/a.js")).toBeLessThan(200);
      expect((await fetch(`${server.base}missing.js`)).status).toBe(404);
      expect(() => server.gzippedSize("/missing.js")).toThrow();
    } finally {
      await server.close();
    }
  });
});
