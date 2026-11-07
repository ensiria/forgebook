/**
 * Tests for `forgebook build --watch`: what counts as a changed list, and a real watch on a small catalogue: an edit
 * rebuilds, a new story file reaches the list, a broken file leaves the last output and a fix recovers.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isListingChanged, listingOf } from "../bin/forgebook/buildWatch.ts";
import { DOCS_PAGES_SPECIFIER_PREFIX, FILES_SPECIFIER_PREFIX } from "../src/vite/storyFilesModule.ts";

/** The command's entry. */
const ENTRY = join(import.meta.dirname, "..", "bin", "forgebook", "forgebook.mts");

describe("listingOf", () => {
  it("reads the groups among a build's modules, and skips the others", () => {
    const stories = `\0${FILES_SPECIFIER_PREFIX}group-a`;
    const pages = `\0${DOCS_PAGES_SPECIFIER_PREFIX}group-b`;
    const listing = listingOf([stories, "/src/a.tsx", pages], (group) => [`${group}.file`]);
    expect([...listing]).toEqual([
      [stories, "group-a.file"],
      [pages, "group-b.file"]
    ]);
  });
});

describe("isListingChanged", () => {
  const before = new Map([["group", "a\nb"]]);

  it("is false for the same files", () => {
    expect(isListingChanged(before, new Map([["group", "a\nb"]]))).toBe(false);
  });

  it("is true for a file added or removed", () => {
    expect(isListingChanged(before, new Map([["group", "a\nb\nc"]]))).toBe(true);
    expect(isListingChanged(before, new Map([["group", "a"]]))).toBe(true);
  });

  it("is true for a group gone or new", () => {
    expect(isListingChanged(before, new Map())).toBe(true);
  });
});

describe("forgebook build --watch", () => {
  let root = "";
  let out = "";
  let src = "";
  let watching: ChildProcess | undefined;
  let printed = "";

  /** Waits until the process printed a text a given number of times. */
  const printedTimes = async (text: string, times: number): Promise<void> => {
    await expect
      .poll(() => printed.split(text).length - 1, { timeout: 60_000, interval: 100 })
      .toBeGreaterThanOrEqual(times);
  };

  /** The text of the output's scripts and data. */
  const builtText = (): string =>
    readdirSync(join(out, "assets"))
      .map((file) => readFileSync(join(out, "assets", file), "latin1"))
      .join("\n");

  beforeAll(() => {
    // its real path: the system's temporary folder may be a link, and a watch reports the files by their real paths
    root = realpathSync(mkdtempSync(join(tmpdir(), "forgebook-watch-")));
    out = join(root, "site");
    src = join(root, "src");
    mkdirSync(src);
    // a real framework, for a build's pages: the fixture app's packages under a catalogue of its own
    symlinkSync(
      join(import.meta.dirname, "..", "..", "..", "fixtures", "app", "node_modules"),
      join(root, "node_modules"),
      "junction"
    );
    writeFileSync(join(root, "package.json"), '{ "type": "module" }\n');
    writeFileSync(
      join(root, "forgebook.config.ts"),
      [
        'import { react } from "@forgebook/react/vite";',
        'import { defineConfig } from "forgebook";',
        'export default defineConfig({ framework: react(), title: "W", stories: ["src/*.stories.tsx"] });',
        ""
      ].join("\n")
    );
    writeFileSync(
      join(src, "a.stories.tsx"),
      'export default { title: "A" };\nexport const First = { args: { label: "first-text" } };\n'
    );
  });

  afterAll(async () => {
    watching?.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 200));
    rmSync(root, { recursive: true, force: true });
  });

  it("follows an edit, a new file and a broken one, and stops on a signal", {
    timeout: 240_000
  }, async () => {
    watching = spawn(process.execPath, [ENTRY, "build", "--watch", "--out", out, "--no-color"], {
      cwd: root
    });
    const note = (chunk: Buffer): void => {
      printed += chunk.toString();
    };
    watching.stdout?.on("data", note);
    watching.stderr?.on("data", note);

    await printedTimes("watching for changes", 1);
    expect(builtText()).toContain("first-text");

    writeFileSync(
      join(src, "a.stories.tsx"),
      'export default { title: "A" };\nexport const First = { args: { label: "second-text" } };\n'
    );
    await printedTimes("watching for changes", 2);
    expect(builtText()).toContain("second-text");

    writeFileSync(join(src, "b.stories.tsx"), 'export default { title: "Added" };\nexport const New = {};\n');
    await printedTimes("building from the start", 1);
    await printedTimes("watching for changes", 3);
    expect(builtText()).toContain("Added");

    writeFileSync(join(src, "a.stories.tsx"), "export default { title:");
    await printedTimes("Waiting for the next edit", 1);
    writeFileSync(
      join(src, "a.stories.tsx"),
      'export default { title: "A" };\nexport const First = { args: { label: "third-text" } };\n'
    );
    await printedTimes("watching for changes", 4);
    expect(builtText()).toContain("third-text");

    unlinkSync(join(src, "b.stories.tsx"));
    await printedTimes("watching for changes", 5);
    expect(builtText()).not.toContain("Added");

    const exited = new Promise<number | null>((resolve) => watching?.once("exit", resolve));
    watching.kill("SIGINT");
    const code = await exited;
    // Windows ends a process on a signal with no handler running
    if (process.platform !== "win32") expect(code).toBe(0);
  });
});
