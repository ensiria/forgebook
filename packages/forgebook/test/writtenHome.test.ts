/**
 * Tests for the written home and the blocks between the plugin and the shell: the home's module, the shapes the shell
 * checks, the values and links it fills, and what tools and agents get of the home.
 *
 * @module
 */
import { join } from "node:path";

import type { DocPageIndex, StorySource } from "@forgebook/story-format/source";
import { describe, expect, it } from "vitest";

import { pagesText, pageText } from "../bin/forgebook/agentText.ts";
import {
  filledHtml,
  filledText,
  isDocPage,
  isHomeDocument,
  linkedHref,
  type PageValues,
  valueMark
} from "../src/docPages.ts";
import { NO_PREVIEW } from "../src/frame/storyModule.ts";
import { storyTree } from "../src/storyTree.ts";
import { isPageDocument, isPagesDocument } from "../src/vite/agentApi.ts";
import { homeModule } from "../src/vite/docPagesModule.ts";
import { HOME_PAGE_ID, pageAnswer, pagesDocument } from "../src/vite/docPagesRoute.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** Where the catalogue is served in these tests. */
const PAGES = { page: "http://localhost:5173/", frame: "http://localhost:5173/frame.html" };

/** The fixture app's folder and its written home. */
const APP_DIR = join(KIT_DIR, "..", "app");

/** The fixture app's written home. */
const HOME = join(APP_DIR, "forgebook.home.md");

/** Values as the shell would give them. */
const VALUES: PageValues = { title: "Kit <UI>", components: "3", stories: "9", libraries: "1", pages: "2" };

describe("the shapes the shell checks", () => {
  it("takes nested blocks, and refuses a container whose children are not blocks", () => {
    const aside = { kind: "aside", tone: "tip", children: [{ kind: "story", id: "a" }] };
    expect(isDocPage({ blocks: [aside], headings: [], assets: [] })).toBe(true);
    const tabs = { kind: "tabs", tabs: [{ label: "npm", children: [{ kind: "text", html: "" }] }] };
    expect(isDocPage({ blocks: [tabs, { kind: "steps", steps: [[aside]] }], headings: [], assets: [] })).toBe(
      true
    );
    expect(isDocPage({ blocks: [{ ...aside, tone: "loud" }], headings: [], assets: [] })).toBe(false);
    expect(isDocPage({ blocks: [{ ...aside, children: [{ kind: "x" }] }], headings: [], assets: [] })).toBe(
      false
    );
  });

  it("takes the written home's module, and refuses one without its notes", () => {
    const home = { blocks: [{ kind: "home", piece: "recent" }], stories: [], notes: [], assets: [] };
    expect(isHomeDocument(home)).toBe(true);
    expect(isHomeDocument({ ...home, title: "Hi" })).toBe(true);
    expect(isHomeDocument({ ...home, notes: undefined })).toBe(false);
    expect(isHomeDocument({ ...home, blocks: [{ kind: "home", piece: "everything" }] })).toBe(false);
  });
});

describe("values and links", () => {
  it("writes the values in a page's HTML, escaped, and in its plain texts", () => {
    expect(filledHtml(`<p>${valueMark("title")} has ${valueMark("components")}</p>`, VALUES)).toBe(
      "<p>Kit &#60;UI&#62; has 3</p>"
    );
    expect(filledText("{{ stories }} stories, {{unknown}}", VALUES)).toBe("9 stories, {{unknown}}");
  });

  it("opens a card's page in the reader's view, and leaves any other address as written", () => {
    const pageHref = (slug: string, anchor: string | undefined): string =>
      `?page=kit:${slug}${anchor ? `#${anchor}` : ""}`;
    expect(linkedHref("forgebook-page:colour#red", pageHref)).toBe("?page=kit:colour#red");
    expect(linkedHref("https://example.com", pageHref)).toBe("https://example.com");
  });
});

describe("the home's module", () => {
  it("gives the shell the home's blocks, its problems and its images, and its Markdown on a dev server", () => {
    const watched: string[] = [];
    const code = homeModule(HOME, (file) => watched.push(file), true);
    expect(code).toContain('"kind":"home","piece":"recent"');
    expect(code).toContain('"notes":[]');
    expect(code).toContain("export const text =");
    expect(watched).toContain(HOME);
    expect(homeModule(HOME, () => undefined, false)).not.toContain("export const text");
  });
});

describe("for agents", () => {
  /** A source with one page and one story. */
  const source: StorySource = {
    id: "kit",
    name: "Kit",
    files: [
      {
        index: {
          "./a.stories.tsx": {
            title: "Inputs/Select",
            stories: [{ exportName: "Overview" }]
          }
        },
        stories: {},
        docs: {},
        code: {},
        pages: {}
      }
    ],
    docs: [
      {
        index: {
          "./a.md": { title: "Start", stories: [], components: [], links: [] } satisfies DocPageIndex
        },
        pages: {}
      }
    ],
    sheets: { required: [], theme: [], restyled: [] }
  };
  const tree = storyTree([source]);
  const config = { title: "Fixture", home: HOME, dir: APP_DIR };
  const home = {
    file: "forgebook.home.md",
    index: {
      title: undefined,
      description: "Our kit.",
      stories: ["kit:inputs-select--overview"],
      components: [],
      sources: ["kit", "gone"],
      notes: ["line 3, column 1: `:::warn` is not a block Forgebook knows"]
    },
    text: "Text."
  };

  it("lists the written home first, with its address, and its problems with the index's", () => {
    const document = pagesDocument("Fixture", tree, PAGES, "theme=dark", home);
    expect(isPagesDocument(document)).toBe(true);
    expect(document.home).toEqual({
      id: HOME_PAGE_ID,
      title: "Fixture",
      source: "",
      file: "forgebook.home.md",
      description: "Our kit.",
      stories: ["kit:inputs-select--overview"],
      components: [],
      links: { address: "http://localhost:5173/?theme=dark" }
    });
    expect(document.problems).toEqual([
      "Home: forgebook.home.md: line 3, column 1: `:::warn` is not a block Forgebook knows",
      'Home: forgebook.home.md: it names the library "gone", which the catalogue does not have'
    ]);
    expect(pagesText(document, { color: false, unicode: false, width: 120 }).split("\n")[2]).toContain(
      "home"
    );
    expect(pagesDocument("Fixture", tree, PAGES, "")).not.toHaveProperty("home");
  });

  it("reads the written home as the page `home`, and says so when the catalogue has none", async () => {
    const context = {
      tree,
      loaded: { sources: [source], preview: NO_PREVIEW },
      pages: PAGES,
      view: "",
      params: new URLSearchParams({ id: HOME_PAGE_ID })
    };
    const { status, body } = await pageAnswer({ ...context, config });
    expect(status).toBe(200);
    expect(isPageDocument(body)).toBe(true);
    expect(body).toMatchObject({
      page: { id: "home", links: { address: "http://localhost:5173/" } },
      problems: []
    });
    expect(isPageDocument(body) ? pageText(body) : "").toContain("::recent");
    const none = await pageAnswer({ ...context, config: { ...config, home: undefined } });
    expect(none.status).toBe(404);
  });
});
