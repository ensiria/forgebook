/**
 * Tests for the docs read in a worker thread: the answer is the extractor's, and the worker ends when asked.
 *
 * @module
 */
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { createDocsExtractor } from "../src/vite/docsExtractor";
import { KIT_DIR } from "./fixturePaths";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework";

const KIT = join(KIT_DIR, "src");

describe("createDocsExtractor", () => {
  const extractor = createDocsExtractor(STUB_FRAMEWORK.docsModule);
  afterAll(() => extractor.close());

  it("reads a story file's component docs off the calling thread, after a warm-up", async () => {
    const storyFile = join(KIT, "Select.stories.tsx");
    extractor.warm(storyFile);
    const result = await extractor.extract(storyFile);
    expect(typeof result === "string" ? result : result.docs).toMatchObject({ name: "Select" });
  }, 60_000);

  it("answers a file it cannot read with why, and keeps answering", async () => {
    expect(await extractor.extract(join(KIT, "Missing.stories.tsx"))).toMatch(/Missing\.stories\.tsx/);
    const again = await extractor.extract(join(KIT, "Select.stories.tsx"));
    expect(typeof again === "string" ? again : again.docs).toMatchObject({ name: "Select" });
  }, 60_000);
});
