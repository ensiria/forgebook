/**
 * Tests for a docs page read from its Markdown: its front matter, what the index lists, and its blocks.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { compiledDocPage, docPageIndex, frontMatterOf } from "../src/vite/docPageMarkdown.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** A page's file, for the addresses relative to it. */
const FILE = "/kit/docs/guides/theming.md";

/** The index of a text, every file a page. */
const indexOf = (text: string): ReturnType<typeof docPageIndex> => docPageIndex(FILE, text, () => "");

/** A page's text around a body. */
const withFront = (body: string): string => `---\ntitle: T\n---\n${body}`;

describe("frontMatterOf", () => {
  it("reads the three keys, quoted or not, and leaves the body", () => {
    const read = frontMatterOf(
      "---\ntitle: \"Guides/Theming\"\norder: 2\ndescription: 'A: b'\n---\n\n# Body"
    );
    expect(read).toMatchObject({ title: "Guides/Theming", order: 2, description: "A: b", notes: [] });
    expect(read.body.trim()).toBe("# Body");
  });

  it("takes a file without one as all body, a byte-order mark and Windows lines included", () => {
    expect(frontMatterOf("# Title\n").title).toBeUndefined();
    expect(frontMatterOf("﻿---\r\ntitle: T\r\n---\r\nBody").title).toBe("T");
  });

  it("reports what it cannot read instead of dropping a page from its place", () => {
    expect(frontMatterOf("---\ntitel: T\n---\n").notes).toEqual([
      'its front matter has a line it does not read: "titel: T"'
    ]);
    expect(frontMatterOf("---\norder: first\n---\n").notes).toEqual(['its order "first" is not a number']);
    expect(frontMatterOf("---\ntitle: T\n").notes).toEqual(["its front matter never ends"]);
  });
});

describe("docPageIndex", () => {
  it("titles a page by its front matter, its opening heading, then its file", () => {
    expect(indexOf("---\ntitle: Own\n---\n# Heading").title).toBe("Own");
    expect(indexOf("\n# Heading\n\nText").title).toBe("Heading");
    expect(docPageIndex("/kit/docs/getting-started.md", "Text").title).toBe("Getting started");
  });

  it("lists the stories and the tables a page shows, in its order", () => {
    const index = indexOf(withFront("```story a:b--c\n```\n\n```props a:b\n```\n\n```story a:b--d\n```\n"));
    expect(index.stories).toEqual(["a:b--c", "a:b--d"]);
    expect(index.components).toEqual(["a:b"]);
    expect(index.notes).toBeUndefined();
  });

  it("reports a block that would not be drawn", () => {
    expect(indexOf(withFront("```story\n```\n")).notes).toEqual(["a `story` block names no id"]);
    expect(indexOf(withFront("- item\n\n  ```story a:b--c\n  ```\n")).notes).toEqual([
      "a `story a:b--c` block inside a list or a quote is not drawn"
    ]);
  });

  it("reports a link to a file that is not there, and an image that is no file of its package", () => {
    const text = withFront("[a](./other.md) [b](https://example.com/x.md) ![c](./missing.png)");
    expect(docPageIndex(FILE, text, () => undefined).notes).toEqual([
      'it links to "./other.md", which is not there',
      'its image "./missing.png" is not a file of its package'
    ]);
  });

  it("lists the slugs of the pages it links to, for the tree to check", () => {
    const text = withFront("[a](./colour.md#red) [b](?component=kit:x)");
    expect(docPageIndex(FILE, text, () => "---\ntitle: Guides/Colour\n---\n").links).toEqual([
      "guides-colour"
    ]);
  });

  it("refuses an image outside its package, a folder, and survives a stray percent sign", () => {
    const file = join(KIT_DIR, "docs/guides/theming.md");
    const notes = (body: string): readonly string[] | undefined => docPageIndex(file, withFront(body)).notes;
    expect(notes("![a](../../../../package.json)")).toEqual([
      'its image "../../../../package.json" is not a file of its package'
    ]);
    expect(notes("![a](./)")).toHaveLength(1);
    expect(notes("![a](./50%.png)")).toHaveLength(1);
    expect(notes("[a](./100%.md)")).toHaveLength(1);
    expect(compiledDocPage(file, withFront("![a](../../../../package.json)")).images).toEqual([]);
  });
});

describe("compiledDocPage", () => {
  /** Compiles a body with no other file around. */
  const compiled = (body: string): ReturnType<typeof compiledDocPage> =>
    compiledDocPage(FILE, withFront(body), () => undefined);

  it("splits the page at its top-level fences, in order", () => {
    const { blocks } = compiled(
      "One.\n\n```story a:b--c\n```\n\nTwo.\n\n```tsx\nconst a = 1;\n```\n\n```props a:b\n```"
    );
    expect(blocks.map((block) => block.kind)).toEqual(["text", "story", "text", "code", "props"]);
    expect(blocks[1]).toEqual({ kind: "story", id: "a:b--c" });
    expect(blocks[3]).toMatchObject({ text: "const a = 1;", language: "tsx" });
    expect(blocks[3]).toHaveProperty("html", expect.stringContaining("forgebook-hl-keyword"));
  });

  it("leaves the opening title to the page's header, and a code comment alone", () => {
    expect(compiled("# Title\n\nText").blocks).toHaveLength(1);
    expect(JSON.stringify(compiled("# Title\n\nText").blocks)).not.toContain("<h1");
    expect(compiled("```sh\n# install\n```").blocks[0]).toMatchObject({ text: "# install" });
  });

  it("gives each heading an anchor as GitHub does, and only h2 and h3 to the contents", () => {
    const { headings, blocks } = compiled(
      "## Light & dark\n\n### `Code` here\n\n#### Deep\n\n## Light & dark"
    );
    expect(headings).toEqual([
      { depth: 2, anchor: "light-dark", text: "Light & dark" },
      { depth: 3, anchor: "code-here", text: "Code here" },
      { depth: 2, anchor: "light-dark-1", text: "Light & dark" }
    ]);
    expect(blocks[0]).toHaveProperty("html", expect.stringContaining('<h2 id="doc-light-dark">'));
    expect(blocks[0]).toHaveProperty("html", expect.stringContaining('href="#light-dark-1"'));
  });

  it("keeps a heading's letters whatever the language, and never an empty anchor", () => {
    expect(compiled("## Città\n\n## ???").headings.map((heading) => heading.anchor)).toEqual([
      "città",
      "section"
    ]);
  });

  it("never gives two headings one anchor, whatever they are called", () => {
    const { headings } = compiled("## Tokens\n\n## Tokens\n\n## Tokens 1");
    expect(headings.map((heading) => heading.anchor)).toEqual(["tokens", "tokens-1", "tokens-1-1"]);
  });

  it("names a heading in its words alone, without its marks or its HTML", () => {
    expect(compiled("## Hello <b>x</b> **y**").headings[0]?.text).toBe("Hello x y");
  });

  it("never nests a link in a heading's own link", () => {
    const { blocks } = compiled("## See [the guide](https://example.com)");
    expect(blocks[0]).toHaveProperty("html", expect.not.stringContaining("example.com"));
  });

  it("names another page by the slug of its title, keeping the fragment", () => {
    const page = compiledDocPage(
      FILE,
      withFront("[a](./colour.md#red)"),
      () => "---\ntitle: Guides/Colour\n---\n"
    );
    expect(page.blocks[0]).toHaveProperty(
      "html",
      expect.stringContaining('href="forgebook-page:guides-colour#red"')
    );
  });

  it("opens another site in a new tab, and leaves the catalogue's own addresses alone", () => {
    const html = JSON.stringify(compiled("[a](https://example.com) [b](?component=kit:x) [c](#here)").blocks);
    expect(html).toContain('target=\\"_blank\\" rel=\\"noreferrer\\"');
    expect(html).toContain('href=\\"?component=kit:x\\">');
    expect(html).toContain('href=\\"#here\\">');
  });

  it("lists a page's images and names them by their place", () => {
    const page = compiledDocPage(join(KIT_DIR, "docs/guides/theming.md"), withFront("![m](../../logo.svg)"));
    expect(page.images).toEqual([join(KIT_DIR, "logo.svg")]);
    expect(page.blocks[0]).toHaveProperty("html", expect.stringContaining('src="forgebook-asset:0"'));
  });

  it("keeps the Markdown for tools, without the front matter", () => {
    expect(compiled("Text\n").text).toBe("Text");
  });
});
