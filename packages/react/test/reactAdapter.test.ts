/**
 * Tests for the React adapter's Vite plugins: React's plugin gets the options the catalogue gives it.
 *
 * @module
 */
import type { ConfigEnv, Plugin, PluginOption, UserConfig } from "vite";
import { describe, expect, it } from "vitest";

import { react } from "../src/vite/react.ts";

/** The plugins in a plugin option, its nested lists flattened. */
const pluginsIn = (option: PluginOption): Plugin[] => {
  if (Array.isArray(option)) return option.flatMap(pluginsIn);
  return typeof option === "object" && option !== null && "name" in option ? [option] : [];
};

/** The serve command's environment, for a plugin's `config` hook. */
const SERVE: ConfigEnv = { command: "serve", mode: "development" };

/** What the adapter's plugins add to Vite's configuration, merged shallowly. */
const configOf = async (adapter: ReturnType<typeof react>): Promise<Record<string, unknown>> => {
  const options = (await adapter.vitePlugins?.()) ?? [];
  const merged: Record<string, unknown> = {};
  for (const plugin of options.flatMap(pluginsIn)) {
    const hook = plugin.config;
    const run = typeof hook === "function" ? hook : hook?.handler;
    const user: UserConfig = {};
    const added: unknown = run === undefined ? undefined : await Reflect.apply(run, undefined, [user, SERVE]);
    if (typeof added === "object" && added !== null) Object.assign(merged, added);
  }
  return merged;
};

describe("react", () => {
  it("hands React's plugin the catalogue's options: Fast Refresh for the `.js` files they include", async () => {
    const refreshed = async (adapter: ReturnType<typeof react>): Promise<string> =>
      JSON.stringify(await configOf(adapter), (_key, value: unknown) =>
        value instanceof RegExp ? String(value) : value
      );
    expect(await refreshed(react({ include: /\.[jt]sx?$/ }))).toContain("[jt]sx?");
    expect(await refreshed(react())).not.toContain("[jt]sx?");
  });
});
