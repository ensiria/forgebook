/**
 * `forgebook docs` on custom elements: the Web Components fixture's CATALOG.md, its elements read from its Custom
 * Elements Manifest by the Web Components docs module.
 *
 * @module
 */
import { join } from "node:path";

import { collectDocs } from "forgebook/catalogue-docs";
import { catalogueMarkdown } from "forgebook/catalogue-markdown";
import { CATALOGUE_SECTIONS } from "forgebook/catalogue-options";
import { describe, expect, it } from "vitest";

import { extractStoryComponent } from "../src/vite/extractDocs.ts";

/** The Web Components fixture catalogue, a package that exports a Lit element. */
const FIXTURE = join(import.meta.dirname, "..", "..", "..", "fixtures", "web-components");

describe("collectDocs and catalogueMarkdown", () => {
  const { data, problems } = collectDocs(FIXTURE, extractStoryComponent, { exclude: [] });

  it("lists an element the package exports by its tag, with its args as a story sets them", () => {
    expect(problems).toEqual([]);
    expect(data.components.map((component) => component.subpath)).toContain("./badge");
    const text = catalogueMarkdown(data, CATALOGUE_SECTIONS);
    expect(text).toContain("**fixture-badge** `@fixture/web-components/badge`");
    expect(text).toContain("tone=neutral*|info|danger item-count:number");
    expect(text).toContain("@remove(event)");
  });
});
