/**
 * Tests for the export conditions the dev server resolves a package with on Node: the pages', so a package a monorepo
 * points at its sources loads on the server as it does in the frames.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, defaultServerConditions, type Plugin, type UserConfig } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { serverConditions, serverConditionsOf } from "../src/vite/serverConditions.ts";

/** The folders a test made, removed after it. */
const made: string[] = [];

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A catalogue's folder whose preview imports a package of the monorepo that exports its sources under a `source`
 * condition and names a build that was never made.
 */
const monorepo = (): { readonly root: string; readonly preview: string } => {
  const root = mkdtempSync(join(tmpdir(), "forgebook-conditions-"));
  made.push(root);
  const kit = join(root, "packages", "kit");
  mkdirSync(join(kit, "src"), { recursive: true });
  writeFileSync(
    join(kit, "package.json"),
    JSON.stringify({
      name: "kit",
      exports: { ".": { source: "./src/index.ts", import: "./dist/index.mjs" } }
    })
  );
  writeFileSync(join(kit, "src", "index.ts"), 'export const theme = "light";\n');
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "catalogue", private: true }));
  // the workspace's link, as a package manager makes it
  mkdirSync(join(root, "node_modules"));
  symlinkSync(kit, join(root, "node_modules", "kit"), "dir");
  const preview = join(root, "preview.ts");
  writeFileSync(preview, 'import { theme } from "kit";\nexport const parameters = { theme };\n');
  return { root, preview };
};

/** A plugin that names the pages' conditions, as a catalogue's or a framework's plugin does. */
const pagesConditions = (conditions: readonly string[]): Plugin => ({
  name: "pages-conditions",
  config: (): UserConfig => ({ resolve: { conditions: [...conditions] } })
});

describe("serverConditionsOf", () => {
  it("takes the pages' conditions, without the browser's, beside the server's own", () => {
    const conditions = serverConditionsOf({ resolve: { conditions: ["source", "module", "browser"] } });
    expect(conditions).toEqual(expect.arrayContaining(["source", "module", ...defaultServerConditions]));
    expect(conditions).not.toContain("browser");
  });

  it("leaves out every other runtime's conditions, and reads the pages' environment's own", () => {
    const conditions = serverConditionsOf({
      resolve: { conditions: ["module"] },
      environments: { client: { resolve: { conditions: ["source", "worker", "react-native", "browser"] } } }
    });
    expect(conditions).toContain("source");
    expect(conditions).not.toEqual(expect.arrayContaining(["worker"]));
    expect(conditions).not.toEqual(expect.arrayContaining(["react-native"]));
  });

  it("leaves a server that runs as a web worker as Vite makes it", () => {
    expect(
      serverConditionsOf({ resolve: { conditions: ["source"] }, ssr: { target: "webworker" } })
    ).toBeUndefined();
  });

  it("leaves Vite's when the pages name none, and the catalogue's when it names the server's", () => {
    expect(serverConditionsOf({})).toBeUndefined();
    expect(
      serverConditionsOf({ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["node"] } } })
    ).toBeUndefined();
    expect(
      serverConditionsOf({
        resolve: { conditions: ["source"] },
        environments: { ssr: { resolve: { conditions: ["node"] } } }
      })
    ).toBeUndefined();
  });
});

describe("serverConditions", () => {
  it("loads on the server a package the pages read from its sources, with a plugin's conditions read after it", async () => {
    const { root, preview } = monorepo();
    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, ws: false },
      // nothing to pre-bundle: a scan of the folder would only slow the test down on a busy machine
      optimizeDeps: { noDiscovery: true },
      plugins: [
        serverConditions(),
        pagesConditions(["source", "module", "browser", "development|production"])
      ]
    });
    try {
      expect(server.environments.ssr.config.resolve.conditions).toContain("source");
      expect(server.environments.ssr.config.resolve.conditions).not.toContain("browser");
      const module: unknown = await server.ssrLoadModule(preview);
      expect(module).toMatchObject({ parameters: { theme: "light" } });
    } finally {
      await server.close();
    }
  }, 30_000);
});
