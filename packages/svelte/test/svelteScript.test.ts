/**
 * The scripts of a Svelte component, as the plugin reads its opening comment and the docs read its language.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { isTypeScript, scriptOf } from "../src/vite/svelteScript.ts";

describe("a component's scripts", () => {
  it("gives the first script, the module's when it comes first", () => {
    const text =
      '<script module>\n/** First. @module */\nexport const a = 1;\n</script>\n<script lang="ts">\nlet b = 2;\n</script>\n<p />';
    expect(scriptOf(text)).toBe("\n/** First. @module */\nexport const a = 1;\n");
  });

  it("gives nothing for a component with no script, or one that does not parse", () => {
    expect(scriptOf("<p>Only markup</p>")).toBe("");
    expect(scriptOf("<script>\n{#if</script>")).toBe("");
  });

  it("says whether a component's scripts are TypeScript", () => {
    expect(isTypeScript('<script lang="ts">let a = 1;</script>')).toBe(true);
    expect(isTypeScript("<script>let a = 1;</script>")).toBe(false);
  });
});
