/**
 * Tests for a component's page text: the documentation file beside its story file, as HTML, without its title and
 * the sections drawn from the types.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { componentPage, markdownHtml, pageMarkdown } from "../src/vite/componentPage.ts";
import { pageFileOf } from "../src/vite/pageFile.ts";
import { KIT_DIR } from "./fixturePaths.ts";

const KIT = join(KIT_DIR, "src");

describe("component pages", () => {
  it("finds the documentation file by the component's name in kebab case", () => {
    expect(pageFileOf("/kit/src/icon-tile/IconTile.stories.tsx")).toBe("/kit/src/icon-tile/icon-tile.md");
  });

  it("leaves out the title and the Props section, keeping the rest", () => {
    expect(pageMarkdown("# Name\n\nIntro.\n\n## Props\n\n| a |\n\n## Accessibility\n\nKeys.")).toBe(
      "Intro.\n\n## Accessibility\n\nKeys."
    );
  });

  it("turns the file into HTML, tables and coloured code included", () => {
    const page = componentPage(join(KIT, "Select.stories.tsx"));
    expect(page?.html).toContain("<p>Lets the user pick one value");
    expect(page?.html).toContain("<h2>Accessibility</h2>");
    expect(page?.html).toContain("<table>");
    expect(page?.html).toContain(
      '<code class="language-tsx"><span class="forgebook-hl-keyword">import</span>'
    );
    expect(page?.html).not.toContain("written by hand");
  });

  it("answers none for a component without a documentation file", () => {
    expect(componentPage(join(KIT, "Page.stories.tsx"))).toBeUndefined();
  });

  it("turns a source's introduction into HTML without its title, its sections one level down, Props kept", () => {
    expect(markdownHtml("# Kit\n\nIntro.\n\n## Props\n\nKept.\n\n### Detail")).toBe(
      "<p>Intro.</p>\n<h3>Props</h3>\n<p>Kept.</p>\n<h4>Detail</h4>\n"
    );
  });
});
