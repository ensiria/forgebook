/**
 * A test that edits a committed fixture file while the fixture app's catalogue serves it: the `fileEdits` fixture
 * writes each edit, waits until the dev server has taken it, and puts back the file's exact bytes when the test ends,
 * however it ends.
 *
 * @remarks
 * The original bytes are put back in the fixture's teardown, which Playwright runs after a test that passed, failed or
 * timed out, and also when a run is stopped with Ctrl-C. A `finally` in the test's body does not cover a timeout: the
 * body is abandoned, and the worker may stop before it settles.
 *
 * Before its first edit of a file, a test keeps the file's bytes in a folder of the system's temporary one, and drops
 * them once the file is back. A run killed outright leaves them there; the next test that edits the file puts them
 * back before reading it, so an edit is never taken for the file's text.
 *
 * Vite's watcher passes a file's change on at most once in 50 ms and drops the ones in between, and macOS hands it
 * changes in batches: a write that follows another of the same file closely is never seen, and the page keeps drawing
 * the one before. So each write, the put-back included, returns only once the dev server serves the file as written
 * and that window has passed: the next write, in this test or the next one, is always seen.
 *
 * Only one test may edit a given file at a time, whatever spec or repetition it is: the specs that use this fixture
 * run in the configuration's `story file edits` project, on one worker (`playwright.config.ts`).
 *
 * @module
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { test as base, expect } from "@playwright/test";
import { normalizePath } from "vite";

import { framesPortOf } from "./ports";

/**
 * A short name made from a text: the start of its SHA-256.
 *
 * @param text - the text.
 */
const hashOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 24);

/** Where the files' original bytes wait while a test edits them: one folder per checkout, so two never mix. */
const KEPT_FOLDER = join(tmpdir(), `forgebook-shell-edits-${hashOf(import.meta.dirname)}`);

/**
 * How long Vite's watcher (chokidar) drops a file's further changes after passing one on, twice over: the timer that
 * ends the window runs on the dev server's event loop, which may be late.
 */
const WATCHER_WINDOW_MS = 2 * 50;

/** The file that keeps a file's original bytes. */
const keptPath = (file: string): string => join(KEPT_FOLDER, `${hashOf(file)}.bytes`);

/**
 * Keeps a file's bytes, written whole or not at all, so a run killed while it writes leaves no half copy.
 *
 * @param file - the file.
 * @param bytes - its bytes.
 */
const keep = (file: string, bytes: Buffer): void => {
  mkdirSync(KEPT_FOLDER, { recursive: true });
  const kept = keptPath(file);
  writeFileSync(`${kept}.partial`, bytes);
  renameSync(`${kept}.partial`, kept);
};

/**
 * The file as the fixture app's frames server serves it: its module, as the dev server last read it.
 *
 * @param file - the file's absolute path.
 */
const served = async (file: string): Promise<string> => {
  const path = normalizePath(file).replace(/^\/?/, "/@fs/");
  const response = await fetch(new URL(path, `http://127.0.0.1:${framesPortOf("app")}`));
  return response.text();
};

/**
 * Writes a file and returns once the dev server serves what was written and its watcher would see the next write.
 *
 * @param file - the file's absolute path.
 * @param bytes - what it holds after.
 */
const writeSeen = async (file: string, bytes: Buffer | string): Promise<void> => {
  if (readFileSync(file).equals(Buffer.from(bytes))) return;
  const before = await served(file);
  writeFileSync(file, bytes);
  await expect
    .poll(async () => served(file), { message: `the dev server takes the write of ${file}` })
    .not.toBe(before);
  await sleep(WATCHER_WINDOW_MS);
};

/**
 * Puts a file's kept bytes back and drops them; nothing when none are kept.
 *
 * @param file - the file.
 */
const putBack = async (file: string): Promise<void> => {
  const kept = keptPath(file);
  if (!existsSync(kept)) return;
  const bytes = readFileSync(kept);
  try {
    await writeSeen(file, bytes);
  } finally {
    // back in the file even when the dev server did not take it in time: the kept copy has done its work
    if (readFileSync(file).equals(bytes)) rmSync(kept);
  }
};

/** Edits of fixture files, each put back when the test ends. */
export type FileEdits = {
  /**
   * Writes a file's new text, made from its original one: the text it had before this test edited it, whatever the
   * test wrote since. Resolves once the dev server has taken it.
   *
   * @param file - the file's absolute path.
   * @param edit - makes the new text from the original one.
   */
  readonly write: (file: string, edit: (original: string) => string) => Promise<void>;
};

/** Playwright's `test`, with `fileEdits`. */
export const test = base.extend<{ fileEdits: FileEdits }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this pattern
  fileEdits: async ({}, use) => {
    const edited = new Set<string>();
    const write = async (file: string, edit: (original: string) => string): Promise<void> => {
      if (!edited.has(file)) {
        // bytes kept by a run that was killed before it put them back: the file still holds that run's edit
        await putBack(file);
        keep(file, readFileSync(file));
        edited.add(file);
      }
      await writeSeen(file, edit(readFileSync(keptPath(file), "utf8")));
    };
    await use({ write });
    // the teardown: Playwright runs it however the test ended
    for (const file of edited) await putBack(file);
  }
});
