/**
 * Tests for the pages the plugin generates from a configuration: their HTML, their entries, the data they read and
 * the project's own stories' source.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { configModule, frameEntry, pageHtml, shellEntry, storiesSourceModule } from "../src/vite/pages.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** A resolved configuration with a logo, a preview, its own stories and a package's. */
const CONFIG: ResolvedConfig = {
  dir: "/catalogue",
  framework: STUB_FRAMEWORK,
  title: "Acme <UI>",
  logo: "/catalogue/logo.svg",
  heights: "story-heights.json",
  stories: ["src/**/*.stories.tsx"],
  docs: [],
  sources: ["@acme/ui/stories"],
  switches: undefined,
  languages: [{ id: "it", label: "Italiano" }],
  previews: ["/catalogue/forgebook.preview.tsx"],
  head: '<link rel="stylesheet" href="/fonts.css" />',
  shell: { themeCss: "", styleSheets: [], problems: [] },
  tokens: [],
  watch: [],
  lists: {},
  hasMocks: false,
  hasPlayTools: false
};

describe("the generated pages", () => {
  it("titles the shell after the catalogue, escaped, and gives only the frame the head's tags", () => {
    expect(pageHtml("index.html", CONFIG)).toContain("<title>Acme &#60;UI&#62;</title>");
    expect(pageHtml("index.html", CONFIG)).toContain('<script type="module" src="/.forgebook-shell.ts">');
    expect(pageHtml("index.html", CONFIG)).not.toContain("fonts.css");
    expect(pageHtml("frame.html", CONFIG)).toContain('<link rel="stylesheet" href="/fonts.css" />');
  });

  it("mounts the shell with the data, the logo, the own stories before the packages' and the code writer", () => {
    const entry = shellEntry(CONFIG);
    expect(entry).toContain(`import { codeOf } from ${JSON.stringify(STUB_FRAMEWORK.pages.code)};`);
    expect(entry).toContain('import logo from "/catalogue/logo.svg?url";');
    expect(entry).toContain('import { source as source0 } from "/catalogue/.forgebook-stories.ts";');
    expect(entry).toContain('import { source as source1 } from "@acme/ui/stories";');
    expect(entry).toContain("sources: [source0, source1],");
  });

  it("makes the project's own source from its docs pages alone, and lists them", () => {
    const docsOnly = { ...CONFIG, stories: [], docs: ["./docs/**/*.md"] };
    expect(shellEntry(docsOnly)).toContain(
      'import { source as source0 } from "/catalogue/.forgebook-stories.ts";'
    );
    const source = storiesSourceModule(docsOnly);
    expect(source).toContain('import docs0 from "./docs/**/*.md?forgebook-docs-pages";');
    expect(source).toContain("  docs: [docs0],");
    expect(storiesSourceModule(CONFIG)).not.toContain("docs:");
  });

  it("mounts the framework's frame with the previews, the catalogue's last", () => {
    const entry = frameEntry(CONFIG);
    expect(entry).toContain(`import { mountFrame } from ${JSON.stringify(STUB_FRAMEWORK.pages.frame)};`);
    expect(entry).toContain('import * as preview0 from "/catalogue/forgebook.preview.tsx";');
    expect(entry).toContain("previews: [preview0]");
  });

  it("loads Testing Library for the plays only when the project installs it, and only on the first play", () => {
    expect(frameEntry(CONFIG)).not.toContain("@testing-library");
    const entry = frameEntry({ ...CONFIG, hasPlayTools: true });
    expect(entry).toContain('import("@testing-library/dom"), import("@testing-library/user-event")');
    expect(entry).not.toMatch(/^import .*@testing-library/m);
  });

  it("hands the pages the configuration's data, and the own stories as one source named after the catalogue", () => {
    expect(configModule(CONFIG)).toBe(
      'export default {"title":"Acme <UI>","heights":"story-heights.json","languages":[{"id":"it","label":"Italiano"}],"lists":{}};'
    );
    const source = storiesSourceModule(CONFIG);
    expect(source).toContain('import files0 from "./src/**/*.stories.tsx?forgebook-files";');
    expect(source).toContain('name: "Acme <UI>",');
  });
});

describe("a story's mocked API", () => {
  it("names MSW in the frame's entry only for a project that installs it, and only as a dynamic import", () => {
    expect(frameEntry(CONFIG)).not.toContain("msw");
    const entry = frameEntry({ ...CONFIG, hasMocks: true });
    expect(entry).toContain('mockTools: () => import("msw/browser"),');
    expect(entry).not.toContain('from "msw');
  });

  it("keeps it out of the shell", () => {
    expect(shellEntry({ ...CONFIG, hasMocks: true })).not.toContain("msw");
  });
});

describe("a catalogue's theme", () => {
  const themed: ResolvedConfig = {
    ...CONFIG,
    shell: { ...CONFIG.shell, themeCss: ":root{--forgebook-font-sans:Inter}" }
  };

  it("goes in the shell's page, with no script", () => {
    expect(pageHtml("index.html", themed)).toContain("<style>:root{--forgebook-font-sans:Inter}</style>");
  });

  it("stays out of the frames, which belong to the stories", () => {
    expect(pageHtml("frame.html", themed)).not.toContain("--forgebook-font-sans");
  });

  it("writes nothing for a catalogue with no theme", () => {
    expect(pageHtml("index.html", CONFIG)).not.toContain("<style>");
  });

  it("gives the shell the tokens' module to load on first use, only when the catalogue has tokens", () => {
    expect(shellEntry(CONFIG)).not.toContain("loadTokens");
    const entry = shellEntry({ ...CONFIG, tokens: [{ path: "/catalogue/tokens.json", mode: undefined }] });
    expect(entry).toContain('loadTokens: () => import("virtual:forgebook/tokens")');
    expect(entry).not.toContain('from "virtual:forgebook/tokens"');
  });

  it("imports the catalogue's style sheet into the shell only", () => {
    const styled: ResolvedConfig = {
      ...CONFIG,
      shell: { ...CONFIG.shell, styleSheets: ["/catalogue/shell.css"] }
    };
    expect(shellEntry(styled)).toContain('import "/catalogue/shell.css";');
    expect(frameEntry(styled)).not.toContain("shell.css");
  });
});
