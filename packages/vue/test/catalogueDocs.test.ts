/**
 * Tests for `forgebook docs` on Vue components: the Vue fixture's CATALOG.md, its components read by the Vue docs module.
 *
 * @module
 */
import { join } from "node:path";

import { collectDocs } from "forgebook/catalogue-docs";
import { catalogueMarkdown } from "forgebook/catalogue-markdown";
import { CATALOGUE_SECTIONS } from "forgebook/catalogue-options";
import { describe, expect, it } from "vitest";

import { extractStoryComponent } from "../src/vite/extractDocs.ts";

/** The Vue fixture catalogue, a package that exports a single-file component. */
const FIXTURE = join(import.meta.dirname, "..", "..", "..", "fixtures", "vue");

describe("collectDocs and catalogueMarkdown", () => {
  const { data, problems } = collectDocs(FIXTURE, extractStoryComponent, { exclude: [] });

  it("lists a single-file component the package exports, with its props and its summary", () => {
    expect(problems).toEqual([]);
    expect(data.components.map((component) => component.subpath)).toContain("./badge");
    const text = catalogueMarkdown(data, CATALOGUE_SECTIONS);
    expect(text).toContain("**Badge** `@fixture/vue/badge`");
    expect(text).toContain("label!:string");
  });
});
