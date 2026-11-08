/**
 * The docs of an element whose tag is defined in a file the story does not import, in a build whose programs hold what
 * its stories reach: the class is looked for in every file of the configuration then.
 *
 * @module
 */
import { join } from "node:path";

import { isComponentDocs } from "forgebook/component-docs";
import { readStoryFilesOnly } from "forgebook/vite/docs-program";
import { describe, expect, it } from "vitest";

import { extractComponentDocs } from "../src/vite/extractDocs.ts";

/** The story whose element a preview would register. */
const STORY = join(import.meta.dirname, "..", "fixtures", "lit", "src", "Registered.stories.ts");

describe("a tag defined in a file the story does not import", () => {
  // as a build's worker is told
  readStoryFilesOnly([STORY]);

  it("is found in its configuration's other files", () => {
    const docs = extractComponentDocs(STORY);
    if (!isComponentDocs(docs)) throw new Error(`No docs: ${JSON.stringify(docs)}`);
    expect(docs.name).toBe("ui-plain");
    expect(docs.description).toBe("A plain block.");
  });
});
