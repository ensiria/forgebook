/**
 * Tests for the cache folder of a server a command starts: Vite resolves it inside the dev server's, never to it, so
 * the two optimizers never rewrite each other's pre-bundled dependencies.
 *
 * @module
 */
import { existsSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createServer,
  type InlineConfig,
  normalizePath,
  type Plugin,
  resolveConfig as resolveVite
} from "vite";
import { describe, expect, it } from "vitest";

import { catalogueVite } from "../bin/forgebook/catalogueVite.ts";
import { COMMAND_CACHE_FOLDER, commandServerVite } from "../bin/forgebook/commandServer.ts";
import type { FrameworkAdapter } from "../src/vite/adapter.ts";
import { type ResolvedConfig, resolveConfig } from "../src/vite/configFile.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A catalogue in a package folder of its own, as an app's is. */
const catalogue = (framework: FrameworkAdapter): ResolvedConfig => {
  // as made, not its real path: a temporary folder is behind a link on some systems, and Vite resolves the link
  const dir = mkdtempSync(join(tmpdir(), "forgebook-command-cache-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app", private: true }));
  return resolveConfig({ framework, title: "Catalogue", sources: [] }, dir);
};

/** A command's server as `forgebook stories` starts it: no port, nothing watched. */
const OWN_SERVER: InlineConfig = {
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  logLevel: "silent"
};

/** The cache folders Vite resolves for `forgebook dev` and for a command's own server, on one catalogue. */
const cacheDirs = async (config: ResolvedConfig): Promise<{ dev: string; command: string }> => {
  const dev = await resolveVite(await catalogueVite(config, {}), "serve");
  const command = await resolveVite(await commandServerVite(config, { logLevel: "silent" }), "serve");
  return { dev: dev.cacheDir, command: command.cacheDir };
};

describe("commandServerVite", () => {
  it("keeps the cache in a folder of its own inside Vite's default one", async () => {
    const config = catalogue(STUB_FRAMEWORK);
    const { dev, command } = await cacheDirs(config);
    expect(dev).toBe(normalizePath(join(realpathSync(config.dir), "node_modules", ".vite")));
    expect(command).toBe(normalizePath(join(dev, COMMAND_CACHE_FOLDER)));
  });

  it("follows a cache folder a framework's plugin sets", async () => {
    const setsCache: Plugin = { name: "sets-cache", config: () => ({ cacheDir: ".cache/vite" }) };
    const config = catalogue({ ...STUB_FRAMEWORK, vitePlugins: async () => [setsCache] });
    const { dev, command } = await cacheDirs(config);
    expect(dev).toBe(normalizePath(join(realpathSync(config.dir), ".cache", "vite")));
    expect(command).toBe(normalizePath(join(dev, COMMAND_CACHE_FOLDER)));
  });

  it("gives a second server running at once a cache folder of its own, and the shared one back once closed", async () => {
    const config = catalogue(STUB_FRAMEWORK);
    const dev = await resolveVite(await catalogueVite(config, {}), "serve");
    const shared = normalizePath(join(dev.cacheDir, COMMAND_CACHE_FOLDER));
    const first = await createServer(await commandServerVite(config, OWN_SERVER));
    const second = await createServer(await commandServerVite(config, OWN_SERVER));
    expect(first.config.cacheDir).toBe(shared);
    expect(second.config.cacheDir).not.toBe(shared);
    await second.close();
    expect(existsSync(second.config.cacheDir)).toBe(false);
    await first.close();
    const third = await createServer(await commandServerVite(config, OWN_SERVER));
    expect(third.config.cacheDir).toBe(shared);
    await third.close();
  });

  it("keeps the cache folder through a restart", async () => {
    const config = catalogue(STUB_FRAMEWORK);
    const dev = await resolveVite(await catalogueVite(config, {}), "serve");
    const shared = normalizePath(join(dev.cacheDir, COMMAND_CACHE_FOLDER));
    const server = await createServer(await commandServerVite(config, OWN_SERVER));
    await server.restart();
    expect(server.config.cacheDir).toBe(shared);
    // still held: a server started now runs apart
    const other = await createServer(await commandServerVite(config, OWN_SERVER));
    expect(other.config.cacheDir).not.toBe(shared);
    await other.close();
    await server.close();
  });
});
