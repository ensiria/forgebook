/**
 * Tests that React's frame page leaves the server renderer out: bundled as a catalogue's build bundles it, its code
 * reaches no import of `react-dom/server`, so no static catalogue ships it and no first start pre-bundles it.
 *
 * @module
 */
import { join } from "node:path";

import { bundledCode } from "@forgebook/tools/bundled-code";
import { describe, expect, it } from "vitest";

/** The frame page's entry, as the plugin's generated page imports it (`@forgebook/react/frame`). */
const FRAME_ENTRY = join(import.meta.dirname, "..", "src", "mountFrame.ts");

describe("the frame page", () => {
  it("reaches React's client renderer and not its server renderer", async () => {
    const code = await bundledCode(FRAME_ENTRY);
    expect(code).toContain("react-dom/client");
    expect(code).not.toContain("react-dom/server");
  });
});
