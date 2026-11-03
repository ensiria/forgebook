/**
 * Tests for the pages the plugin generates from a configuration: their HTML, their entries, the data they read and
 * the project's own stories' source.
 *
 * @module
 */
import { win32 } from "node:path";

import { describe, expect, it } from "vitest";

import { SAME_ORIGIN } from "../src/frameOrigins.ts";
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
  sources: ["@acme/ui/stories"],
  switches: undefined,
  languages: [{ id: "it", label: "Italiano" }],
  previews: ["/catalogue/forgebook.preview.tsx"],
  head: '<link rel="stylesheet" href="/fonts.css" />',
  shell: { themeCss: "", frameCss: "", hasBranding: true, styleSheets: [], problems: [] },
  tokens: [],
  watch: [],
  lists: {},
  hasMocks: false,
  hasPlayTools: false,
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
    expect(entry).toContain(`import { codeOf } from ${JSON.stringify(STUB_FRAMEWORK.pages.code)};`);
    expect(entry).toContain("    frames: config.frames,");
    expect(frameEntry(CONFIG)).toContain("    frames: config.frames,");
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

  it("hands the shell how the framework's stories take an address's texts, when it says", () => {
    expect(shellEntry(CONFIG)).not.toContain("addressTexts");
    const plain = { ...CONFIG, framework: { ...STUB_FRAMEWORK, addressTexts: "plain" as const } };
    expect(shellEntry(plain)).toContain('    addressTexts: "plain",');
  });

  it("mounts the framework's frame with the previews, the catalogue's last", () => {
    const entry = frameEntry(CONFIG);
    expect(entry).toContain(`import { mountFrame } from ${JSON.stringify(STUB_FRAMEWORK.pages.frame)};`);
    expect(entry).toContain('import * as preview0 from "/catalogue/forgebook.preview.tsx";');
    expect(entry).toContain("previews: [preview0]");
  });

  it("takes its previews' edits on a dev server, and none without previews", () => {
    const entry = frameEntry(CONFIG);
    expect(entry).toContain('import.meta.hot.accept(["/catalogue/forgebook.preview.tsx"], (next) =>');
    expect(entry).toContain('"forgebook:previews"');
    expect(frameEntry({ ...CONFIG, previews: [] })).not.toContain("import.meta.hot");
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
    expect(entry).toContain('import("@testing-library/dom"), import("@testing-library/user-event")');
    expect(entry).not.toMatch(/^import .*@testing-library/m);
  });

  it("hands the pages the configuration's data, and the own stories as one source named after the catalogue", () => {
    expect(configModule(CONFIG, { kind: "ports", catalogue: 5173, frames: 5174 })).toBe(
      'export default {"title":"Acme <UI>","heights":"story-heights.json","languages":[{"id":"it","label":"Italiano"}],"lists":{},"frames":{"kind":"ports","catalogue":5173,"frames":5174}};'
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
    expect(entry).toContain('await Promise.all([import("msw/browser"), import("msw")]);');
    expect(entry).toContain("http: core.http, passthrough: core.passthrough");
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

  it("imports the catalogue's style sheet into the shell only", () => {
    const styled: ResolvedConfig = {
      ...CONFIG,
      shell: { ...CONFIG.shell, styleSheets: ["/catalogue/shell.css"] }
    };
    expect(shellEntry(styled)).toContain('import "/catalogue/shell.css";');
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
    expect(shellEntry(own)).toContain('from "C:/Users/ada/app/.forgebook-stories.ts";');
  });
});
