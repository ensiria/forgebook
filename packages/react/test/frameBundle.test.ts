/**
 * Tests that React's frame page leaves the server renderer out: bundled as a catalogue's build bundles it, its code
 * reaches no import of `react-dom/server`, so no static catalogue ships it and no first start pre-bundles it.
 *
 * @module
 */
import { join } from "node:path";

import { build } from "vite";
import { describe, expect, it } from "vitest";

/** The frame page's entry, as the plugin's generated page imports it (`@forgebook/react/frame`). */
const FRAME_ENTRY = join(import.meta.dirname, "..", "src", "mountFrame.ts");

/**
 * The code a build makes of an entry, every chunk's, with its dependencies left as imports.
 *
 * @param entry - the entry's path.
 */
const bundledCode = async (entry: string): Promise<string> => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["es"] },
      rollupOptions: { external: (id: string) => !id.startsWith(".") && !id.startsWith("/") }
    }
  });
  // a list for several formats, a watcher in watch mode: neither here, but the type allows them
  const results = Array.isArray(output) ? output : [output];
  return results
    .flatMap((result) => ("output" in result ? result.output : []))
    .map((chunk) => (chunk.type === "chunk" ? chunk.code : ""))
    .join("\n");
};

describe("the frame page", () => {
  it("reaches React's client renderer and not its server renderer", async () => {
    const code = await bundledCode(FRAME_ENTRY);
    expect(code).toContain("react-dom/client");
    expect(code).not.toContain("react-dom/server");
  });
});
