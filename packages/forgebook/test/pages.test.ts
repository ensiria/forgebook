/**
 * Tests for the pages the plugin generates from a configuration: their HTML, their entries, the data they read and
 * the project's own stories' source.
 *
 * @module
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";

import { createServer } from "vite";
import { describe, expect, it } from "vitest";

import { codeLiteral } from "../src/codeLiteral.ts";
import { SAME_ORIGIN } from "../src/frameOrigins.ts";
import type { ForgebookPlugin } from "../src/plugin.ts";
import type { ResolvedConfig } from "../src/vite/configFile.ts";
import { ISOLATED_FRAMES } from "../src/vite/framesConfig.ts";
import {
  configModule,
  frameEntry,
  pageHtml,
  pageModuleOf,
  pageModulePath,
  shellEntry,
  storiesSourceModule
} from "../src/vite/pages.ts";
import { vitePathsOf } from "../src/vite/vitePaths.ts";
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
  home: undefined,
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
  frames: ISOLATED_FRAMES,
  build: { readableNames: false }
};

describe("the generated pages", () => {
  it("writes what a frame needs of the theme into the frame only, and nothing without it", () => {
    const themed = { ...CONFIG, shell: { ...CONFIG.shell, frameCss: ".forgebook-frame-error{--x:1}" } };
    expect(pageHtml("frame.html", themed, SAME_ORIGIN)).toContain(
      "<style>.forgebook-frame-error{--x:1}</style>"
    );
    expect(pageHtml("index.html", themed, SAME_ORIGIN)).not.toContain("forgebook-frame-error");
    expect(pageHtml("frame.html", CONFIG, SAME_ORIGIN)).not.toContain("<style>");
  });

  it("tells the shell to leave Forgebook's mark out only when the branding is off", () => {
    expect(shellEntry(CONFIG)).not.toContain("hasBranding");
    const plain = { ...CONFIG, shell: { ...CONFIG.shell, hasBranding: false } };
    expect(shellEntry(plain)).toContain("hasBranding: false,");
  });

  it("titles the shell after the catalogue, escaped, and gives only the frame the head's tags", () => {
    expect(pageHtml("index.html", CONFIG, SAME_ORIGIN)).toContain("<title>Acme &#60;UI&#62;</title>");
    expect(pageHtml("index.html", CONFIG, SAME_ORIGIN)).toContain(
      '<script type="module" src="/.forgebook-shell.ts">'
    );
    expect(pageHtml("index.html", CONFIG, SAME_ORIGIN)).not.toContain("fonts.css");
    expect(pageHtml("frame.html", CONFIG, SAME_ORIGIN)).toContain(
      '<link rel="stylesheet" href="/fonts.css" />'
    );
  });

  it("gives the frame a guard that shows code failing before the frame starts, which the shell page has no need of", () => {
    const frame = pageHtml("frame.html", CONFIG, SAME_ORIGIN);
    expect(frame).toContain('addEventListener("error"');
    expect(frame.indexOf("<script>")).toBeLessThan(frame.indexOf('<script type="module"'));
    expect(pageHtml("index.html", CONFIG, SAME_ORIGIN)).not.toContain('addEventListener("error"');
  });

  it("mounts the shell with the data, the logo, the own stories before the packages' and the code writer", () => {
    const entry = shellEntry(CONFIG);
    expect(entry).toContain(`import { codeOf } from ${codeLiteral(STUB_FRAMEWORK.pages.code)};`);
    expect(entry).toContain("    frames: config.frames,");
    expect(frameEntry(CONFIG)).toContain("    frames: config.frames,");
    expect(entry).toContain(`import logo from ${codeLiteral("/catalogue/logo.svg?url")};`);
    expect(entry).toContain(
      `import { source as source0 } from ${codeLiteral("/catalogue/.forgebook-stories.ts")};`
    );
    expect(entry).toContain(`import { source as source1 } from ${codeLiteral("@acme/ui/stories")};`);
    expect(entry).toContain("sources: [source0, source1],");
  });

  it("makes the project's own source from its docs pages alone, and lists them", () => {
    const docsOnly = { ...CONFIG, stories: [], docs: ["./docs/**/*.md"] };
    expect(shellEntry(docsOnly)).toContain(
      `import { source as source0 } from ${codeLiteral("/catalogue/.forgebook-stories.ts")};`
    );
    const source = storiesSourceModule(docsOnly);
    expect(source).toContain(
      `import docs from ${codeLiteral("virtual:forgebook-docs-pages:/catalogue::0::docs/**/*.md")};`
    );
    expect(source).toContain("  docs: [docs],");
    expect(storiesSourceModule(CONFIG)).not.toContain("docs:");
  });

  it("hands the shell how the framework's stories take an address's texts, when it says", () => {
    expect(shellEntry(CONFIG)).not.toContain("addressTexts");
    const plain = { ...CONFIG, framework: { ...STUB_FRAMEWORK, addressTexts: "plain" as const } };
    expect(shellEntry(plain)).toContain('    addressTexts: "plain",');
  });

  it("mounts the framework's frame with the previews, the catalogue's last", () => {
    const entry = frameEntry(CONFIG);
    expect(entry).toContain(`import { mountFrame } from ${codeLiteral(STUB_FRAMEWORK.pages.frame)};`);
    expect(entry).toContain(`import * as preview0 from ${codeLiteral("/catalogue/forgebook.preview.tsx")};`);
    expect(entry).toContain("previews: [preview0]");
  });

  it("takes its previews' edits on a dev server, and none without previews", () => {
    const entry = frameEntry(CONFIG);
    // as plain JSON: Vite reads the accepted files' text without decoding its escapes
    expect(entry).toContain('import.meta.hot.accept(["/catalogue/forgebook.preview.tsx"], (next) =>');
    expect(entry).toContain('"forgebook:previews"');
    expect(frameEntry({ ...CONFIG, previews: [] })).not.toContain("import.meta.hot");
  });

  it("names its previews' files so that Vite's dev server finds them", async () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-previews-hot-"));
    const preview = join(dir, "forgebook.preview.ts");
    writeFileSync(preview, "export const parameters = {};\n");
    // the entry's preview imports and its hot block alone: the rest imports modules only a catalogue serves; served as
    // JavaScript, so Vite reads the text as written, with no transform that would decode its escapes first
    const entry = frameEntry({ ...CONFIG, previews: [preview] })
      .split("\n")
      .filter(
        (line, at, lines) =>
          line.startsWith("import * as preview") || at >= lines.indexOf("if (import.meta.hot)")
      )
      .join("\n");
    const server = await createServer({
      root: dir,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: { port: 0 } },
      plugins: [
        {
          name: "entry",
          resolveId: (id: string): string | undefined => (id === "/entry.js" ? id : undefined),
          load: (id: string): string | undefined => (id === "/entry.js" ? entry : undefined)
        }
      ]
    });
    try {
      // Vite reads the accepted files as written, and fails on one it cannot resolve
      const transformed = await server.transformRequest("/entry.js");
      expect(transformed?.code).toContain("import.meta.hot.accept(");
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hands the frame axe's address when there is one, with what it imports", () => {
    expect(frameEntry(CONFIG)).not.toContain("axeUrl");
    const entry = frameEntry(CONFIG, { imports: ['import axeUrl from "/axe.min.js?url";'], value: "axeUrl" });
    expect(entry).toContain('import axeUrl from "/axe.min.js?url";');
    expect(entry).toContain("    axeUrl: axeUrl,");
  });

  it("loads Testing Library for the plays only when the project installs it, and only on the first play", () => {
    expect(frameEntry(CONFIG)).not.toContain("@testing-library");
    const entry = frameEntry({ ...CONFIG, hasPlayTools: true });
    expect(entry).toContain(
      `import(${codeLiteral("@testing-library/dom")}), import(${codeLiteral("@testing-library/user-event")})`
    );
    expect(entry).not.toMatch(/^import .*@testing-library/m);
  });

  it("hands the pages the configuration's data, and the own stories as one source named after the catalogue", () => {
    expect(configModule(CONFIG, { kind: "ports", catalogue: 5173, frames: 5174 }, true)).toBe(
      'export default {"title":"Acme \\u003cUI\\u003e","heights":"story-heights.json","storyGlobs":["src\\u002f**\\u002f*.stories.tsx"],"languages":[{"id":"it","label":"Italiano"}],"lists":{},"frames":{"kind":"ports","catalogue":5173,"frames":5174}};'
    );
    expect(configModule(CONFIG, { kind: "ports", catalogue: 5173, frames: 5174 }, false)).not.toContain(
      "storyGlobs"
    );
    const source = storiesSourceModule(CONFIG);
    expect(source).toContain(
      `import files from ${codeLiteral("virtual:forgebook-files:/catalogue::0::src/**/*.stories.tsx")};`
    );
    expect(source).toContain("  files: [files],");
    expect(source).toContain(`name: ${codeLiteral("Acme <UI>")},`);
  });

  it("imports the own stories as one group, so a `!` pattern leaves out what every other pattern lists", () => {
    const stories = [
      "src/**/*.stories.tsx",
      "!src/**/legacy/*",
      "../kit/*.stories.tsx",
      "!../kit/Old.stories.tsx"
    ];
    const source = storiesSourceModule({ ...CONFIG, stories });
    expect(source.match(/^import /gm)).toHaveLength(1);
    expect(source).toContain(
      `import files from ${codeLiteral("virtual:forgebook-files:/catalogue::0::src/**/*.stories.tsx::!0::src/**/legacy/*::1::kit/*.stories.tsx::!1::kit/Old.stories.tsx")};`
    );
    expect(storiesSourceModule({ ...CONFIG, stories: [] })).toContain("  files: [],");
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
    expect(entry).toContain(`load: () => import(${codeLiteral("@acme/plugin/tab")})`);
    expect(entry).toContain('when: {"parameter":"acme"}');
    const staticImports = entry.split("\n").filter((line) => line.startsWith("import "));
    expect(staticImports.join("\n")).not.toContain("plugin");
  });

  it("gives the shell the code that draws the plugins' views only with plugins that have views, loaded on first use", () => {
    expect(shellEntry(CONFIG)).not.toContain(codeLiteral("forgebook/shell/plugin-hosts"));
    const entry = shellEntry(listed);
    expect(entry).toContain(
      `pluginHosts: () => import(${codeLiteral("forgebook/shell/plugin-hosts")}).then((module) => module.pluginHosts),`
    );
    expect(entry).not.toMatch(/^import .*plugin-hosts/m);
  });

  it("loads a docs block's view only when a page draws it", () => {
    const entry = shellEntry(listed);
    expect(entry).toContain(`{ fence: "acme", load: () => import(${codeLiteral("@acme/plugin/block")}) }`);
  });

  it("picks the frame module of the catalogue's framework", () => {
    const byFramework: ResolvedConfig = {
      ...CONFIG,
      plugins: [{ ...plugin, frame: { [STUB_FRAMEWORK.name]: "@acme/plugin/stub-frame" } }]
    };
    expect(frameEntry(byFramework)).toContain(
      `import { frame as pluginFrame0 } from ${codeLiteral("@acme/plugin/stub-frame")};`
    );
  });

  it("keeps a plugin's frame module out of the shell, and its tabs out of the frame", () => {
    expect(shellEntry(listed)).not.toContain(codeLiteral("@acme/plugin/frame"));
    expect(frameEntry(listed)).not.toContain(codeLiteral("@acme/plugin/tab"));
  });

  it("hands the frame each plugin's frame module, by its id", () => {
    const entry = frameEntry(listed);
    expect(entry).toContain(`import { frame as pluginFrame0 } from ${codeLiteral("@acme/plugin/frame")};`);
    expect(entry).toContain('plugins: [{ id: "acme", create: pluginFrame0 }],');
  });

  it("writes what a configuration names as text, whatever it holds", () => {
    const entry = shellEntry({
      ...CONFIG,
      plugins: [{ ...plugin, tabs: [{ id: "acme", label: 'A "quoted" name', view: "@acme/tab" }] }]
    });
    expect(entry).toContain('label: "A \\"quoted\\" name"');
  });

  it("gives the shell a written home only when there is one, loaded on first use", () => {
    expect(shellEntry(CONFIG)).not.toContain("home");
    expect(shellEntry(CONFIG)).not.toContain('from "react"');
    const entry = shellEntry({ ...CONFIG, home: "/catalogue/forgebook.home.md" });
    expect(entry).not.toContain('from "react"');
    expect(entry).toContain(`import(${codeLiteral("forgebook/shell/home")})`);
    expect(entry).toContain(
      `module.writtenHome(() => import(${codeLiteral("/catalogue/forgebook.home.md?forgebook-home")})`
    );
  });
});

describe("a catalogue's theme", () => {
  const themed: ResolvedConfig = {
    ...CONFIG,
    shell: { ...CONFIG.shell, themeCss: ":root{--forgebook-font-sans:Inter}" }
  };

  it("goes in the shell's page, with no script", () => {
    expect(pageHtml("index.html", themed, SAME_ORIGIN)).toContain(
      "<style>:root{--forgebook-font-sans:Inter}</style>"
    );
  });

  it("stays out of the frames, which belong to the stories", () => {
    expect(pageHtml("frame.html", themed, SAME_ORIGIN)).not.toContain("--forgebook-font-sans");
  });

  it("writes nothing for a catalogue with no theme", () => {
    expect(pageHtml("index.html", CONFIG, SAME_ORIGIN)).not.toContain("<style>");
  });

  it("gives the shell the tokens' module to load on first use, only when the catalogue or a source may have tokens", () => {
    expect(shellEntry({ ...CONFIG, sources: [] })).not.toContain("loadTokens");
    expect(shellEntry(CONFIG)).toContain("loadTokens");
    const entry = shellEntry({
      ...CONFIG,
      sources: [],
      tokens: [{ path: "/catalogue/tokens.json", mode: undefined }]
    });
    expect(entry).toContain(`loadTokens: () => import(${codeLiteral("virtual:forgebook/tokens")})`);
    expect(entry).not.toContain(`from ${codeLiteral("virtual:forgebook/tokens")}`);
  });

  it("imports the catalogue's style sheet into the shell only", () => {
    const styled: ResolvedConfig = {
      ...CONFIG,
      shell: { ...CONFIG.shell, styleSheets: ["/catalogue/shell.css"] }
    };
    expect(shellEntry(styled)).toContain(`import ${codeLiteral("/catalogue/shell.css")};`);
    expect(frameEntry(styled)).not.toContain("shell.css");
  });
});

describe("the generated modules' paths on Windows", () => {
  /** Windows' path functions, answering in Vite's form. */
  const Windows = vitePathsOf(win32);
  /** A catalogue's folder as Node names it on Windows. */
  const Dir = "C:\\Users\\ada\\app";

  it("names each module with forward slashes, as Vite's ids are", () => {
    expect(pageModulePath(Dir, ".forgebook-shell.ts", Windows)).toBe("C:/Users/ada/app/.forgebook-shell.ts");
    expect(pageModulePath("C:/Users/ada/app", ".forgebook-stories.ts", Windows)).toBe(
      "C:/Users/ada/app/.forgebook-stories.ts"
    );
  });

  it("recognises its modules by Vite's id, whose slashes differ from Node's path of the folder", () => {
    expect(pageModuleOf("C:/Users/ada/app/.forgebook-shell.ts", Dir, Windows)).toEqual({
      kind: "entry",
      page: "index.html"
    });
    expect(pageModuleOf("C:/Users/ada/app/.forgebook-frame.ts", Dir, Windows)).toEqual({
      kind: "entry",
      page: "frame.html"
    });
    expect(pageModuleOf("C:/Users/ada/app/.forgebook-stories.ts", Dir, Windows)).toEqual({
      kind: "stories-source"
    });
    expect(pageModuleOf("C:/Users/ada/app/.forgebook-agent.ts", Dir, Windows)).toEqual({
      kind: "agent-sources"
    });
  });

  it("recognises a page by Node's path too, as the build's inputs may arrive", () => {
    expect(pageModuleOf("C:\\Users\\ada\\app\\frame.html", "C:/Users/ada/app", Windows)).toEqual({
      kind: "page",
      page: "frame.html"
    });
  });

  it("names nothing else, in the folder or out of it", () => {
    expect(pageModuleOf("C:/Users/ada/app/src/main.ts", Dir, Windows)).toBeUndefined();
    expect(pageModuleOf("C:/Users/ada/kit/.forgebook-shell.ts", Dir, Windows)).toBeUndefined();
    expect(pageModuleOf("react", Dir, Windows)).toBeUndefined();
  });

  it("imports the project's own stories by their module's path in Vite's form", () => {
    const own = { ...CONFIG, dir: "C:/Users/ada/app" };
    expect(shellEntry(own)).toContain(`from ${codeLiteral("C:/Users/ada/app/.forgebook-stories.ts")};`);
  });
});
