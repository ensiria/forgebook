/**
 * Tests for the pages the plugin generates from a configuration: their HTML, their entries, the data they read and
 * the project's own stories' source.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import type { ResolvedConfig } from "../src/vite/configFile";
import { configModule, frameEntry, pageHtml, shellEntry, storiesSourceModule } from "../src/vite/pages";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework";

/** A resolved configuration with a logo, a preview, its own stories and a package's. */
const CONFIG: ResolvedConfig = {
  dir: "/catalogue",
  framework: STUB_FRAMEWORK,
  title: "Acme <UI>",
  logo: "/catalogue/logo.svg",
  heights: "story-heights.json",
  stories: ["src/**/*.stories.tsx"],
  sources: ["@acme/ui/stories"],
  switches: undefined,
  languages: [{ id: "it", label: "Italiano" }],
  previews: ["/catalogue/forgebook.preview.tsx"],
  head: '<link rel="stylesheet" href="/fonts.css" />',
  watch: []
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

  it("mounts the framework's frame with the previews, the catalogue's last", () => {
    const entry = frameEntry(CONFIG);
    expect(entry).toContain(`import { mountFrame } from ${JSON.stringify(STUB_FRAMEWORK.pages.frame)};`);
    expect(entry).toContain('import * as preview0 from "/catalogue/forgebook.preview.tsx";');
    expect(entry).toContain("previews: [preview0]");
  });

  it("hands the pages the configuration's data, and the own stories as one source named after the catalogue", () => {
    expect(configModule(CONFIG)).toBe(
      'export default {"title":"Acme <UI>","heights":"story-heights.json","languages":[{"id":"it","label":"Italiano"}]};'
    );
    const source = storiesSourceModule(CONFIG);
    expect(source).toContain('import files0 from "./src/**/*.stories.tsx?forgebook-files";');
    expect(source).toContain('name: "Acme <UI>",');
  });
});
