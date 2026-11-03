/**
 * Tests that the React Native Web frame page leaves the server renderer out: bundled as a catalogue's build bundles
 * it, its code imports React's frame renderer and not its whole renderer, so no static catalogue ships the server
 * render.
 *
 * @module
 */
import { join } from "node:path";

import { build } from "vite";
import { describe, expect, it } from "vitest";

/** The frame page's entry, as the plugin's generated page imports it (`@forgebook/react-native-web/frame`). */
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
  it("reaches React's frame renderer and not its whole renderer", async () => {
    const code = await bundledCode(FRAME_ENTRY);
    expect(code).toContain("@forgebook/react/frame-renderer");
    expect(code).not.toContain("@forgebook/react/renderer");
    expect(code).not.toContain("react-dom/server");
  });
});
