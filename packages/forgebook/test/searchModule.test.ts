/**
 * Tests for the search index's modules: what they keep of the catalogue, and that a heading's anchor is the one the page
 * draws.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isSearchIndex, type SearchIndex } from "../src/searchIndex.ts";
import { componentPage } from "../src/vite/componentPage.ts";
import { compiledDocPage } from "../src/vite/docPageMarkdown.ts";
import { docPagesModule } from "../src/vite/docPagesModule.ts";
import type { DocsResult } from "../src/vite/docsExtractor.ts";
import { inlineJson } from "../src/vite/packedModule.ts";
import {
  blockSections,
  htmlSections,
  pagesSearchModule,
  storySearchModule
} from "../src/vite/searchModule.ts";
import { storyFilesModule } from "../src/vite/storyFilesModule.ts";
import { KIT_DIR } from "./fixturePaths.ts";

/** A module's default export, read back. */
const indexOf = (code: string): SearchIndex => {
  const value: unknown = JSON.parse(code.replace(/^export default /, "").replace(/;$/, ""));
  if (!isSearchIndex(value)) throw new Error("not an index");
  return value;
};

/** Reads no component. */
const noDocs = async (): Promise<DocsResult> => ({ docs: { name: null } });

/** Whether a value is what a framework reads of a story file: these tests write its docs by hand. */
const isRead = (value: unknown): value is Exclude<DocsResult, string> =>
  typeof value === "object" && value !== null && "docs" in value;

/** A prop's docs. */
const prop = (name: string, description: string, kind: "text" | "event" = "text"): unknown => ({
  name,
  kind,
  type: "string",
  description,
  isRequired: false
});

describe("htmlSections", () => {
  it("splits at the headings that carry an anchor, and reads plain text", () => {
    const html =
      '<p>Lead &amp; <em>more</em>.</p><h2 id="doc-one"><a href="#one">One</a></h2><p>A &lt;b&gt;.</p><h3 id="doc-two">Two</h3>';
    expect(htmlSections(html)).toEqual([
      { text: "Lead & more." },
      { anchor: "one", heading: "One", text: "A <b>." },
      { anchor: "two", heading: "Two", text: "" }
    ]);
  });

  it("joins what inline tags write apart, as coloured code is", () => {
    const html = '<pre><span class="k">&lt;</span><span>Select</span> <span>options</span></pre><p>a</p>';
    expect(htmlSections(html)).toEqual([{ text: "<Select options a" }]);
  });

  it("reads through comments, attributes and hand-written entities", () => {
    const html = '<!-- a > secret --><p title="a > b">caf&#233;&nbsp;bar</p>';
    expect(htmlSections(html)).toEqual([{ text: "café bar" }]);
  });

  it("leaves out what nobody reads, and an empty start", () => {
    expect(htmlSections('<style>.a { color: red }</style><h2 id="doc-a">A</h2>')).toEqual([
      { anchor: "a", heading: "A", text: "" }
    ]);
  });
});

describe("blockSections", () => {
  it("keeps a heading's text together across its code and its live stories", () => {
    const sections = blockSections([
      { kind: "text", html: '<h2 id="doc-a">A</h2><p>Before.</p>' },
      { kind: "story", id: "kit:a--b" },
      { kind: "text", html: "<p>After.</p>" },
      { kind: "code", text: "const  a = 1;\n", html: "" },
      { kind: "text", html: '<h2 id="doc-b">B</h2>' }
    ]);
    expect(sections).toEqual([
      { anchor: "a", heading: "A", text: "Before. After. const a = 1;" },
      { anchor: "b", heading: "B", text: "" }
    ]);
  });

  it("starts with what comes before the first heading", () => {
    expect(blockSections([{ kind: "code", text: "x", html: "" }])).toEqual([{ text: "x" }]);
  });
});

describe("the modules", () => {
  it("offers a group's index as a loader, whatever else is turned off", () => {
    const files = storyFilesModule(KIT_DIR, "./src/*.stories.tsx", () => undefined, {
      hasUsage: false,
      hasReach: false
    });
    expect(files).toContain("search: () => import(");
    expect(files).toContain("virtual:forgebook-search:");
    const pages = docPagesModule(KIT_DIR, "docs/**/*.md", () => undefined, false);
    expect(pages).toContain("virtual:forgebook-search-pages:");
  });

  it("indexes every docs page, with the anchors the page draws", () => {
    const watched: string[] = [];
    const index = indexOf(
      pagesSearchModule(KIT_DIR, "docs/**/*.md", (file) => watched.push(file), inlineJson)
    );
    const key = "./docs/guides/theming.md";
    const sections = index.pages?.[key] ?? [];
    expect(watched).toContain(join(KIT_DIR, "docs/guides/theming.md"));
    expect(sections.some((section) => section.text.includes("The reader picks the shell's"))).toBe(true);
    const { headings } = compiledDocPage(join(KIT_DIR, key), "## One\n\n## One\n");
    expect(headings.map((heading) => heading.anchor)).toEqual(["one", "one-1"]);
    const anchors = sections.flatMap((section) => section.anchor ?? []);
    expect(anchors).toContain("light-and-dark-1");
  });

  it("reads a component's lead, props, events and parts", async () => {
    const docs = {
      name: "Select",
      summary: "What it is.",
      description: "What it is.",
      props: [prop("value", "The value."), prop("onChange", "Called.", "event")],
      parts: [],
      subcomponents: [{ name: "Group", description: "A group.", props: [prop("label", "Its name.")] }],
      guidance: { useWhen: ["Few options."], deprecated: "Old." }
    };
    const code = await storySearchModule(
      KIT_DIR,
      "./src/Select.stories.tsx",
      () => undefined,
      async (): Promise<DocsResult> => {
        const read: unknown = { docs, file: "/x/Select.tsx", sources: ["/x/Select.tsx"] };
        return isRead(read) ? read : "unreadable";
      },
      true,
      inlineJson
    );
    const entry = indexOf(code).components?.["./src/Select.stories.tsx"];
    expect(entry?.lead).toBe("What it is. Few options. Old.");
    expect(entry?.props).toEqual([
      { name: "value", text: "The value." },
      { name: "onChange", text: "Called.", isEvent: true },
      { name: "Group", text: "A group." },
      { name: "label", text: "Its name.", part: "Group" }
    ]);
  });

  it("leaves out a part's props when the page draws no reference for the component", async () => {
    const docs = {
      name: "Select",
      summary: "",
      description: "",
      props: [],
      parts: [],
      subcomponents: [{ name: "Group", description: "A group.", props: [prop("label", "Its name.")] }]
    };
    const code = await storySearchModule(
      KIT_DIR,
      "./src/Select.stories.tsx",
      () => undefined,
      async (): Promise<DocsResult> => {
        const read: unknown = { docs, file: "/x/Select.tsx", sources: [] };
        return isRead(read) ? read : "unreadable";
      },
      true,
      inlineJson
    );
    expect(indexOf(code).components?.["./src/Select.stories.tsx"]?.props).toBeUndefined();
  });

  it("reads a hook's parameters, not its props, as its page shows them", async () => {
    const docs = {
      name: "useUndo",
      summary: "",
      description: "",
      props: [prop("hidden", "Not shown.")],
      parts: [],
      subcomponents: [],
      signature: {
        typeParameters: [],
        parameters: [
          { name: "initial", type: "T", description: "The first value.", isOptional: false, isRest: false }
        ],
        returns: "void",
        returnsDescription: ""
      }
    };
    const code = await storySearchModule(
      KIT_DIR,
      "./src/useUndo.stories.tsx",
      () => undefined,
      async (): Promise<DocsResult> => {
        const read: unknown = { docs, file: "/x/useUndo.ts", sources: [] };
        return isRead(read) ? read : "unreadable";
      },
      true,
      inlineJson
    );
    expect(indexOf(code).components?.["./src/useUndo.stories.tsx"]?.props).toEqual([
      { name: "initial", text: "The first value." }
    ]);
  });

  it("indexes a component's documentation file, with its headings' anchors", async () => {
    const code = await storySearchModule(
      KIT_DIR,
      "./src/Select.stories.tsx",
      () => undefined,
      noDocs,
      true,
      inlineJson
    );
    const sections = indexOf(code).components?.["./src/Select.stories.tsx"]?.sections ?? [];
    const html = componentPage(join(KIT_DIR, "src/Select.stories.tsx"))?.html ?? "";
    expect(sections.length).toBeGreaterThan(0);
    for (const { anchor } of sections) {
      if (anchor !== undefined) expect(html).toContain(`id="doc-${anchor}"`);
    }
  });

  it("keeps a component whose docs cannot be read, and says so", async () => {
    const index = indexOf(
      await storySearchModule(
        KIT_DIR,
        "./src/Select.stories.tsx",
        () => undefined,
        async () => "no program",
        true,
        inlineJson
      )
    );
    expect(index.problems).toEqual(["./src/Select.stories.tsx: no program"]);
    expect(index.components?.["./src/Select.stories.tsx"]?.sections).toBeDefined();
  });

  it("keeps what names this computer's files out of a static build", async () => {
    const code = await storySearchModule(
      KIT_DIR,
      "./src/Select.stories.tsx",
      () => undefined,
      async () => "/home/me/x.tsx cannot be read",
      false,
      inlineJson
    );
    expect(code).not.toContain("/home/me");
  });

  it("leaves out a component with nothing to add", async () => {
    const index = indexOf(
      await storySearchModule(KIT_DIR, "./src/Form.stories.tsx", () => undefined, noDocs, true, inlineJson)
    );
    expect(index.components).toEqual({});
  });
});
