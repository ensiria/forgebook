/**
 * Tests for a catalogue that turns off its accessibility check (`a11y: false`) or its component docs
 * (`componentDocs: false`): the settings the shell and the frame read, the configuration merged and checked, what the
 * plugin generates and ships without them, the docs read from nothing, and the props the panel makes from a story's
 * args instead.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { docsOfArgs, propsOfArgs } from "../src/argsProps.ts";
import { catalogueSettings } from "../src/catalogue.ts";
import { codeLiteral } from "../src/codeLiteral.ts";
import { DEFAULT_SWITCHES } from "../src/switches.ts";
import { textsModuleCode } from "../src/vite/builtTexts.ts";
import type { ForgebookConfig } from "../src/vite/config.ts";
import { mergedLists, type ResolvedConfig, resolveConfig } from "../src/vite/configFile.ts";
import { NO_DOCS_EXTRACTOR } from "../src/vite/docsExtractor.ts";
import { forgebookPlugin } from "../src/vite/forgebookPlugin.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import { storyFilesCode } from "../src/vite/storyFilesModule.ts";
import { KIT_DIR } from "./fixturePaths.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A configuration with the least it needs. */
const BASE: ForgebookConfig = {
  framework: STUB_FRAMEWORK,
  title: "Catalogue",
  sources: ["@acme/ui/stories"]
};

/**
 * A resolved configuration over the fixture kit, with the lists given.
 *
 * @param lists - the lists it sets.
 */
const kitConfig = (lists: ResolvedConfig["lists"]): ResolvedConfig => ({
  dir: KIT_DIR,
  framework: STUB_FRAMEWORK,
  title: "Kit",
  argControls: {},
  logo: undefined,
  heights: undefined,
  stories: ["src/*.stories.tsx"],
  docs: [],
  sources: [],
  switches: undefined,
  languages: [],
  previews: [],
  head: "",
  shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
  tokens: [],
  watch: [],
  lists,
  plugins: [],
  home: undefined,
  hasPlayTools: false,
  frames: ISOLATED_FRAMES,
  build: { readableNames: false }
});

/** The code of what a hook answered, or an empty text. */
const codeOf = (loaded: unknown): string =>
  typeof loaded === "object" && loaded !== null && "code" in loaded ? String(loaded.code) : "";

/**
 * The plugin's `load` and `generateBundle` on a configuration, in a build or on a dev server, with the files a build
 * wrote.
 *
 * @param config - the configuration.
 * @param command - a dev server's or a build's.
 */
const pluginOf = async (
  config: ResolvedConfig,
  command: "serve" | "build"
): Promise<{
  readonly load: (id: string) => Promise<string>;
  readonly resolve: (source: string, importer: string) => string;
  readonly bundle: () => readonly string[];
  readonly close: () => Promise<unknown>;
}> => {
  const plugin = forgebookPlugin({ config });
  const { config: configHook, load, generateBundle, closeBundle, resolveId } = plugin;
  if (
    typeof configHook !== "function" ||
    typeof resolveId !== "function" ||
    typeof load !== "function" ||
    typeof generateBundle !== "function" ||
    typeof closeBundle !== "function"
  )
    throw new Error("missing hooks");
  await Reflect.apply(configHook, undefined, [{}, { command, mode: "production" }]);
  const emitted: string[] = [];
  const context = {
    environment: { name: "ssr" },
    addWatchFile: (): undefined => undefined,
    emitFile: (asset: { fileName: string }): string => {
      emitted.push(asset.fileName);
      return asset.fileName;
    },
    resolve: async (): Promise<null> => null,
    error: (message: string): never => {
      throw new Error(message);
    }
  };
  return {
    load: async (id: string): Promise<string> => codeOf(await Reflect.apply(load, context, [id])),
    resolve: (source: string, importer: string): string =>
      String(Reflect.apply(resolveId, context, [source, importer, { isEntry: false }])),
    bundle: (): readonly string[] => {
      Reflect.apply(generateBundle, { ...context, environment: { name: "client" } }, []);
      return emitted;
    },
    close: async (): Promise<unknown> => Reflect.apply(closeBundle, undefined, [])
  };
};

describe("a catalogue's settings without an accessibility check or component docs", () => {
  it("checks accessibility and reads the docs by default", () => {
    const settings = catalogueSettings("Acme", DEFAULT_SWITCHES);
    expect(settings.a11y?.tags.length).toBeGreaterThan(0);
    expect(settings.hasComponentDocs).toBe(true);
    expect(settings.hasUsedIn).toBe(true);
    expect(settings.tabs).toContain("a11y");
  });

  it("drops the Accessibility tab and the rules with `a11y: false`", () => {
    const settings = catalogueSettings("Acme", DEFAULT_SWITCHES, { a11y: false });
    expect(settings.a11y).toBeUndefined();
    expect(settings.tabs).not.toContain("a11y");
    expect(settings.tabs).toContain("props");
  });

  it("turns Used in off with the component docs, whose programs read the import graph", () => {
    const settings = catalogueSettings("Acme", DEFAULT_SWITCHES, { componentDocs: false });
    expect(settings.hasComponentDocs).toBe(false);
    expect(settings.hasUsedIn).toBe(false);
    // the Props tab stays: its controls come from the story's args
    expect(settings.tabs).toContain("props");
  });
});

describe("the configuration's accessibility check and component docs", () => {
  it("keeps the check off once any list turns it off, as a tab", () => {
    expect(mergedLists([{ a11y: false }, { a11y: { disabledRules: ["region"] } }]).a11y).toBe(false);
    expect(
      mergedLists([{ a11y: { tags: ["wcag2a"] } }, { a11y: { disabledRules: ["region"] } }]).a11y
    ).toEqual({
      tags: ["wcag2a"],
      disabledRules: ["region"]
    });
  });

  it("takes the last list's word on the component docs", () => {
    expect(mergedLists([{ componentDocs: false }, {}]).componentDocs).toBe(false);
    expect(mergedLists([{ componentDocs: false }, { componentDocs: true }]).componentDocs).toBe(true);
  });

  it("refuses Used in asked for with the component docs off, and an accessibility setting that is neither", () => {
    expect(() => resolveConfig({ ...BASE, usedIn: true, componentDocs: false }, "/catalogue")).toThrow(
      /usedIn is true with componentDocs false/
    );
    expect(resolveConfig({ ...BASE, componentDocs: false }, "/catalogue").lists.componentDocs).toBe(false);
    const loose: ForgebookConfig = { ...BASE, ...JSON.parse('{"a11y":true}') };
    expect(() => resolveConfig(loose, "/catalogue")).toThrow(/a11y is true: write its rules/);
  });
});

describe("the plugin without an accessibility check", () => {
  it("gives the frame no address of axe and writes none of it in a build", async () => {
    const off = await pluginOf(kitConfig({ a11y: false }), "build");
    expect(await off.load(join(KIT_DIR, ".forgebook-frame.ts"))).not.toContain("axeUrl");
    expect(off.bundle().some((file) => file.includes("axe-"))).toBe(false);
    const on = await pluginOf(kitConfig({}), "build");
    expect(await on.load(join(KIT_DIR, ".forgebook-frame.ts"))).toContain("axeUrl");
    expect(on.bundle().some((file) => /^assets\/axe-[0-9a-f]{8}\.bin$/.test(file))).toBe(true);
  });
});

describe("the plugin without component docs", () => {
  it("offers no docs, Used in nor reach in a pattern's module, and answers a docs query without a worker", async () => {
    const plugin = await pluginOf(kitConfig({ componentDocs: false }), "serve");
    const code = await plugin.load(
      plugin.resolve("./src/*.stories.tsx?forgebook-files", join(KIT_DIR, "stories.ts"))
    );
    expect(code).toContain("docs: {},");
    expect(code).not.toContain("?forgebook-docs");
    expect(code).not.toContain("usage:");
    expect(code).not.toContain("reach:");
    // the code and the pages keep their columns
    expect(code).toContain("?forgebook-code");
    expect(code).toContain("code: column(4),");
    const docs = await plugin.load(`${join(KIT_DIR, "src", "Select.stories.tsx")}?forgebook-docs`);
    expect(docs).toMatch(/^export default {"name":null};/);
    await plugin.close();
  });

  it("offers no docs, Used in nor reach in the group a configuration's stories make, `!` patterns and all", async () => {
    const stories = ["src/*.stories.tsx", "src/Select.stories.tsx", "!src/Form.stories.tsx"];
    const plugin = await pluginOf({ ...kitConfig({ componentDocs: false }), stories }, "serve");
    const source = await plugin.load(join(KIT_DIR, ".forgebook-stories.ts"));
    const literal = /import files from ("[^"]+");/.exec(source)?.[1] ?? '""';
    const specifier: unknown = JSON.parse(literal);
    const code = await plugin.load(plugin.resolve(String(specifier), join(KIT_DIR, ".forgebook-stories.ts")));
    expect(code).toContain(codeLiteral("./src/Select.stories.tsx"));
    expect(code).not.toContain(codeLiteral("./src/Form.stories.tsx"));
    expect(code).toContain("docs: {},");
    expect(code).not.toContain("usage:");
    expect(code).not.toContain("reach:");
    await plugin.close();
  });

  it("answers every story file as one without a component, and starts nothing", async () => {
    expect(await NO_DOCS_EXTRACTOR.extract("/any/A.stories.tsx")).toEqual({ docs: { name: null } });
    expect(await NO_DOCS_EXTRACTOR.usage([])).toMatch(/componentDocs: false/);
  });

  it("keeps the docs' place in a build's rows, with nothing in it", () => {
    const code = textsModuleCode([[undefined, {}, { html: "", summary: "" }]], () => 0);
    expect(code).toMatch(/export default \[\[null, writtenText\d, writtenText\d\]\];/);
    const pattern = storyFilesCode("/kit", ["./src/*.stories.tsx"], [], {
      hasDocs: false,
      hasUsage: false,
      hasReach: false
    });
    expect(pattern).toContain("docs: {},");
  });
});

describe("the props a story's args stand for", () => {
  it("reads each arg's kind from its value, and the actions as events", () => {
    const props = propsOfArgs(
      {
        label: "Save",
        count: 2,
        isOpen: true,
        sizes: ["sm"],
        icon: { of: "IconComponent", named: "IconStar" }
      },
      ["onClick", "count"]
    );
    expect(props.map((prop) => [prop.name, prop.kind, prop.type])).toEqual([
      ["label", "text", "string"],
      ["count", "event", "function"],
      ["isOpen", "toggle", "boolean"],
      ["sizes", "other", "array"],
      ["icon", "other", "IconComponent"],
      ["onClick", "event", "function"]
    ]);
    expect(props.every((prop) => !prop.isRequired)).toBe(true);
  });

  it("makes a component's docs of its name and those props, and nothing it cannot know", () => {
    expect(docsOfArgs("Button", { label: "Save" }, [])).toEqual({
      name: "Button",
      description: "",
      summary: "",
      props: [{ name: "label", kind: "text", type: "string", description: "", isRequired: false }],
      parts: [],
      subcomponents: []
    });
  });
});
