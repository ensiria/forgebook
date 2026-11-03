/**
 * Tests for how the dev server loads a catalogue's preview for tools: what it imports that only a browser can run is
 * left as placeholders, and a preview that uses one while it loads still fails.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { browserOnlyNamespace, isBrowserGlobalError, loadPreview } from "../src/vite/previewRunner.ts";

/** The folders and servers a test made, removed after it. */
const made: string[] = [];
const servers: ViteDevServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A package installed in `node_modules`, so Vite leaves it to Node, which reads `document` while it loads. */
const BROWSER_PACKAGE = [
  "const isOld = !!document.documentElement.currentStyle;",
  "export const DocsContainer = () => isOld;",
  "export const themes = { light: {} };",
  ""
].join("\n");

/**
 * A catalogue's folder with a browser-only package, a file of its own that reads `window` after defining a decorator,
 * and a preview.
 *
 * @param preview - the preview's code.
 */
const catalogue = async (
  preview: string
): Promise<{ readonly load: (file: string) => Promise<unknown>; readonly file: string }> => {
  const root = mkdtempSync(join(tmpdir(), "forgebook-preview-runner-"));
  made.push(root);
  const kit = join(root, "node_modules", "browser-kit");
  mkdirSync(kit, { recursive: true });
  writeFileSync(
    join(kit, "package.json"),
    JSON.stringify({ name: "browser-kit", type: "module", exports: "./index.js" })
  );
  writeFileSync(join(kit, "index.js"), BROWSER_PACKAGE);
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "catalogue", private: true, type: "module" })
  );
  writeFileSync(
    join(root, "decorators.ts"),
    "export const withFont = (story: () => unknown) => story();\nwindow.addEventListener('load', () => {});\n"
  );
  const file = join(root, "preview.ts");
  writeFileSync(file, preview);
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, ws: false },
    // nothing to pre-bundle: a scan of the folder would only slow the test down on a busy machine
    optimizeDeps: { noDiscovery: true }
  });
  servers.push(server);
  return { load: (each: string): Promise<unknown> => loadPreview(server.environments.ssr, each), file };
};

describe("isBrowserGlobalError", () => {
  it("is a global Node does not have, not another error", () => {
    expect(isBrowserGlobalError(new ReferenceError("document is not defined"))).toBe(true);
    expect(isBrowserGlobalError(new ReferenceError("Cannot access 'theme' before initialization"))).toBe(
      false
    );
    expect(isBrowserGlobalError(new TypeError("document is not defined"))).toBe(false);
    // a mistake, or a global of Node's, is the preview's error to report
    expect(isBrowserGlobalError(new ReferenceError("tehme is not defined"))).toBe(false);
    expect(isBrowserGlobalError(new ReferenceError("require is not defined"))).toBe(false);
  });
});

describe("browserOnlyNamespace", () => {
  it("answers every name with a placeholder that can be kept and written as JSON, and is not a promise", async () => {
    const namespace = browserOnlyNamespace("/kit/index.js", "document is not defined");
    expect("DocsContainer" in namespace).toBe(true);
    expect("then" in namespace).toBe(false);
    expect(await Promise.resolve(namespace)).toBe(namespace);
    const container: unknown = Reflect.get(namespace, "DocsContainer");
    expect(typeof container).toBe("function");
    expect(JSON.stringify({ docs: { container }, layout: "centered" })).toBe(
      '{"docs":{},"layout":"centered"}'
    );
  });

  it("throws, naming the module, when a placeholder is read", () => {
    const namespace = browserOnlyNamespace("/kit/index.js", "document is not defined");
    const themes: unknown = Reflect.get(namespace, "themes");
    expect(() => Reflect.get(Object(themes), "light")).toThrow(
      "themes.light of /kit/index.js cannot be used"
    );
    const container: unknown = Reflect.get(namespace, "DocsContainer");
    // a call is kept, as an addon's factory is in a preview's list; what it made cannot be read either
    const made: unknown = typeof container === "function" ? container() : undefined;
    expect(typeof made).toBe("function");
    expect(() => Reflect.get(Object(made), "title")).toThrow("DocsContainer().title of /kit/index.js");
    // its names cannot be listed: an empty list would be a value a browser does not give
    expect(() => Object.keys(namespace)).toThrow("The names of /kit/index.js cannot be used");
  });
});

describe("loadPreview", () => {
  it("loads a preview whose imports need a browser, with its args and parameters", async () => {
    const { load } = await catalogue(
      [
        'import { DocsContainer } from "browser-kit";',
        'export const args = { size: "medium" };',
        'export const parameters = { layout: "centered", docs: { container: DocsContainer } };',
        ""
      ].join("\n")
    );
    const preview = await load("/preview.ts");
    expect(preview).toMatchObject({ args: { size: "medium" }, parameters: { layout: "centered" } });
  });

  it("still fails a preview whose own file reads a browser global: half run, it would give other values", async () => {
    const { load } = await catalogue(
      'import { withFont } from "./decorators";\nexport const decorators = [withFont];\n'
    );
    await expect(load("/preview.ts")).rejects.toThrow("window is not defined");
  });

  it("still fails a preview that uses what needs a browser while it loads", async () => {
    const { load } = await catalogue(
      'import { themes } from "browser-kit";\nexport const parameters = { theme: themes.light };\n'
    );
    await expect(load("/preview.ts")).rejects.toThrow("themes.light of");
  });

  it("still fails a preview that reads a browser global itself", async () => {
    const { load } = await catalogue("export const parameters = { dir: document.dir };\n");
    await expect(load("/preview.ts")).rejects.toThrow("document is not defined");
  });
});
