/**
 * Tests for the packages Vite pre-bundles before a catalogue's first page opens.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ForgebookPlugin } from "../src/plugin.ts";
import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import { prebundled, type Resolve, scannedEntries } from "../src/vite/prebundled.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A catalogue on the stub framework, which pre-bundles one package of its own. */
const CONFIG: ResolvedConfig = {
  dir: "/catalogue",
  framework: { ...STUB_FRAMEWORK, browserDependencies: ["stub-dom"] },
  title: "Acme",
  logo: undefined,
  heights: undefined,
  stories: [],
  docs: [],
  home: undefined,
  sources: ["@acme/ui/stories"],
  switches: undefined,
  languages: [],
  previews: [],
  head: "",
  shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
  tokens: [],
  watch: [],
  lists: {},
  plugins: [],
  hasPlayTools: false,
  frames: ISOLATED_FRAMES,
  build: { readableNames: false }
};

/**
 * A resolver that finds the listed packages at the given files.
 *
 * @param files - each package's resolved file.
 */
const resolverOf =
  (files: Readonly<Record<string, string>>): Resolve =>
  (name: string): string | undefined =>
    files[name];

/** Every package the project can resolve, linked from the workspace (outside `node_modules`). */
const LINKED: Resolve = (name: string): string => `/workspace/${name}/index.js`;

describe("prebundled", () => {
  it("names the shell's and the framework's packages, and not axe, which the frame loads as a script", () => {
    expect(prebundled(CONFIG, LINKED)).toEqual([
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom/client",
      "stub-dom"
    ]);
  });

  it("adds Testing Library only when the project installs it", () => {
    expect(prebundled({ ...CONFIG, hasPlayTools: true }, LINKED)).toContain("@testing-library/user-event");
    expect(prebundled(CONFIG, LINKED)).not.toContain("@testing-library/dom");
  });

  it("leaves out what cannot be resolved, which Vite would fail on", () => {
    expect(prebundled(CONFIG, resolverOf({ react: "/app/node_modules/react/index.js" }))).toEqual(["react"]);
  });

  it("adds Forgebook's page modules only when they come from an installed package, not a linked one", () => {
    const installed: Resolve = (name: string): string => `/app/node_modules/${name}/index.js`;
    const names = prebundled(CONFIG, installed);
    expect(names).toContain("forgebook/shell");
    expect(names).toContain(STUB_FRAMEWORK.pages.frame);
    expect(prebundled(CONFIG, LINKED)).not.toContain("forgebook/shell");
  });

  it("adds the written home's module only for a catalogue with a written home", () => {
    const installed: Resolve = (name: string): string => `/app/node_modules/${name}/index.js`;
    expect(prebundled(CONFIG, installed)).not.toContain("forgebook/shell/home");
    expect(prebundled({ ...CONFIG, home: "/app/forgebook.home.md" }, installed)).toContain(
      "forgebook/shell/home"
    );
  });
});

describe("a catalogue's plugins", () => {
  const plugin: ForgebookPlugin = {
    apiVersion: 1,
    id: "acme",
    frame: "@acme/plugin/frame",
    browserDependencies: ["acme/browser"]
  };

  it("pre-bundles what a plugin names, unresolved since a browser-only module fails Node's resolver", () => {
    expect(prebundled({ ...CONFIG, plugins: [plugin] }, resolverOf({}))).toContain("acme/browser");
    expect(prebundled(CONFIG, resolverOf({}))).not.toContain("acme/browser");
  });

  it("pre-bundles a plugin's modules when it is installed, not when it is linked", () => {
    const listed: ResolvedConfig = { ...CONFIG, plugins: [plugin] };
    const installed = resolverOf({ "@acme/plugin/frame": "/app/node_modules/@acme/plugin/frame.js" });
    expect(prebundled(listed, installed)).toContain("@acme/plugin/frame");
    const linked = resolverOf({ "@acme/plugin/frame": "/repo/plugin/frame.ts" });
    expect(prebundled(listed, linked)).not.toContain("@acme/plugin/frame");
  });
});

describe("scannedEntries", () => {
  it("scans the project's own patterns and each source's, read from its module, relative to it", () => {
    const sourceText = `import files from "./src/*.stories.tsx?forgebook-files";
      import more from './src/**/*.stories.jsx?forgebook-files';`;
    const entries = scannedEntries(
      { ...CONFIG, stories: ["src/**/*.stories.tsx"], sources: ["@acme/ui/stories", "@missing/stories"] },
      resolverOf({ "@acme/ui/stories": "/app/node_modules/@acme/ui/stories.ts" }),
      (file: string): string | undefined => (file.endsWith("stories.ts") ? sourceText : undefined)
    );
    expect(entries).toEqual([
      "src/**/*.stories.tsx",
      "/app/node_modules/@acme/ui/src/*.stories.tsx",
      "/app/node_modules/@acme/ui/src/**/*.stories.jsx"
    ]);
  });

  it("scans the previews, whose imports load with the first story", () => {
    const entries = scannedEntries(
      { ...CONFIG, previews: ["/app/.storybook/preview.js"] },
      resolverOf({}),
      () => undefined
    );
    expect(entries).toContain("/app/.storybook/preview.js");
  });
});
