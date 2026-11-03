/**
 * Tests for the Preact adapter's Vite plugins: each file's JSX left to its `tsconfig.json`, a runtime the user names
 * kept, refresh kept off the core's files, and refresh's runtime named where a project can pre-bundle it.
 *
 * @module
 */
import { FORGEBOOK_FILES } from "forgebook/vite/adapter";
import { type InlineConfig, resolveConfig } from "vite";
import { describe, expect, it } from "vitest";

import { preact } from "../src/vite/preact.ts";

/**
 * Vite's configuration resolved with the adapter's plugins.
 *
 * @param user - the user's own settings.
 */
const resolved = async (user: InlineConfig = {}): Promise<Awaited<ReturnType<typeof resolveConfig>>> =>
  resolveConfig(
    {
      configFile: false,
      root: import.meta.dirname,
      plugins: [...((await preact().vitePlugins?.()) ?? [])],
      ...user
    },
    "serve"
  );

describe("the Preact adapter's Vite plugins", () => {
  it("leaves each file's runtime to its tsconfig.json, refreshes, and keeps refresh off the core's files", async () => {
    const { oxc, optimizeDeps } = await resolved();
    if (oxc === false) throw new Error("Oxc is off");
    expect(oxc.jsx).toMatchObject({ runtime: "automatic", refresh: true });
    expect(oxc.jsx).not.toHaveProperty("importSource");
    expect(oxc.jsxRefreshExclude).toContain(FORGEBOOK_FILES);
    expect(optimizeDeps.include).toContain("@forgebook/preact > @prefresh/vite > @prefresh/core");
    expect(optimizeDeps.include).not.toContain("@prefresh/core");
  });

  it("keeps a runtime the user names in the Vite configuration, and the files the user leaves out of refresh", async () => {
    const own = /legacy\//;
    const { oxc } = await resolved({ oxc: { jsx: { importSource: "preact" }, jsxRefreshExclude: own } });
    if (oxc === false) throw new Error("Oxc is off");
    expect(oxc.jsx).toMatchObject({ importSource: "preact", runtime: "automatic" });
    expect(oxc.jsxRefreshExclude).toEqual(expect.arrayContaining([FORGEBOOK_FILES, own]));
  });
});
