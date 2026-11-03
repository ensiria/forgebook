/**
 * Tests for `forgebook docs` on Svelte components: the Svelte fixture's CATALOG.md, its components read by the Svelte docs
 * module.
 *
 * @module
 */
import { join } from "node:path";

import { collectDocs } from "forgebook/catalogue-docs";
import { catalogueMarkdown } from "forgebook/catalogue-markdown";
import { CATALOGUE_SECTIONS } from "forgebook/catalogue-options";
import { describe, expect, it } from "vitest";

import { extractStoryComponent } from "../src/vite/extractDocs.ts";

/** The Svelte fixture catalogue, a package that exports a `.svelte` file. */
const FIXTURE = join(import.meta.dirname, "..", "..", "..", "fixtures", "svelte");

describe("collectDocs and catalogueMarkdown", () => {
  const { data, problems } = collectDocs(FIXTURE, extractStoryComponent, { exclude: [] });

  it("lists a component the package exports, with its props, snippets and events", () => {
    expect(problems).toEqual([]);
    expect(data.components.map((component) => component.subpath)).toContain("./badge");
    const text = catalogueMarkdown(data, CATALOGUE_SECTIONS);
    expect(text).toContain("**Badge** `@fixture/svelte/badge`");
    expect(text).toContain("label!:string");
    expect(text).toContain("#children:Snippet");
    expect(text).toContain("onremove(label)");
  });
});
