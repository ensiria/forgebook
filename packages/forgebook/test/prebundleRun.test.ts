/**
 * Tests for the first start's pre-bundling: the imports Vite names as unresolved, which a second try leaves out.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { unresolvedOf } from "../bin/forgebook/prebundleRun.ts";

describe("unresolvedOf", () => {
  it("reads the names Vite's error lists, and nothing from another error", () => {
    const error = new Error(
      "The following dependencies are imported but could not be resolved:\n\n" +
        "  vanilla-starter/Popover (imported by /repo/stories/TokenField.stories.tsx)\n" +
        "  vanilla-starter/Button (imported by /repo/stories/PreviewTrigger.stories.tsx)\n\nAre they installed?"
    );
    expect(unresolvedOf(error)).toEqual(["vanilla-starter/Popover", "vanilla-starter/Button"]);
    expect(unresolvedOf(new Error("something else"))).toEqual([]);
    expect(unresolvedOf("not an error")).toEqual([]);
  });
});
