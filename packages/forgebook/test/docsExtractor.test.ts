/**
 * Tests for the docs read in a worker thread: the answer is the extractor's, kept on disk for a later start, and the
 * worker ends when asked, or when left with nothing to do.
 *
 * @module
 */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

import { afterAll, describe, expect, it, vi } from "vitest";

import { createDocsExtractor } from "../src/vite/docsExtractor.ts";
import { KIT_DIR } from "./fixturePaths.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

const KIT = join(KIT_DIR, "src");

describe("createDocsExtractor", () => {
  const extractor = createDocsExtractor(STUB_FRAMEWORK.docsModule);
  afterAll(() => extractor.close());

  it("reads a story file's component docs off the calling thread", async () => {
    const storyFile = join(KIT, "Select.stories.tsx");
    const result = await extractor.extract(storyFile);
    expect(typeof result === "string" ? result : result.docs).toMatchObject({ name: "Select" });
  }, 60_000);

  it("answers a file it cannot read with why, and keeps answering", async () => {
    expect(await extractor.extract(join(KIT, "Missing.stories.tsx"))).toMatch(/Missing\.stories\.tsx/);
    const again = await extractor.extract(join(KIT, "Select.stories.tsx"));
    expect(typeof again === "string" ? again : again.docs).toMatchObject({ name: "Select" });
  }, 60_000);

  it('reads a group\'s usage once when its "Used in" and its reach ask for it together', async () => {
    const files = [{ storyFile: join(KIT, "Select.stories.tsx"), exports: ["Default"] }];
    const usedIn = extractor.usage(files);
    const reach = extractor.usage(files);
    expect(reach).toBe(usedIn);
    expect(typeof (await usedIn)).toBe("object");
  }, 60_000);
});

describe("createDocsExtractor with a cache folder", () => {
  it("keeps the docs it read, and a later extractor answers from them", async () => {
    const cacheFolder = mkdtempSync(join(tmpdir(), "forgebook-docs-cache-"));
    const storyFile = join(KIT, "Select.stories.tsx");
    const first = createDocsExtractor(STUB_FRAMEWORK.docsModule, { cacheFolder });
    const read = await first.extract(storyFile);
    await first.close();
    expect(readdirSync(join(cacheFolder, "docs"))).toHaveLength(1);
    const later = createDocsExtractor(STUB_FRAMEWORK.docsModule, { cacheFolder });
    expect(await later.extract(storyFile)).toEqual(read);
    await later.close();
    rmSync(cacheFolder, { recursive: true, force: true });
  }, 60_000);
});

describe("createDocsExtractor left idle", () => {
  it("ends its worker once nothing is asked of it, and starts another for the next request", async () => {
    const terminate = vi.spyOn(Worker.prototype, "terminate");
    const extractor = createDocsExtractor(STUB_FRAMEWORK.docsModule, { idleMs: 50 });
    const storyFile = join(KIT, "Select.stories.tsx");
    const first = await extractor.extract(storyFile);
    expect(typeof first === "string" ? first : first.docs).toMatchObject({ name: "Select" });
    await vi.waitFor(() => expect(terminate).toHaveBeenCalledTimes(1), { timeout: 5_000 });
    const again = await extractor.extract(storyFile);
    expect(typeof again === "string" ? again : again.docs).toMatchObject({ name: "Select" });
    await extractor.close();
    terminate.mockRestore();
  }, 60_000);

  it("keeps a build's worker until the build ends", async () => {
    const terminate = vi.spyOn(Worker.prototype, "terminate");
    const extractor = createDocsExtractor(STUB_FRAMEWORK.docsModule, { idleMs: 50, readsEverything: true });
    await extractor.extract(join(KIT, "Select.stories.tsx"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(terminate).not.toHaveBeenCalled();
    await extractor.close();
    expect(terminate).toHaveBeenCalledTimes(1);
    terminate.mockRestore();
  }, 60_000);
});
