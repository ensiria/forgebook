/**
 * Tests for docs pages between the plugin and the shell: the modules, the tree, the search, the links the shell fills,
 * and what tools and agents get.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { DocPageIndex, StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { catalogueTools } from "../bin/forgebook/mcpTools.ts";
import { catalogueMarkdown } from "../bin/forgebook-docs/catalogueMarkdown.ts";
import { llmsText } from "../bin/forgebook-docs/llmsText.ts";
import { isDocPage, linkedHtml } from "../src/docPages.ts";
import { NO_PREVIEW } from "../src/frame/storyModule.ts";
import { findPage, pageGroups, pagesAbout } from "../src/pageTree.ts";
import { foundPages, searchWords } from "../src/shell/treeSearch.ts";
import { sourcePages } from "../src/sourceFiles.ts";
import { storyTree } from "../src/storyTree.ts";
import { storyAddressOf } from "../src/viewState.ts";
import { isPageDocument, isPagesDocument } from "../src/vite/agentApi.ts";
import type { AgentAnswer } from "../src/vite/agentRoutes.ts";
import {
  DOCS_PAGE_QUERY,
  docPageModule,
  docPagesModule,
  indexedDocPages
} from "../src/vite/docPagesModule.ts";
import { pageAnswer, pagesDocument } from "../src/vite/docPagesRoute.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** Where the catalogue is served in these tests. */
const PAGES = { page: "http://localhost:5173/", frame: "http://localhost:5173/frame.html" };

/** A source with one story and the given pages. */
const sourceWith = (index: Readonly<Record<string, DocPageIndex>>, id = "kit"): StorySource => ({
  id,
  name: id === "kit" ? "Kit" : "Other",
  files: [
    {
      index: { "./a.stories.tsx": { title: "Inputs/Select", stories: [{ exportName: "Overview" }] } },
      stories: {},
      docs: {},
      code: {},
      pages: {}
    }
  ],
  docs: [
    {
      index,
      pages: Object.fromEntries(
        Object.keys(index).map((key) => [
          key,
          async (): Promise<unknown> => ({
            blocks: [],
            headings: [{ depth: 2, anchor: "a", text: "A" }],
            assets: []
          })
        ])
      ),
      text: Object.fromEntries(Object.keys(index).map((key) => [key, async (): Promise<unknown> => "# Text"]))
    }
  ],
  sheets: { required: [], theme: [], restyled: [] }
});

/** A page of the index. */
const page = (title: string, order?: number): DocPageIndex => ({
  title,
  ...(order === undefined ? {} : { order }),
  stories: [],
  components: [],
  links: []
});

describe("the page tree", () => {
  it("orders the pages by order, then title, the unordered ones last, and places them by their titles", () => {
    const [source] = storyTree([
      sourceWith({
        "./z.md": page("Zebra"),
        "./b.md": page("Guides/Theming", 2),
        "./a.md": page("Start", 1),
        "./c.md": page("Apple")
      })
    ]).sources;
    expect(source?.pages.map((each) => each.id)).toEqual([
      "kit:start",
      "kit:guides-theming",
      "kit:apple",
      "kit:zebra"
    ]);
    expect(source?.pages[1]).toMatchObject({ name: "Theming", group: "Guides", slug: "guides-theming" });
  });

  it("keeps a source that has pages and no stories", () => {
    const source: StorySource = { ...sourceWith({ "./a.md": page("Start") }), files: [] };
    expect(storyTree([source]).sources.map((each) => each.id)).toEqual(["kit"]);
  });

  it("reports what a page gets wrong, and leaves a title taken twice or without a place out", () => {
    const tree = storyTree([
      sourceWith({
        "./a.md": {
          ...page("Start"),
          stories: ["kit:gone--x"],
          components: ["kit:gone"],
          links: ["gone"],
          notes: ["a note"]
        },
        "./b.md": page("Start"),
        "./c.md": page("Guides//Empty")
      })
    ]);
    expect(tree.problems).toEqual([
      'Kit: ./c.md: "Guides//Empty" has an empty segment',
      "Kit: ./a.md: a note",
      'Kit: ./b.md and ./a.md have the same title "Start"',
      'Kit: ./a.md shows the story "kit:gone--x": no such story',
      'Kit: ./a.md shows the component "kit:gone": no such component',
      'Kit: ./a.md links to "gone": no such page'
    ]);
    expect(tree.sources[0]?.pages).toHaveLength(1);
  });

  it("accepts a link across two groups of a source, and keeps titles in any language apart", () => {
    const one = sourceWith({ "./a.md": { ...page("主题"), links: ["обзор"] } });
    const two = sourceWith({ "./b.md": page("Обзор") });
    const tree = storyTree([{ ...one, docs: [...(one.docs ?? []), ...(two.docs ?? [])] }]);
    expect(tree.problems).toEqual([]);
    expect(tree.sources[0]?.pages.map((each) => each.id).sort()).toEqual(["kit:обзор", "kit:主题"]);
  });

  it("accepts a story of another source, by its whole id", () => {
    const tree = storyTree([
      sourceWith({ "./a.md": { ...page("Start"), stories: ["other:inputs-select--overview"] } }),
      sourceWith({}, "other")
    ]);
    expect(tree.problems).toEqual([]);
  });

  it("finds a page by its id", () => {
    const tree = storyTree([sourceWith({ "./a.md": page("Start") })]);
    expect(findPage(tree, "kit:start")?.page.file).toBe("./a.md");
    expect(findPage(tree, "kit:gone")).toBeUndefined();
  });

  it("finds the pages that show a component, by a story or by its table", () => {
    const tree = storyTree([
      sourceWith({
        "./a.md": { ...page("Stories"), stories: ["kit:select--overview"] },
        "./b.md": { ...page("Table"), components: ["kit:select"] },
        "./c.md": page("Other")
      })
    ]);
    const shown = pagesAbout(tree, "kit:select", ["kit:select--overview"]);
    expect(shown.map((each) => each.name)).toEqual(["Stories", "Table"]);
    expect(pagesAbout(tree, "kit:badge", [])).toEqual([]);
  });

  it("merges a source's groups of pages", () => {
    const one = sourceWith({ "./a.md": page("A") });
    const two = sourceWith({ "./b.md": page("B") });
    const merged = sourcePages({ ...one, docs: [...(one.docs ?? []), ...(two.docs ?? [])] });
    expect(Object.keys(merged.index)).toEqual(["./a.md", "./b.md"]);
    const { docs: _docs, ...withoutDocs } = one;
    expect(Object.keys(sourcePages(withoutDocs).index)).toEqual([]);
  });

  it("keeps the reading order under the headings: a group where its first page is", () => {
    const [source] = storyTree([
      sourceWith({
        "./a.md": page("Start", 1),
        "./b.md": page("Guides/One", 2),
        "./c.md": page("Middle", 3),
        "./d.md": page("Guides/Two", 4),
        "./e.md": page("End", 5)
      })
    ]).sources;
    expect(
      pageGroups(source?.pages ?? []).map((group) => [group.name, group.pages.map((each) => each.name)])
    ).toEqual([
      [undefined, ["Start"]],
      ["Guides", ["One", "Two"]],
      [undefined, ["Middle", "End"]]
    ]);
  });
});

describe("the search", () => {
  it("finds a page by its title or description, any case and accent", () => {
    const [source] = storyTree([
      sourceWith({
        "./a.md": { ...page("Guides/Thémes"), description: "Dark and light" },
        "./b.md": page("Other")
      })
    ]).sources;
    const pages = source?.pages ?? [];
    expect(foundPages(pages, searchWords("themes guides")).map((each) => each.name)).toEqual(["Thémes"]);
    expect(foundPages(pages, searchWords("dark")).map((each) => each.name)).toEqual(["Thémes"]);
    expect(foundPages(pages, [])).toHaveLength(2);
    expect(foundPages(pages, searchWords("nothing"))).toEqual([]);
  });
});

describe("linkedHtml", () => {
  /** A page's address. */
  const hrefOf = (slug: string, anchor: string | undefined): string =>
    `?page=kit:${slug}&theme=dark${anchor === undefined ? "" : `#${anchor}`}`;

  it("writes a link for the reader's view, escaped for the attribute", () => {
    expect(linkedHtml('<a href="forgebook-page:guides#red">x</a>', hrefOf, [])).toBe(
      '<a href="?page=kit:guides&amp;theme=dark#red">x</a>'
    );
  });

  it("writes an image's address, and none for a place the list does not have", () => {
    expect(linkedHtml('<img src="forgebook-asset:0"><img src="forgebook-asset:1">', hrefOf, ["/a.png"])).toBe(
      '<img src="/a.png"><img src="">'
    );
  });

  it("reads a fragment back, whatever the HTML escaped", () => {
    const seen: (string | undefined)[] = [];
    linkedHtml(
      '<a href="forgebook-page:a#citt%C3%A0"></a><a href="forgebook-page:b"></a>',
      (_slug, anchor) => {
        seen.push(anchor);
        return "";
      },
      []
    );
    expect(seen).toEqual(["città", undefined]);
  });
});

describe("isDocPage", () => {
  it("takes what the plugin answers, and refuses anything else", () => {
    expect(isDocPage({ blocks: [{ kind: "story", id: "a" }], headings: [], assets: [] })).toBe(true);
    expect(isDocPage({ blocks: [{ kind: "story" }], headings: [], assets: [] })).toBe(false);
    expect(isDocPage({ blocks: [], headings: [{ depth: 4, anchor: "a", text: "b" }], assets: [] })).toBe(
      false
    );
    expect(isDocPage({ blocks: [] })).toBe(false);
  });
});

describe("the modules", () => {
  it("indexes the fixture's pages, each with a loader, and the Markdown only on a dev server", () => {
    const watched: string[] = [];
    const code = docPagesModule(KIT_DIR, "docs/**/*.md", (file) => watched.push(file), true);
    expect(code).toContain(
      `"./docs/getting-started.md": () => import(${JSON.stringify(`${join(KIT_DIR, "docs/getting-started.md")}${DOCS_PAGE_QUERY}`)})`
    );
    expect(code).toContain("module.text");
    expect(new Set(watched).size).toBe(4);
    expect(docPagesModule(KIT_DIR, "docs/**/*.md", () => undefined, false)).not.toContain("module.text");
  });

  it("finds every link of the fixture's pages among its pages", () => {
    const pages = indexedDocPages(KIT_DIR, "docs/**/*.md", () => undefined);
    expect(pages.flatMap((each) => each.index.notes ?? [])).toEqual([]);
    expect(pages.find((each) => each.key === "./docs/getting-started.md")?.index.stories).toHaveLength(3);
  });

  it("imports a page's images, so Vite answers their addresses", () => {
    const file = join(KIT_DIR, "docs/guides/theming.md");
    const code = docPageModule(file, () => undefined, false);
    expect(code).toContain(`import asset0 from ${JSON.stringify(`${join(KIT_DIR, "logo.svg")}?url`)};`);
    expect(code).toContain("assets: [asset0]");
    expect(code).not.toContain("export const text");
    expect(readFileSync(file, "utf8")).toContain("logo.svg");
  });
});

describe("agents", () => {
  const source = sourceWith({ "./a.md": { ...page("Guides/Start", 1), description: "Begin here." } });
  const tree = storyTree([source]);
  const context = {
    tree,
    loaded: { sources: [source], preview: NO_PREVIEW },
    pages: PAGES,
    view: "theme=dark",
    params: new URLSearchParams({ id: "kit:guides-start" })
  };

  it("lists the pages with their ids and the addresses a person opens", () => {
    const document = pagesDocument("Kit", tree, PAGES, "theme=dark");
    expect(isPagesDocument(document)).toBe(true);
    expect(document.pages).toEqual([
      {
        id: "kit:guides-start",
        title: "Guides/Start",
        source: "kit",
        file: "./a.md",
        description: "Begin here.",
        stories: [],
        components: [],
        links: { address: "http://localhost:5173/?theme=dark&page=kit%3Aguides-start" }
      }
    ]);
  });

  it("gives a page to read, with its headings", async () => {
    const { status, body } = await pageAnswer(context);
    expect(status).toBe(200);
    expect(isPageDocument(body)).toBe(true);
    expect(body).toMatchObject({ text: "# Text", headings: [{ anchor: "a" }], problems: [] });
  });

  it("answers a page that does not exist with a 404, and one that fails with its problem", async () => {
    const missing = { ...context, params: new URLSearchParams({ id: "kit:gone" }) };
    expect(await pageAnswer(missing)).toEqual({ status: 404, body: { error: 'No page "kit:gone"' } });
    const broken: StorySource = {
      ...source,
      docs: [{ index: {}, pages: { "./a.md": () => Promise.reject(new Error("broken")) } }]
    };
    const { status, body } = await pageAnswer({
      ...context,
      loaded: { sources: [broken], preview: NO_PREVIEW }
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ text: "", problems: ["The page failed to load: broken"] });
  });

  it("leaves another kind of page out of a story's address", () => {
    expect(storyAddressOf(PAGES.page, "kit:a--b", "page=kit:c&theme=dark")).toBe(
      "http://localhost:5173/?theme=dark&story=kit%3Aa--b"
    );
  });

  describe("as tools", () => {
    const asked: string[] = [];
    const tools = catalogueTools({
      ask: async (route: string, params: URLSearchParams): Promise<AgentAnswer> => {
        asked.push(`${route}?${params.toString()}`);
        return { status: 200, body: pagesDocument("Kit", tree, PAGES, "") };
      },
      writeNew: () => Promise.reject(new Error("not asked in these tests")),
      check: async () => "unused",
      checkPage: async () => "unused",
      shot: async () => "unused"
    });
    const tool = (name: string): (typeof tools)[number] => {
      const found = tools.find((each) => each.name === name);
      if (found === undefined) throw new Error(`no tool ${name}`);
      return found;
    };

    it("lists a source's pages, as an agent calls it", async () => {
      const kept = await tool("list_pages").call({ source: "kit" });
      expect(kept.structured).toMatchObject({ pages: [{ id: "kit:guides-start" }] });
      const none = await tool("list_pages").call({ source: "other" });
      expect(none.structured).toMatchObject({ pages: [] });
    });

    it("asks for one page, whose id is required", async () => {
      await tool("get_page").call({ id: "kit:guides-start", view: "theme=dark" });
      expect(asked.at(-1)).toBe("page?id=kit%3Aguides-start&view=theme%3Ddark");
      expect(tool("get_page").inputSchema).toMatchObject({ required: ["id"] });
    });
  });
});

describe("CATALOG.md and llms.txt", () => {
  const pages = [
    { title: "Guides/Theming", file: "docs/theming.md", description: "How it follows the theme." },
    { title: "Plain", file: "docs/plain.md", description: undefined }
  ];
  const data = {
    packageName: "@acme/ui",
    description: undefined,
    sourceId: "acme",
    components: [],
    pages,
    modules: [],
    sassModules: [],
    styleSheets: []
  };

  it("lists a package's pages, each with its id", () => {
    expect(catalogueMarkdown(data, ["pages"])).toContain(
      "## Docs\n\n- **Guides/Theming** `docs/theming.md`: How it follows the theme · page: `acme:guides-theming`\n- **Plain** `docs/plain.md` · page: `acme:plain`\n"
    );
  });

  it("says nothing of pages for a package without any", () => {
    expect(catalogueMarkdown({ ...data, pages: [] }, ["pages"])).not.toContain("## Docs");
    const { pages: _pages, ...written } = data;
    expect(catalogueMarkdown(written, ["pages"])).not.toContain("## Docs");
  });

  it("links them from llms.txt", () => {
    const text = llmsText({
      packageName: "@acme/ui",
      description: undefined,
      catalogueFile: "CATALOG.md",
      pages
    });
    expect(text).toContain(
      "- [Guides/Theming](docs/theming.md): How it follows the theme.\n- [Plain](docs/plain.md)\n"
    );
  });
});
