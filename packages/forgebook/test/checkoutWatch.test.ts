/**
 * Tests for the checkout watch: what a `git switch` rewrote, handed to the dev server's watcher as its own events,
 * since the system's events for such a burst may come late or never.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CheckoutEvent,
  type CheckoutWatch,
  checkoutEvents,
  checkoutWatch
} from "../src/vite/checkoutWatch.ts";
import type { WatchFile } from "../src/vite/closeWatch.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

/** A file in Vite's form, as events name them. */
const viteFile = (...parts: readonly string[]): string => VITE_PATHS.normalize(join(...parts));

describe("the events a checkout makes", () => {
  const top = "/repo";
  const since = 10_000;

  it("names what the checkout wrote, added and removed", () => {
    const status = (file: string): { changedAt: number } | undefined =>
      file.endsWith("Gone.stories.ts") ? undefined : { changedAt: since + 5 };
    const listed = [
      "M",
      "src/Button.stories.ts",
      "A",
      "src/forms/Field.stories.ts",
      "D",
      "src/Gone.stories.ts",
      ""
    ];
    expect(checkoutEvents(listed.join("\0"), top, since, status)).toEqual([
      { kind: "change", file: viteFile(top, "src/Button.stories.ts") },
      { kind: "add", file: viteFile(top, "src/forms/Field.stories.ts") },
      { kind: "unlink", file: viteFile(top, "src/Gone.stories.ts") }
    ]);
  });

  it("leaves out a file the disk has as it was, one said removed that is still there, and dependencies", () => {
    const status = (file: string): { changedAt: number } | undefined =>
      file.endsWith("Old.stories.ts") ? { changedAt: since - 60_000 } : { changedAt: since + 5 };
    const listed = [
      "M",
      "src/Old.stories.ts",
      "D",
      "src/Kept.stories.ts",
      "M",
      "node_modules/x/index.js",
      ""
    ];
    expect(checkoutEvents(listed.join("\0"), top, since, status)).toEqual([]);
  });

  it("counts a file written a little before the commit was seen, as a file system's clock may stamp it", () => {
    const status = (): { changedAt: number } => ({ changedAt: since - 500 });
    expect(checkoutEvents(["M", "a.ts", ""].join("\0"), top, since, status)).toEqual([
      { kind: "change", file: viteFile(top, "a.ts") }
    ]);
  });
});

describe("a repository's checkout watch", () => {
  let repo = "";
  let watch: CheckoutWatch | undefined;
  const git = (...args: readonly string[]): string =>
    execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: repo, encoding: "utf8" });
  const write = (path: string, text: string): void => {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
  };

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), "forgebook-checkout-")));
    git("init", "-q", "-b", "main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    write("src/Button.stories.ts", "export const Primary = {};");
    write("src/Card.stories.ts", "export const Plain = {};");
    git("add", "-A");
    git("commit", "-q", "-m", "main");
    git("switch", "-q", "-c", "other");
    unlinkSync(join(repo, "src/Card.stories.ts"));
    write("src/Button.stories.ts", "export const Secondary = {};");
    write("src/forms/Field.stories.ts", "export const Empty = {};");
    git("add", "-A");
    git("commit", "-q", "-m", "other");
    git("switch", "-q", "main");
  });

  afterEach(() => {
    watch?.close();
    watch = undefined;
    rmSync(repo, { recursive: true, force: true });
  });

  /** Watches of files in memory, fired by hand: the test says when git's files changed. */
  const fakeWatches = (): { readonly watchFile: WatchFile; readonly fireAll: () => void } => {
    const listeners = new Map<string, (kind: "change" | "rename" | "error") => void>();
    return {
      watchFile: (file: string, onEvent: (kind: "change" | "rename" | "error") => void) => {
        listeners.set(file, onEvent);
        return { close: () => void listeners.delete(file) };
      },
      fireAll: () => {
        for (const listener of [...listeners.values()]) listener("rename");
      }
    };
  };

  it("hands on what a switch and a switch back wrote, and nothing for a commit", async () => {
    const events: CheckoutEvent[] = [];
    const fake = fakeWatches();
    watch = checkoutWatch({
      dir: repo,
      onEvent: (event: CheckoutEvent) => events.push(event),
      watchFile: fake.watchFile
    });
    await watch.ready;
    git("switch", "-q", "other");
    fake.fireAll();
    await watch.settled();
    expect(events).toEqual(
      expect.arrayContaining([
        { kind: "change", file: viteFile(repo, "src/Button.stories.ts") },
        { kind: "add", file: viteFile(repo, "src/forms/Field.stories.ts") },
        { kind: "unlink", file: viteFile(repo, "src/Card.stories.ts") }
      ])
    );
    expect(events).toHaveLength(3);
    events.length = 0;
    git("switch", "-q", "main");
    fake.fireAll();
    await watch.settled();
    expect(events).toEqual(
      expect.arrayContaining([
        { kind: "change", file: viteFile(repo, "src/Button.stories.ts") },
        { kind: "add", file: viteFile(repo, "src/Card.stories.ts") },
        { kind: "unlink", file: viteFile(repo, "src/forms/Field.stories.ts") }
      ])
    );
    expect(events).toHaveLength(3);
    events.length = 0;
    // a commit moves HEAD and rewrites nothing: the files it names are untouched since the last checkout
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    write("README.md", "notes");
    git("add", "-A");
    git("commit", "-q", "-m", "notes", "--date", "2030-01-01T00:00:00Z");
    fake.fireAll();
    await watch.settled();
    expect(events.filter((event) => !event.file.endsWith("README.md"))).toEqual([]);
  }, 30_000);

  it("hears a switch through git's own files, with no system event for the stories", async () => {
    const events: CheckoutEvent[] = [];
    watch = checkoutWatch({ dir: repo, onEvent: (event: CheckoutEvent) => events.push(event) });
    await watch.ready;
    git("switch", "-q", "other");
    await vi.waitFor(() => expect(events).toHaveLength(3), { timeout: 10_000 });
    git("switch", "-q", "main");
    await vi.waitFor(() => expect(events).toHaveLength(6), { timeout: 10_000 });
    expect(events.slice(3).map((event) => event.kind)).toEqual(
      expect.arrayContaining(["change", "add", "unlink"])
    );
  }, 30_000);

  it("watches nothing in a folder that is no repository", async () => {
    const folder = mkdtempSync(join(tmpdir(), "forgebook-no-repo-"));
    const watched: string[] = [];
    watch = checkoutWatch({
      dir: folder,
      onEvent: () => undefined,
      watchFile: (file: string) => {
        watched.push(file);
        return { close: () => undefined };
      }
    });
    await watch.ready;
    expect(watched).toEqual([]);
    rmSync(folder, { recursive: true, force: true });
  });
});
