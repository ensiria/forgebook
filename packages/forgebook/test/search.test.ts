/**
 * Tests for the search across the catalogue: what it finds, how it ranks, what a result says of why it is there, and that
 * it reads words as `forgebook find` reads them.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { propAnchor } from "../src/docAnchors.ts";
import type { TreePage } from "../src/pageTree.ts";
import { type SearchAnswer, type SearchHit, searchables, searchCatalogue } from "../src/search.ts";
import { isSearchIndex, mergedSearchIndex, type SearchIndex } from "../src/searchIndex.ts";
import { markedText, snippetOf } from "../src/searchMarks.ts";
import { sourceSearchLoaders } from "../src/sourceFiles.ts";
import type { StoryTree, TreeComponent, TreeSource, TreeStory } from "../src/storyTree.ts";
import { findComponents } from "../src/vite/findComponent.ts";

/** A story. */
const story = (name: string, description?: string): TreeStory => ({
  id: `kit:${name.toLowerCase()}`,
  file: "./x.stories.tsx",
  name,
  exportName: name,
  controls: "all",
  group: undefined,
  description,
  isMain: false,
  isTouch: false,
  isLogic: false,
  height: undefined,
  device: undefined,
  design: undefined,
  tags: [],
  hasPlay: false,
  requiredFirst: undefined
});

/** A component. */
const component = (
  title: string,
  keywords: readonly string[] = [],
  stories: readonly TreeStory[] = []
): TreeComponent => ({
  id: `kit:${title.toLowerCase()}`,
  name: title.split("/").at(-1) ?? title,
  title,
  file: `./${title}.stories.tsx`,
  files: [`./${title}.stories.tsx`],
  design: undefined,
  propGroups: [],
  requiredFirst: undefined,
  tags: [],
  stories,
  unlisted: [],
  alsoIn: [],
  related: [],
  keywords
});

/** A docs page. */
const THEMING: TreePage = {
  id: "kit:guides-theming",
  slug: "guides-theming",
  name: "Theming",
  title: "Guides/Theming",
  group: "Guides",
  file: "./theming.md",
  description: "How the theme reaches a story.",
  stories: [],
  components: [],
  links: []
};

/** The catalogue searched. */
const SOURCE: TreeSource = {
  id: "kit",
  name: "Kit",
  logo: undefined,
  background: undefined,
  families: [
    {
      name: "Inputs",
      groups: [
        {
          name: undefined,
          aliases: [],
          components: [
            component("Inputs/Select", ["picker"], [story("Danger", "A failed choice.")]),
            component("Inputs/OptionCards", ["radio tile group"]),
            component("Inputs/Dialog")
          ]
        }
      ]
    }
  ],
  pages: [THEMING]
};

/** The tree searched. */
const TREE: StoryTree = { sources: [SOURCE], problems: [] };

/** The index searched. */
const INDEX: SearchIndex = {
  components: {
    "./Inputs/Select.stories.tsx": {
      lead: "One value picked from a list.",
      props: [
        { name: "disabled", text: "Whether it is `off`." },
        { name: "onValueChange", text: "Called with the new value.", isEvent: true },
        { name: "label", text: "The group's name.", part: "SelectGroup" }
      ],
      sections: [{ anchor: "accessibility", heading: "Accessibility", text: "The list reads as a listbox." }]
    }
  },
  pages: {
    "./theming.md": [
      { text: "Opening words of the page." },
      { anchor: "tokens", heading: "Tokens", text: "The reader picks the shell's appearance on purpose." }
    ]
  }
};

/** What a query finds with the index there. */
const search = (query: string): SearchAnswer =>
  searchCatalogue(searchables(TREE, new Map([["kit", INDEX]])), query, { results: 10, hits: 3 });

/** A marked text as plain text. */
const plain = (pieces: readonly { readonly text: string }[]): string =>
  pieces.map((piece) => piece.text).join("");

/** The first hit of the first result. */
const firstHit = (query: string): SearchHit | undefined => search(query).results[0]?.hits[0];

describe("searchCatalogue", () => {
  it("finds a prop by its name and goes to its row", () => {
    const hit = firstHit("disabled");
    expect(hit).toMatchObject({
      kind: "prop",
      target: { kind: "component", id: "kit:inputs-select", anchor: "prop.disabled" }
    });
    expect(plain(hit?.snippet ?? [])).toBe("Whether it is off.");
  });

  it("finds a camel-case prop by any way of writing it", () => {
    for (const query of ["onValueChange", "onvaluechange", "onvalue", "value change"]) {
      expect(search(query).results[0]?.hits[0]).toMatchObject({
        kind: "event",
        target: { anchor: "prop.onValueChange" }
      });
    }
  });

  it("goes to a part's prop by its own anchor", () => {
    expect(firstHit("group's name")?.target).toEqual({
      kind: "component",
      id: "kit:inputs-select",
      anchor: propAnchor("label", "SelectGroup")
    });
  });

  it("finds a sentence of a docs page and goes to its heading", () => {
    const answer = search("the reader picks the shell");
    expect(answer.results.map((result) => result.target.id)).toEqual(["kit:guides-theming"]);
    expect(answer.results[0]?.hits[0]).toMatchObject({
      kind: "text",
      target: { kind: "page", id: "kit:guides-theming", anchor: "tokens" }
    });
  });

  it("goes to the page's top for what comes before the first heading", () => {
    expect(firstHit("opening words")?.target).toEqual({ kind: "page", id: "kit:guides-theming" });
  });

  it("finds a heading, of a page and of a component's documentation", () => {
    expect(firstHit("tokens")).toMatchObject({ kind: "heading", target: { anchor: "tokens" } });
    expect(firstHit("accessibility")).toMatchObject({
      kind: "heading",
      target: { kind: "component", anchor: "accessibility" }
    });
  });

  it("finds a story by its name and its description, and goes to it", () => {
    expect(firstHit("failed")).toMatchObject({ kind: "story", target: { kind: "story", id: "kit:danger" } });
  });

  it("answers one thing when its words are in different places of it", () => {
    const answer = search("select danger");
    expect(answer.results.map((result) => result.target.id)).toEqual(["kit:inputs-select"]);
    expect(answer.results[0]).toMatchObject({ matched: ["select", "danger"], missed: [] });
  });

  it("finds names from the tree alone, before the index arrives", () => {
    const answer = searchCatalogue(searchables(TREE, new Map()), "select", { results: 10, hits: 3 });
    expect(answer.results[0]?.target.id).toBe("kit:inputs-select");
    expect(searchCatalogue(searchables(TREE, new Map()), "disabled", { results: 10, hits: 3 }).total).toBe(0);
  });

  it("reads the tree once: the index arriving after it adds its own, in the same order as read together", () => {
    const before = searchables(TREE, new Map());
    const after = searchables(TREE, new Map([["kit", INDEX]]));
    const fresh = searchables(
      { sources: [{ ...SOURCE, families: structuredClone(SOURCE.families) }], problems: [] },
      new Map([["kit", INDEX]])
    );
    const kindsOf = (all: typeof after): readonly string[] =>
      all.flatMap((each) => each.fields.map((field) => `${field.kind}:${field.label ?? field.text}`));
    expect(kindsOf(after)).toEqual(kindsOf(fresh));
    expect(kindsOf(after).length).toBeGreaterThan(kindsOf(before).length);
    expect(searchCatalogue(after, "disabled", { results: 10, hits: 3 }).total).toBe(1);
    // a sentence of several words is still found where it stands, read only when such a query asks
    expect(searchCatalogue(after, "listbox", { results: 10, hits: 3 }).total).toBe(1);
    expect(
      searchCatalogue(after, "reads as a listbox", { results: 10, hits: 3 }).results[0]?.hits[0]?.kind
    ).toBe("text");
  });

  it("says why a result's name is there", () => {
    expect(search("select").results[0]?.reasons).toEqual([{ place: "name" }]);
    expect(search("tile").results[0]?.reasons).toEqual([{ place: "keyword" }]);
    expect(search("inputs").results[0]?.reasons).toEqual([{ place: "title" }]);
    expect(search("modal").results[0]?.reasons).toEqual([{ place: "name", means: "dialog" }]);
  });

  it("leaves out what holds little of a query something holds whole", () => {
    const answer = search("list reader");
    expect(answer.results).toHaveLength(2);
    expect(answer.results[0]).toMatchObject({ matched: ["list"], missed: ["reader"] });
    expect(search("disabled nosuchword").results[0]).toMatchObject({
      matched: ["disabled"],
      missed: ["nosuchword"]
    });
    const whole = search("list reads as a listbox");
    expect(whole.results.map((result) => result.target.id)).toEqual(["kit:inputs-select"]);
  });

  it("counts what it leaves out and limits the hits", () => {
    const answer = searchCatalogue(searchables(TREE, new Map([["kit", INDEX]])), "the", {
      results: 1,
      hits: 1
    });
    expect(answer.total).toBeGreaterThan(answer.results.length);
    expect(answer.results[0]?.hits).toHaveLength(1);
    expect(answer.results[0]?.hitCount).toBeGreaterThan(1);
  });

  it("reads a pasted page no further than its limit, each word once", () => {
    const answer = search(`disabled ${"a ".repeat(50_000)}`);
    expect(answer.results[0]?.target.id).toBe("kit:inputs-select");
    expect(answer.results[0]?.matched.filter((word) => word === "a").length).toBeLessThan(2);
  });

  it("puts a name that is the whole query above a heading that holds it", () => {
    const tree: StoryTree = {
      sources: [
        {
          ...SOURCE,
          families: [],
          pages: [
            { ...THEMING, id: "kit:a", name: "Other page", file: "./a.md" },
            { ...THEMING, id: "kit:b", name: "Getting started", file: "./b.md" }
          ]
        }
      ],
      problems: []
    };
    const index: SearchIndex = {
      pages: { "./a.md": [{ anchor: "x", heading: "Getting started quickly", text: "" }] }
    };
    const answer = searchCatalogue(searchables(tree, new Map([["kit", index]])), "getting started", {
      results: 2,
      hits: 1
    });
    expect(answer.results[0]?.target.id).toBe("kit:b");
  });

  it("finds nothing for no words", () => {
    expect(search("  ").results).toEqual([]);
  });

  it("ranks components as `forgebook find` does", () => {
    const findable = SOURCE.families[0]?.groups[0]?.components.map((each) => ({
      id: each.title,
      title: each.title,
      keywords: each.keywords,
      stories: []
    }));
    for (const query of ["select", "modal", "radio tile group", "picker"]) {
      const found = findComponents(findable ?? [], query)[0];
      const searched = searchCatalogue(searchables(TREE, new Map()), query, { results: 1, hits: 0 });
      expect(plain(searched.results[0]?.name ?? [])).toBe(found?.title.split("/").at(-1));
      // a sentence found whole counts more here: a person pastes one, and `find` is asked in words
      if (!query.includes(" ")) expect(searched.results[0]?.score).toBe(found?.score);
    }
  });
});

describe("markedText and snippetOf", () => {
  /** A query of words. */
  const words = (...list: readonly string[]): { words: readonly string[]; phrase: undefined } => ({
    words: list,
    phrase: undefined
  });

  it("marks a camel-case name word by word, and a word's start as far as it was typed", () => {
    expect(markedText("onValueChange", words("value"))).toEqual([
      { text: "on", isMatch: false },
      { text: "Value", isMatch: true },
      { text: "Change", isMatch: false }
    ]);
    expect(markedText("disabled", words("dis"))).toEqual([
      { text: "dis", isMatch: true },
      { text: "abled", isMatch: false }
    ]);
  });

  it("marks a synonym where it stands, and ignores accents", () => {
    expect(markedText("A Dialog", words("modal"))[1]).toEqual({ text: "Dialog", isMatch: true });
    expect(markedText("Città", words("citta"))).toEqual([{ text: "Città", isMatch: true }]);
  });

  it("marks a sentence as one stretch, and leaves short words' starts alone", () => {
    expect(markedText("Say the reader here", { words: ["the", "reader"], phrase: "the reader" })).toEqual([
      { text: "Say ", isMatch: false },
      { text: "the reader", isMatch: true },
      { text: " here", isMatch: false }
    ]);
    expect(markedText("theme", words("the", "reader"))).toEqual([{ text: "theme", isMatch: false }]);
  });

  it("marks a whole name by what was typed of it", () => {
    expect(markedText("onValueChange", words("onvalue"))[0]).toEqual({ text: "onValue", isMatch: true });
  });

  it("marks a sentence between words only, and never twice over the same text", () => {
    const query = { words: ["art", "button"], phrase: "art button" };
    expect(markedText("smart buttons", query).some((piece) => piece.text === "art button")).toBe(false);
    const overlapping = markedText("a b a b a", { words: ["a", "b"], phrase: "a b a" });
    expect(overlapping.map((piece) => piece.text).join("")).toBe("a b a b a");
  });

  it("marks an accent written apart", () => {
    expect(markedText("cafe\u0301 bar", words("cafe"))[0]).toEqual({ text: "cafe\u0301", isMatch: true });
  });

  it("shows a sentence longer than a snippet whole", () => {
    const sentence = "word ".repeat(40).trim();
    const shown = snippetOf(`start ${sentence} end ${"pad ".repeat(60)}`, {
      words: ["word"],
      phrase: sentence
    });
    expect(shown.some((piece) => piece.isMatch && piece.text === sentence)).toBe(true);
  });

  it("gives a long text around its match, cut between words", () => {
    const text = `${"lorem ipsum ".repeat(40)}needle ${"dolor sit ".repeat(40)}`;
    const snippet = snippetOf(text, words("needle"));
    expect(snippet.some((piece) => piece.isMatch && piece.text === "needle")).toBe(true);
    expect(snippet[0]?.text).toBe("…");
    expect(snippet.at(-1)?.text).toBe("…");
    expect(plain(snippet).length).toBeLessThan(120);
    expect(plain(snippet)).toMatch(/^…lorem|^…ipsum/);
  });

  it("prefers the place that shows most of the query", () => {
    const text = `first ${"pad ".repeat(60)}first second ${"pad ".repeat(60)}`;
    const shown = plain(snippetOf(text, words("first", "second")));
    expect(shown).toContain("first second");
  });

  it("gives a long text's start when nothing in it matched", () => {
    const shown = plain(snippetOf("word ".repeat(100), words("label")));
    expect(shown.startsWith("word")).toBe(true);
    expect(shown.endsWith("…")).toBe(true);
  });
});

describe("the search index", () => {
  it("checks what a loader gave", () => {
    expect(isSearchIndex(INDEX)).toBe(true);
    expect(isSearchIndex({})).toBe(true);
    expect(isSearchIndex({ components: { a: { props: [{ name: "x" }] } } })).toBe(false);
    expect(isSearchIndex({ pages: { a: [{ heading: "x" }] } })).toBe(false);
    expect(isSearchIndex({ problems: [1] })).toBe(false);
    expect(isSearchIndex(null)).toBe(false);
  });

  it("merges a source's groups", () => {
    const merged = mergedSearchIndex([
      { components: { a: {} }, problems: ["one"] },
      { pages: { b: [] }, problems: ["two"] }
    ]);
    expect(merged).toEqual({ components: { a: {} }, pages: { b: [] }, problems: ["one", "two"] });
  });

  it("never lets a prop's anchor meet a heading's", () => {
    expect(propAnchor("value")).toBe("prop.value");
    expect(propAnchor("label", "Group")).toBe("prop.Group.label");
  });

  it("finds a source's loaders, in its story files and its pages", () => {
    const load = async (): Promise<unknown> => ({});
    const group = { index: {}, stories: {}, docs: {}, code: {}, pages: {} };
    const pages = { index: {}, pages: {} };
    const source = {
      id: "a",
      name: "A",
      sheets: { required: [], theme: [], restyled: [] },
      files: [{ ...group, search: load }, group],
      docs: [{ ...pages, search: load }, pages]
    };
    expect(sourceSearchLoaders(source)).toEqual([load, load]);
  });
});
