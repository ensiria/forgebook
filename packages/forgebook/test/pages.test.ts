/**
 * Tests for the pages the plugin generates from a configuration: their HTML, their entries, the data they read and
 * the project's own stories' source.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ForgebookPlugin } from "../src/plugin.ts";
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
  shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
  tokens: [],
  watch: [],
  lists: {},
  hasPlayTools: false,
  plugins: [],
  build: { readableNames: false }
};

describe("the generated pages", () => {
  it("writes what a frame needs of the theme into the frame only, and nothing without it", () => {
    const themed = { ...CONFIG, shell: { ...CONFIG.shell, frameCss: ".forgebook-frame-error{--x:1}" } };
    expect(pageHtml("frame.html", themed)).toContain("<style>.forgebook-frame-error{--x:1}</style>");
    expect(pageHtml("index.html", themed)).not.toContain("forgebook-frame-error");
    expect(pageHtml("frame.html", CONFIG)).not.toContain("<style>");
  });

  it("tells the shell to leave Forgebook's mark out only when the branding is off", () => {
    expect(shellEntry(CONFIG)).not.toContain("hasBranding");
    const plain = { ...CONFIG, shell: { ...CONFIG.shell, hasBranding: false } };
    expect(shellEntry(plain)).toContain("hasBranding: false,");
  });

  it("titles the shell after the catalogue, escaped, and gives only the frame the head's tags", () => {
    expect(pageHtml("index.html", CONFIG)).toContain("<title>Acme &#60;UI&#62;</title>");
    expect(pageHtml("index.html", CONFIG)).toContain('<script type="module" src="/.forgebook-shell.ts">');
    expect(pageHtml("index.html", CONFIG)).not.toContain("fonts.css");
    expect(pageHtml("frame.html", CONFIG)).toContain('<link rel="stylesheet" href="/fonts.css" />');
  });

  it("gives the frame a guard that shows code failing before the frame starts, which the shell page has no need of", () => {
    const frame = pageHtml("frame.html", CONFIG);
    expect(frame).toContain('addEventListener("error"');
    expect(frame.indexOf("<script>")).toBeLessThan(frame.indexOf('<script type="module"'));
    expect(pageHtml("index.html", CONFIG)).not.toContain('addEventListener("error"');
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

describe("a catalogue's plugins", () => {
  const plugin: ForgebookPlugin = {
    apiVersion: 1,
    id: "acme",
    frame: "@acme/plugin/frame",
    tabs: [{ id: "acme", label: "Acme", view: "@acme/plugin/tab", when: { parameter: "acme" } }],
    docBlocks: [{ fence: "acme", view: "@acme/plugin/block" }]
  };
  const listed: ResolvedConfig = { ...CONFIG, plugins: [plugin] };

  it("adds nothing to either page for a catalogue that lists none", () => {
    expect(shellEntry(CONFIG)).not.toContain("plugins");
    expect(frameEntry(CONFIG)).not.toContain("plugin");
  });

  it("adds nothing to a page a plugin has nothing for", () => {
    const switchesOnly: ResolvedConfig = {
      ...CONFIG,
      plugins: [{ apiVersion: 1, id: "acme", switches: [] }]
    };
    expect(shellEntry(switchesOnly)).toBe(shellEntry(CONFIG));
    expect(frameEntry(switchesOnly)).toBe(frameEntry(CONFIG));
  });

  it("loads a tab's view only when it opens: a dynamic import of the module it names", () => {
    const entry = shellEntry(listed);
    expect(entry).toContain('load: () => import("@acme/plugin/tab")');
    expect(entry).toContain('when: {"parameter":"acme"}');
    expect(entry).not.toMatch(/^import .*@acme\/plugin/m);
  });

  it("loads a docs block's view only when a page draws it", () => {
    const entry = shellEntry(listed);
    expect(entry).toContain('{ fence: "acme", load: () => import("@acme/plugin/block") }');
  });

  it("picks the frame module of the catalogue's framework", () => {
    const byFramework: ResolvedConfig = {
      ...CONFIG,
      plugins: [{ ...plugin, frame: { [STUB_FRAMEWORK.name]: "@acme/plugin/stub-frame" } }]
    };
    expect(frameEntry(byFramework)).toContain(
      'import { frame as pluginFrame0 } from "@acme/plugin/stub-frame";'
    );
  });

  it("keeps a plugin's frame module out of the shell, and its tabs out of the frame", () => {
    expect(shellEntry(listed)).not.toContain("@acme/plugin/frame");
    expect(frameEntry(listed)).not.toContain("@acme/plugin/tab");
  });

  it("hands the frame each plugin's frame module, by its id", () => {
    const entry = frameEntry(listed);
    expect(entry).toContain('import { frame as pluginFrame0 } from "@acme/plugin/frame";');
    expect(entry).toContain('plugins: [{ id: "acme", create: pluginFrame0 }],');
  });

  it("writes what a configuration names as text, whatever it holds", () => {
    const entry = shellEntry({
      ...CONFIG,
      plugins: [{ ...plugin, tabs: [{ id: "acme", label: 'A "quoted" name', view: "@acme/tab" }] }]
    });
    expect(entry).toContain('label: "A \\"quoted\\" name"');
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
