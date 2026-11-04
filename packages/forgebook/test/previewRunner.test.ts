/**
 * Tests for how the dev server loads a catalogue's preview for tools: what it imports that only a browser can run is
 * left as placeholders, and a preview that uses one while it loads still fails.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createServer, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { readPreview } from "../src/frame/storyModule.ts";
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
  "export default () => ({ parameters: { docs: { container: DocsContainer } } });",
  ""
].join("\n");

/**
 * What Storybook 10's `definePreview` does while a preview loads, as `storybook/internal/csf` writes it: it composes
 * its addons and the rest at once, each field read as `default?.[field] ?? [field]`, lists flattened, objects merged,
 * the last of a single field kept, and enhancers split by `secondPass`.
 */
const STORYBOOK_DEFINE_PREVIEW = [
  "const getField = (list, field) => list.map((xs) => xs.default?.[field] ?? xs[field]).filter(Boolean);",
  "const getArrayField = (list, field) =>",
  "  getField(list, field).reduce((all, each) => [...all, ...(Array.isArray(each) ? each : [each])], []);",
  "const getObjectField = (list, field) => Object.assign({}, ...getField(list, field));",
  "const getSingletonField = (list, field) => getField(list, field).pop();",
  "const composeConfigs = (list) => {",
  '  const enhancers = getArrayField(list, "argTypesEnhancers");',
  "  return {",
  '    parameters: Object.assign({}, ...getField(list, "parameters")),',
  '    decorators: getArrayField(list, "decorators"),',
  '    args: getObjectField(list, "args"),',
  '    initialGlobals: getObjectField(list, "initialGlobals"),',
  '    globalTypes: getObjectField(list, "globalTypes"),',
  "    argTypesEnhancers: [...enhancers.filter((e) => !e.secondPass), ...enhancers.filter((e) => e.secondPass)],",
  '    render: getSingletonField(list, "render"),',
  '    tags: getArrayField(list, "tags")',
  "  };",
  "};",
  "export const definePreview = (input) => {",
  "  const { addons, ...rest } = input;",
  '  return { _tag: "Preview", input, composed: composeConfigs([...(addons ?? []), rest]) };',
  "};",
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
    expect(() => new (Object(themes))()).toThrow("new themes of /kit/index.js cannot be used");
    // its names cannot be listed: an empty list would be a value a browser does not give
    expect(() => Object.keys(namespace)).toThrow("The names of /kit/index.js cannot be used");
  });

  it("lets what a call made be looked into, called and merged, as deep as a framework goes", () => {
    const namespace = browserOnlyNamespace("/kit/index.js", "document is not defined");
    const factory: unknown = Reflect.get(namespace, "default");
    const addon: unknown = typeof factory === "function" ? factory() : undefined;
    // Storybook's composition of `definePreview({ addons: [docs()] })`: `addon.default?.[field] ?? addon[field]`
    const field: unknown = Reflect.get(Object(Reflect.get(Object(addon), "default")), "parameters");
    expect(typeof field).toBe("function");
    expect([field].filter(Boolean)).toEqual([field]);
    expect(Object.assign({}, field)).toEqual({});
    expect(Array.isArray(field)).toBe(false);
    expect(JSON.stringify({ parameters: field, layout: "centered" })).toBe('{"layout":"centered"}');
    // deeper still: a member of the result called, and a member of what that made
    const deeper: unknown =
      typeof field === "function" ? Reflect.get(Object(field()), "decorators") : undefined;
    expect(typeof deeper).toBe("function");
    // the same placeholder each time, as a framework that reads a field twice expects
    expect(Reflect.get(Object(addon), "default")).toBe(Reflect.get(Object(addon), "default"));
  });

  it("ends a chain that never ends, as a loop walking a placeholder makes, with the same message", () => {
    const namespace = browserOnlyNamespace("/kit/index.js", "document is not defined");
    const factory: unknown = Reflect.get(namespace, "default");
    let node: unknown = typeof factory === "function" ? factory() : undefined;
    const walk = (): void => {
      while (node) node = Reflect.get(Object(node), "parent");
    };
    expect(walk).toThrow(/^default\(\)(\.parent)+ of \/kit\/index\.js cannot be used on the server/);
  });

  it("cannot be constructed through its prototype either", () => {
    const namespace = browserOnlyNamespace("/kit/index.js", "document is not defined");
    const factory: unknown = Reflect.get(namespace, "default");
    const made: unknown = typeof factory === "function" ? factory() : undefined;
    const prototype: unknown = Reflect.get(Object(made), "prototype");
    const maker: unknown = Reflect.get(Object(prototype), "constructor");
    expect(maker).toBe(made);
    expect(() => new (Object(maker))()).toThrow("new default() of /kit/index.js cannot be used");
  });

  it("throws, naming the whole chain, when what a call made is used as a string, a number or a list", () => {
    const namespace = browserOnlyNamespace("/kit/index.js", "document is not defined");
    const factory: unknown = Reflect.get(namespace, "default");
    const addon: unknown = typeof factory === "function" ? factory() : undefined;
    const title: unknown = Reflect.get(Object(Reflect.get(Object(addon), "default")), "title");
    const chain = "default().default.title of /kit/index.js cannot be used on the server";
    expect(() => `${String(title)}`).toThrow(chain);
    expect(() => Number(title)).toThrow(chain);
    expect(() => [...Object(title)]).toThrow(chain);
    expect(() => new (Object(title))()).toThrow(`new ${chain}`);
    // an export used as a value fails the same way, before any of its members is read
    expect(() => String(factory)).toThrow("default of /kit/index.js cannot be used");
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

  it("loads Aksel's preview: definePreview with addons from packages that need a browser, read by its input", async () => {
    const { load, file } = await catalogue(
      [
        'import addonDocs from "browser-kit";',
        'import { definePreview } from "./csf";',
        "const addons = [addonDocs(), addonDocs()];",
        "export default definePreview({",
        "  addons,",
        '  parameters: { layout: "centered", docs: { codePanel: true } },',
        '  globalTypes: { font: { toolbar: { items: [{ value: "Source Sans 3" }] } } },',
        '  initialGlobals: { font: "Source Sans 3" },',
        "  decorators: [(story) => story()]",
        "});",
        ""
      ].join("\n")
    );
    writeFileSync(join(dirname(file), "csf.ts"), STORYBOOK_DEFINE_PREVIEW);
    writeFileSync(
      join(dirname(file), "forgebook.preview.ts"),
      [
        'import preview from "./preview";',
        "export const decorators = preview.input.decorators;",
        "export const { parameters, globalTypes, initialGlobals } = preview.input;",
        ""
      ].join("\n")
    );
    const read = readPreview(await load("/forgebook.preview.ts"));
    expect(read.parameters).toMatchObject({ layout: "centered", docs: { codePanel: true } });
    expect(read.globals).toEqual({ font: "Source Sans 3" });
    expect(read.decorators).toHaveLength(1);
  });

  it("leaves out of the answers a placeholder kept in a parameter, as it leaves out a function", async () => {
    const { load } = await catalogue(
      [
        'import addonDocs from "browser-kit";',
        'export const parameters = { layout: "centered", docs: { theme: addonDocs().default.theme } };',
        ""
      ].join("\n")
    );
    const read = readPreview(await load("/preview.ts"));
    expect(JSON.parse(JSON.stringify(read.parameters))).toEqual({ layout: "centered", docs: {} });
  });

  it("still fails a preview that takes a text from what a browser-only factory made", async () => {
    const { load } = await catalogue(
      'import addonDocs from "browser-kit";\nexport const parameters = { title: "Docs: " + addonDocs().default.title };\n'
    );
    await expect(load("/preview.ts")).rejects.toThrow("default().default.title of");
  });

  it("still fails a preview that reads a browser global itself", async () => {
    const { load } = await catalogue("export const parameters = { dir: document.dir };\n");
    await expect(load("/preview.ts")).rejects.toThrow("document is not defined");
  });
});
