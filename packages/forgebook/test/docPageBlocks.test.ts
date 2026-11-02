/**
 * Tests for a docs page's blocks: what each directive and alert becomes, what a page or the written home may hold, the
 * values it names, and each mistake reported with its place while the rest still draws.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { DocBlock } from "../src/docPages.ts";
import { compiledDocPage, compiledHome, docPageIndex, homeIndex } from "../src/vite/docPageMarkdown.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** A page's file, for the addresses relative to it. */
const FILE = "/kit/docs/guides/theming.md";

/** A page's text around a body, its body starting on line 4. */
const withFront = (body: string): string => `---\ntitle: T\n---\n${body}`;

/** A body's blocks, no other file around. */
const blocksOf = (body: string): readonly DocBlock[] =>
  compiledDocPage(FILE, withFront(body), () => undefined).blocks;

/** A body's notes, every linked file a page. */
const notesOf = (body: string): readonly string[] =>
  docPageIndex(FILE, withFront(body), () => "").notes ?? [];

/** A block's kind and its children's, as a test compares them. */
const kinds = (blocks: readonly DocBlock[]): unknown[] =>
  blocks.map((block) => {
    switch (block.kind) {
      case "aside":
      case "cards":
      case "card":
        return { [block.kind]: kinds(block.children) };
      case "tabs":
        return { tabs: block.tabs.map((tab) => ({ [tab.label]: kinds(tab.children) })) };
      case "steps":
        return { steps: block.steps.map(kinds) };
      default:
        return block.kind;
    }
  });

describe("the blocks of a page", () => {
  it("draws an aside with its tone, its title and what it holds, a story included", () => {
    const blocks = blocksOf(":::tip[Before you start]\nText.\n\n```story a:b--c\n```\n:::");
    expect(blocks).toEqual([
      {
        kind: "aside",
        tone: "tip",
        title: "Before you start",
        children: [
          { kind: "text", html: "<p>Text.</p>\n" },
          { kind: "story", id: "a:b--c" }
        ]
      }
    ]);
  });

  it("gives each GitHub alert the tone its colour says", () => {
    const alerts = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"].map((kind) => `> [!${kind}]\n> Text.`);
    const tones = blocksOf(alerts.join("\n\n")).map((block) =>
      block.kind === "aside" ? block.tone : block.kind
    );
    expect(tones).toEqual(["note", "tip", "important", "caution", "danger"]);
  });

  it("draws tabs, steps and cards with what each holds", () => {
    const body = [
      '::::tabs{sync="pm"}',
      ":::tab[npm]",
      "```sh\nnpm i\n```",
      ":::",
      ":::tab[pnpm]",
      "Text.",
      ":::",
      "::::",
      "",
      ":::steps",
      "1. One.",
      "",
      "   ```story a:b--c",
      "   ```",
      "2. Two.",
      ":::",
      "",
      "::::cards",
      ":::card[First]",
      "Text.",
      ":::",
      '::link-card[Out]{href="https://example.com" description="Elsewhere."}',
      "::::"
    ].join("\n");
    const blocks = blocksOf(body);
    expect(kinds(blocks)).toEqual([
      { tabs: [{ npm: ["code"] }, { pnpm: ["text"] }] },
      { steps: [["text", "story"], ["text"]] },
      { cards: [{ card: ["text"] }, "link-card"] }
    ]);
    expect(blocks[0]).toMatchObject({ sync: "pm" });
    expect(blocks[2]).toMatchObject({
      children: [
        {},
        { kind: "link-card", title: "Out", href: "https://example.com", description: "Elsewhere." }
      ]
    });
    expect(notesOf(body)).toEqual([]);
  });

  it("lists the stories inside blocks for the index, and reports none in a step", () => {
    const index = docPageIndex(
      FILE,
      withFront(":::note\n```story a:b--c\n```\n:::\n\n:::steps\n1. One.\n\n   ```story a:b--d\n   ```\n:::")
    );
    expect(index.stories).toEqual(["a:b--c", "a:b--d"]);
    expect(index.notes).toBeUndefined();
  });

  it("links a card to another page by its file, and reports one that is not there", () => {
    const page = compiledDocPage(
      FILE,
      withFront('::link-card[Colour]{href="./colour.md#red"}'),
      () => "# Colour\n"
    );
    expect(page.blocks).toEqual([{ kind: "link-card", title: "Colour", href: "forgebook-page:colour#red" }]);
    expect(
      docPageIndex(FILE, withFront('::link-card[Gone]{href="./gone.md"}'), () => undefined).notes
    ).toEqual(['line 4, column 19: the card links to "./gone.md", which is not there']);
    expect(notesOf('::link-card[Odd]{href="odd.txt"}')[0]).toContain("is no page or address");
  });

  it("reports what a block cannot take, at its place, and still draws what it holds", () => {
    expect(notesOf(":::warn\nText.\n:::")).toEqual([
      "line 4, column 1: `:::warn` is not a block Forgebook knows: :::note, :::tip, :::important, :::caution, :::danger, :::tabs, :::tab, :::steps, :::cards, :::card; its content is drawn as it is"
    ]);
    expect(kinds(blocksOf(":::warn\nText.\n:::"))).toEqual(["text"]);
    expect(notesOf(':::note{icon="x"}\nText.\n:::')).toEqual([
      'line 4, column 9: `note` has no attribute "icon": it takes none'
    ]);
    expect(notesOf("::::tabs\nStray.\n:::tab\nText.\n:::\n::::")).toEqual([
      "line 5, column 1: only `:::tab` blocks go in `tabs` (line 4): this is left out",
      "line 6, column 1: a tab needs its label: `:::tab[npm]`"
    ]);
    expect(notesOf(":::steps\nNo list.\n:::")).toEqual([
      "line 4, column 1: `steps` holds one numbered list, each item a step: this one is drawn as it is"
    ]);
  });

  it("draws a leaf it does not know as a problem in place, and keeps the home's pieces to the home", () => {
    expect(blocksOf("::nothing")).toEqual([
      { kind: "problem", message: expect.stringMatching(/^line 4, column 1: `::nothing` is not a block/) }
    ]);
    expect(blocksOf("::families")).toEqual([
      { kind: "problem", message: "line 4, column 1: `::families` is drawn only on the catalogue's home" }
    ]);
  });

  it("reads the code fence's whole line", () => {
    expect(blocksOf('```ts title="a.ts" {1}\nconst a = 1;\n```')).toEqual([
      expect.objectContaining({
        kind: "code",
        title: "a.ts",
        language: "ts",
        html: expect.stringContaining("<mark")
      })
    ]);
    expect(notesOf("```ts {3}\nconst a = 1;\n```")).toEqual([
      "line 4, column 4: the code fence names line 3, and its code has 1"
    ]);
    expect(notesOf("```story a:b--c extra\n```")).toEqual([
      'line 4, column 1: a `story` block takes only an id, not "extra"'
    ]);
  });
});

describe("values", () => {
  it("writes the page's package version in, and leaves the others for the shell to fill", () => {
    const file = join(KIT_DIR, "docs/guides/theming.md");
    const [block] = compiledDocPage(file, withFront("v{{ version }}, {{components}} components")).blocks;
    expect(block).toHaveProperty(
      "html",
      expect.stringContaining('<span data-forgebook-value="components"></span>')
    );
    expect(docPageIndex(file, withFront("{{version}}")).notes).toEqual([
      "line 4, column 1: `{{version}}` has no version to show: its package.json has none"
    ]);
  });

  it("never reads a value inside code, and reports a name no page can use", () => {
    const blocks = blocksOf("`{{title}}`\n\n```md\n{{title}}\n```");
    expect(JSON.stringify(blocks)).not.toContain("data-forgebook-value");
    expect(notesOf("Hello {{name}}.")).toEqual([
      "line 4, column 7: `{{name}}` is not a value a page can show: title, version, components, stories, libraries or pages"
    ]);
    expect(notesOf(":::note[{{nope}}]\n:::")).toEqual([
      "line 4, column 9: `{{nope}}` is not a value a page can show"
    ]);
  });
});

describe("the written home", () => {
  /** The fixture app's folder, whose package has a version. */
  const Home = join(KIT_DIR, "..", "app", "forgebook.home.md");

  it("draws the home's pieces, its title and lead from the front matter, the version written in", () => {
    const text =
      '---\ntitle: Welcome to {{title}}\ndescription: "v{{version}}"\n---\n::recent[Back]\n\n::families{source="kit"}';
    const home = compiledHome(Home, text);
    expect(home.title).toBe("Welcome to {{title}}");
    expect(home.description).toBe("v0.0.0");
    expect(home.blocks).toEqual([
      { kind: "home", piece: "recent", label: "Back" },
      { kind: "home", piece: "families", source: "kit" }
    ]);
    expect(home.notes).toEqual([]);
  });

  it("takes its opening heading as its title, or none for the catalogue's", () => {
    expect(homeIndex(Home, "# Our system\n\nText.").title).toBe("Our system");
    expect(homeIndex(Home, "Text.").title).toBeUndefined();
  });

  it("lists the libraries its pieces name, and reports a piece's label or attribute it does not take", () => {
    const index = homeIndex(Home, '::libraries[No]{source="kit"}\n::recent{source="x"}');
    expect(index.sources).toEqual(["kit"]);
    expect(index.notes).toEqual([
      "line 1, column 1: `::libraries` takes no label: each library has its own heading",
      'line 2, column 10: `recent` has no attribute "source": it takes none'
    ]);
  });

  it("reads the fixture's own home without a problem", () => {
    expect(homeIndex(Home, readFileSync(Home, "utf8")).notes).toEqual([]);
  });
});
