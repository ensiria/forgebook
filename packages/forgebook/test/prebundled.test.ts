/**
 * Tests for the packages Vite pre-bundles before a catalogue's first page opens.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ResolvedConfig } from "../src/vite/configFile.ts";
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
  sources: ["@acme/ui/stories"],
  switches: undefined,
  languages: [],
  previews: [],
  head: "",
  shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
  tokens: [],
  watch: [],
  lists: {},
  hasMocks: false,
  hasPlayTools: false
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
  it("names the shell's, the framework's and the core's own packages, the core's through the core", () => {
    expect(prebundled(CONFIG, LINKED, LINKED)).toEqual([
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom/client",
      "stub-dom",
      "forgebook > axe-core"
    ]);
  });

  it("adds Testing Library only when the project installs it", () => {
    expect(prebundled({ ...CONFIG, hasPlayTools: true }, LINKED, LINKED)).toContain(
      "@testing-library/user-event"
    );
    expect(prebundled(CONFIG, LINKED, LINKED)).not.toContain("@testing-library/dom");
  });

  it("leaves out what cannot be resolved, which Vite would fail on", () => {
    expect(
      prebundled(CONFIG, resolverOf({ react: "/app/node_modules/react/index.js" }), resolverOf({}))
    ).toEqual(["react"]);
  });

  it("adds Forgebook's page modules only when they come from an installed package, not a linked one", () => {
    const installed: Resolve = (name: string): string => `/app/node_modules/${name}/index.js`;
    const names = prebundled(CONFIG, installed, LINKED);
    expect(names).toContain("forgebook/shell");
    expect(names).toContain(STUB_FRAMEWORK.pages.frame);
    expect(prebundled(CONFIG, LINKED, LINKED)).not.toContain("forgebook/shell");
  });
});

describe("a project with MSW", () => {
  it("pre-bundles its browser module, which Node cannot resolve, so a page does not reload to find it", () => {
    expect(prebundled({ ...CONFIG, hasMocks: true }, resolverOf({}), resolverOf({}))).toContain(
      "msw/browser"
    );
    expect(prebundled(CONFIG, resolverOf({}), resolverOf({}))).not.toContain("msw/browser");
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
});
