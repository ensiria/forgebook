/**
 * Tests that the Next.js frame page leaves the server renderer out: bundled as a catalogue's build bundles it, its
 * code imports React's frame renderer and not its whole renderer, so no static catalogue ships the server render.
 *
 * @module
 */
import { join } from "node:path";

import { bundledCode } from "@forgebook/tools/bundled-code";
import { describe, expect, it } from "vitest";

/** The frame page's entry, as the plugin's generated page imports it (`@forgebook/nextjs/frame`). */
const FRAME_ENTRY = join(import.meta.dirname, "..", "src", "mountFrame.ts");

describe("the frame page", () => {
  it("reaches React's frame renderer and not its whole renderer", async () => {
    const code = await bundledCode(FRAME_ENTRY);
    expect(code).toContain("@forgebook/react/frame-renderer");
    expect(code).not.toContain("@forgebook/react/renderer");
    expect(code).not.toContain("react-dom/server");
  });
});
