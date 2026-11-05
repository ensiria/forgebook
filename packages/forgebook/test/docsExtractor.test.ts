/**
 * Tests for the docs read in a worker thread: the answer is the extractor's, kept on disk for a later start, and the
 * worker ends when asked, or when left with nothing to do.
 *
 * @module
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

describe("createDocsExtractor ending a worker that is still loading", () => {
  const folders: string[] = [];
  afterAll(() => {
    for (const folder of folders) rmSync(folder, { recursive: true, force: true });
  });

  /** A docs module that writes a file on its way through its loading, then does what `rest` says. */
  const docsModuleWriting = (rest: string): { readonly url: string; readonly marker: string } => {
    const folder = mkdtempSync(join(tmpdir(), "forgebook-docs-loading-"));
    folders.push(folder);
    const marker = join(folder, "loaded");
    const file = join(folder, "docs.mjs");
    writeFileSync(
      file,
      [
        'import { writeFileSync } from "node:fs";',
        "await new Promise((resolve) => setTimeout(resolve, 300));",
        `writeFileSync(${JSON.stringify(marker)}, "");`,
        rest,
        "export const extractStoryComponent = () => ({ docs: { name: null } });"
      ].join("\n")
    );
    return { url: pathToFileURL(file).href, marker };
  };

  it("waits for the modules on close, as Node aborts a process whose worker is ended loading one", async () => {
    const { url, marker } = docsModuleWriting("");
    const extractor = createDocsExtractor(url);
    extractor.warm(join(KIT, "Select.stories.tsx"));
    await extractor.close();
    expect(existsSync(marker)).toBe(true);
  }, 60_000);

  it("waits for them on a second close as well, which a server's two ways of closing make", async () => {
    const { url, marker } = docsModuleWriting("");
    const extractor = createDocsExtractor(url);
    extractor.warm(join(KIT, "Select.stories.tsx"));
    void extractor.close();
    await extractor.close();
    expect(existsSync(marker)).toBe(true);
  }, 60_000);

  it("waits for them when left idle too: an answer that needs no docs module can come first", async () => {
    const { url, marker } = docsModuleWriting("");
    const terminate = vi.spyOn(Worker.prototype, "terminate");
    const extractor = createDocsExtractor(url, { idleMs: 1 });
    await extractor.usage([]);
    await vi.waitFor(() => expect(terminate).toHaveBeenCalled(), { timeout: 30_000 });
    expect(existsSync(marker)).toBe(true);
    terminate.mockRestore();
    await extractor.close();
  }, 60_000);

  it("closes anyway past the limit, when the loading never ends", async () => {
    const { url, marker } = docsModuleWriting("await new Promise(() => undefined);");
    const extractor = createDocsExtractor(url, { loadWaitMs: 50 });
    extractor.warm(join(KIT, "Select.stories.tsx"));
    // past the compiler's import, which the abort comes from, before the limit is put to the test
    await vi.waitFor(() => expect(existsSync(marker)).toBe(true), { timeout: 30_000 });
    const closing = Date.now();
    await extractor.close();
    // far below the default limit, so a close that ignored the option would fail here
    expect(Date.now() - closing).toBeLessThan(20_000);
  }, 60_000);
});
