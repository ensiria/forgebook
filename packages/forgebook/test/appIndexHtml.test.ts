/**
 * Tests that a catalogue's dev server never answers a missing file with the app's own `index.html`: Vite would load
 * every module the app's entry reaches, pre-bundle the packages the stories never import, and reload every frame open,
 * which ends a `forgebook verify` run halfway.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { catalogueVite } from "../bin/forgebook/catalogueVite.ts";
import { resolveConfig } from "../src/vite/configFile.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** What a browser's `<img>` sends: `*` matches HTML too, which is what Vite's fallback looks for. */
const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

/** A catalogue in an app's folder, whose `index.html` is the app's own page with its entry. */
const appCatalogue = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "forgebook-app-index-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "app", private: true }));
  writeFileSync(
    join(dir, "index.html"),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>'
  );
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "main.ts"), 'document.body.dataset["app"] = "started";\n');
  return dir;
};

const servers: ViteDevServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

/** The catalogue's dev server as `forgebook dev` and `verify` start it, listening on a free port. */
const listening = async (dir: string): Promise<{ server: ViteDevServer; origin: string }> => {
  const config = resolveConfig({ framework: STUB_FRAMEWORK, title: "Catalogue", sources: [] }, dir);
  const server = await createServer(
    await catalogueVite(config, {
      server: { port: 0, host: "127.0.0.1", hmr: false, watch: null },
      logLevel: "silent"
    })
  );
  servers.push(server);
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (origin === undefined) throw new Error("The server started with no address");
  return { server, origin: origin.replace(/\/$/, "") };
};

describe("a catalogue's dev server", () => {
  it("answers a story's missing image with 404, not the app's page", async () => {
    const { origin } = await listening(appCatalogue());
    const response = await fetch(`${origin}/avatars/missing.png`, { headers: { accept: IMAGE_ACCEPT } });
    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).not.toContain("/src/main.ts");
  });

  it("loads nothing of the app's entry for it", async () => {
    const { server, origin } = await listening(appCatalogue());
    await (await fetch(`${origin}/avatars/missing.png`, { headers: { accept: IMAGE_ACCEPT } })).text();
    // Vite starts on a page's scripts as it serves the page, without waiting for a browser to ask
    await new Promise((resolve) => setTimeout(resolve, 200));
    const entry = await server.environments.client.moduleGraph.getModuleByUrl("/src/main.ts");
    expect(entry).toBeUndefined();
  });

  it("still serves the catalogue's own page at the root", async () => {
    const { origin } = await listening(appCatalogue());
    const response = await fetch(`${origin}/`, { headers: { accept: "text/html" } });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).not.toContain("/src/main.ts");
  });
});
