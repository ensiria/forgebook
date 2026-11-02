/**
 * Tests for `forgebook docs` on an HTML library: the HTML fixture's CATALOG.md, its functions read by the HTML docs
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

/** The HTML fixture catalogue, a package that exports a function drawing a button. */
const FIXTURE = join(import.meta.dirname, "..", "..", "..", "fixtures", "html");

describe("collectDocs and catalogueMarkdown", () => {
  const { data, problems } = collectDocs(FIXTURE, extractStoryComponent, { exclude: [] });

  it("lists a function the package exports, with its args and its summary", () => {
    expect(problems).toEqual([]);
    expect(data.components.map((component) => component.subpath)).toContain("./button");
    const text = catalogueMarkdown(data, CATALOGUE_SECTIONS);
    expect(text).toContain("**createButton** `@fixture/html/button`");
    expect(text).toContain("label!:string");
  });
});
