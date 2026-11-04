/**
 * Tests for the close watch: the files a person works on, each watched on its own so an edit reaches the dev server at
 * once, and the system's late report of the same edit dropped.
 *
 * @module
 */
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  type CloseWatchOptions,
  closeWatch,
  currentCloseWatch,
  isWatchingByFileEvents,
  serverCloseWatch,
  type WatchFile
} from "../src/vite/closeWatch.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

/** What a file's watch reports. */
type WatchEvent = "change" | "rename" | "error";

/** A short wait: past the turn a change is handed on at the end of, and the turn the system takes a new watch on. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

/** A watch of files in memory: which are watched, and a way to fire their events. */
const fakeWatches = (): {
  readonly watchFile: WatchFile;
  readonly watched: () => readonly string[];
  readonly fire: (file: string, kind: WatchEvent) => void;
} => {
  const listeners = new Map<string, (kind: WatchEvent) => void>();
  return {
    watchFile: (file: string, onEvent: (kind: WatchEvent) => void) => {
      if (file.includes("missing")) throw new Error("ENOENT");
      listeners.set(file, onEvent);
      return { close: () => void listeners.delete(file) };
    },
    watched: () => [...listeners.keys()],
    fire: (file: string, kind: WatchEvent) => listeners.get(file)?.(kind)
  };
};

/** A close watch on fake watches and texts, recording the changes it hands on. */
const watchWith = (
  overrides: Partial<CloseWatchOptions> = {}
): {
  readonly watch: ReturnType<typeof closeWatch>;
  readonly fake: ReturnType<typeof fakeWatches>;
  readonly changed: string[];
  readonly texts: Map<string, string>;
} => {
  const fake = fakeWatches();
  const changed: string[] = [];
  const texts = new Map<string, string>();
  const watch = closeWatch({
    onChange: (file: string) => void changed.push(file),
    watchFile: fake.watchFile,
    readText: (file: string) => texts.get(file),
    ...overrides
  });
  return { watch, fake, changed, texts };
};

describe("the close watch", () => {
  it("hands a followed file's change on once per save, at the end of the turn", async () => {
    const { watch, fake, changed } = watchWith();
    watch.follow("/kit/Badge.stories.tsx");
    // a save that empties the file, then writes it
    fake.fire("/kit/Badge.stories.tsx", "change");
    fake.fire("/kit/Badge.stories.tsx", "change");
    expect(changed).toEqual([]);
    await settle();
    expect(changed).toEqual(["/kit/Badge.stories.tsx"]);
  });

  it("drops the system's late report of an edit it handed on, in each environment", async () => {
    const { watch, fake, texts } = watchWith();
    const file = "/kit/Badge.stories.tsx";
    texts.set(file, "one");
    watch.follow(file);
    expect(watch.isLateReport("client", file)).toBe(false);
    texts.set(file, "two");
    fake.fire(file, "change");
    await settle();
    // the close watch's report, then the system's
    expect(watch.isLateReport("client", file)).toBe(false);
    expect(watch.isLateReport("ssr", file)).toBe(false);
    expect(watch.isLateReport("client", file)).toBe(true);
    expect(watch.isLateReport("ssr", file)).toBe(true);
  });

  it("takes a save that changes nothing, when it reported it: a story retried after an error", async () => {
    const { watch, fake, texts } = watchWith();
    const file = "/kit/Badge.stories.tsx";
    texts.set(file, "one");
    watch.follow(file);
    expect(watch.isLateReport("client", file)).toBe(false);
    fake.fire(file, "change");
    await settle();
    expect(watch.isLateReport("client", file)).toBe(false);
  });

  it("takes an edit only the system reported, whose text is new", () => {
    const { watch, texts } = watchWith();
    const file = "/kit/Badge.stories.tsx";
    texts.set(file, "one");
    watch.follow(file);
    expect(watch.isLateReport("client", file)).toBe(false);
    texts.set(file, "two");
    expect(watch.isLateReport("client", file)).toBe(false);
    expect(watch.isLateReport("client", file)).toBe(true);
  });

  it("never drops an update of a file it does not follow, or cannot read", () => {
    const { watch, texts } = watchWith();
    texts.set("/kit/Other.tsx", "same");
    expect(watch.isLateReport("client", "/kit/Other.tsx")).toBe(false);
    expect(watch.isLateReport("client", "/kit/Other.tsx")).toBe(false);
    watch.follow("/kit/Gone.tsx");
    expect(watch.isLateReport("client", "/kit/Gone.tsx")).toBe(false);
    expect(watch.isLateReport("client", "/kit/Gone.tsx")).toBe(false);
  });

  it("follows a bounded few, dropping the least recently followed", () => {
    const { watch, fake } = watchWith({ limit: 2 });
    watch.follow("/a.tsx");
    watch.follow("/b.tsx");
    watch.follow("/a.tsx");
    watch.follow("/c.tsx");
    expect([...fake.watched()].sort()).toEqual(["/a.tsx", "/c.tsx"]);
  });

  it("never follows a dependency's file, which Vite's watcher ignores, nor a page, which Vite would reload", () => {
    const { watch, fake } = watchWith();
    watch.follow("/app/node_modules/kit/Badge.stories.js");
    watch.follow("/app/src/intro.html");
    expect(fake.watched()).toEqual([]);
  });

  it("follows a file saved through a new one, and hands that save on; a removed one is left to Vite", async () => {
    const { watch, fake, changed } = watchWith();
    const file = join(mkdtempSync(join(tmpdir(), "forgebook-close-")), "Badge.stories.tsx");
    const key = VITE_PATHS.normalize(file);
    writeFileSync(file, "one");
    watch.follow(file);
    fake.fire(key, "rename");
    await settle();
    expect(changed).toEqual([key]);
    expect(fake.watched()).toEqual([key]);
    rmSync(file);
    fake.fire(key, "rename");
    await settle();
    expect(fake.watched()).toEqual([]);
    expect(changed).toEqual([key]);
  });

  it("leaves a file it cannot watch to Vite's watcher", () => {
    const { watch, fake } = watchWith();
    expect(() => watch.follow("/kit/missing.tsx")).not.toThrow();
    expect(fake.watched()).toEqual([]);
  });

  it("stops following every file when closed, and hands on no change still pending", async () => {
    const { watch, fake, changed } = watchWith();
    watch.follow("/a.tsx");
    watch.follow("/b.tsx");
    fake.fire("/a.tsx", "change");
    watch.close();
    await settle();
    expect(fake.watched()).toEqual([]);
    expect(changed).toEqual([]);
  });

  it("hears a real file's edits, in place and through a new file", { timeout: 20_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-close-"));
    const file = join(dir, "Badge.stories.tsx");
    writeFileSync(file, "one");
    const changed: string[] = [];
    const watch = closeWatch({ onChange: (edited: string) => void changed.push(edited) });
    try {
      watch.follow(file);
      await settle();
      writeFileSync(file, "two");
      await vi.waitFor(() => expect(changed.length).toBeGreaterThan(0), { timeout: 5000 });
      const before = changed.length;
      writeFileSync(join(dir, "next"), "three");
      renameSync(join(dir, "next"), file);
      await vi.waitFor(() => expect(changed.length).toBeGreaterThan(before), { timeout: 5000 });
      const renamed = changed.length;
      await settle();
      writeFileSync(file, "four");
      await vi.waitFor(() => expect(changed.length).toBeGreaterThan(renamed), { timeout: 5000 });
      expect(new Set(changed)).toEqual(new Set([VITE_PATHS.normalize(file)]));
    } finally {
      watch.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("whether a dev server's watcher reads FSEvents", () => {
  it("is so on macOS, unless it polls, was told not to, waits for writes to finish, or watches nothing", () => {
    expect(isWatchingByFileEvents(undefined, "darwin")).toBe(true);
    expect(isWatchingByFileEvents({}, "darwin")).toBe(true);
    expect(isWatchingByFileEvents({ awaitWriteFinish: false }, "darwin")).toBe(true);
    expect(isWatchingByFileEvents({ usePolling: true }, "darwin")).toBe(false);
    expect(isWatchingByFileEvents({ useFsEvents: false }, "darwin")).toBe(false);
    expect(isWatchingByFileEvents({ awaitWriteFinish: true }, "darwin")).toBe(false);
    expect(isWatchingByFileEvents(null, "darwin")).toBe(false);
    expect(isWatchingByFileEvents({}, "linux")).toBe(false);
    expect(isWatchingByFileEvents({}, "win32")).toBe(false);
  });
});

describe("a dev server's close watch", () => {
  /** A dev server reduced to what the close watch touches: its options, watcher, pages' modules and closing. */
  const fakeServer = (
    loaded: string,
    hmr: boolean = true
  ): {
    readonly server: Parameters<typeof serverCloseWatch>[0];
    readonly emitted: string[];
    readonly change: (file: string) => void;
    readonly closeServer: () => void;
  } => {
    const emitted: string[] = [];
    const listeners: ((file: string) => void)[] = [];
    let onClose = (): void => undefined;
    const server = {
      config: { server: { watch: {}, hmr } },
      watcher: {
        on: (_event: string, listener: (file: string) => void): void => void listeners.push(listener),
        emit: (_event: string, file: string): boolean => emitted.push(file) > 0
      },
      environments: {
        client: {
          moduleGraph: {
            getModulesByFile: (file: string): Set<string> | undefined =>
              file === VITE_PATHS.normalize(loaded) ? new Set([file]) : undefined
          }
        }
      },
      httpServer: {
        on: (_event: string, listener: () => void): void => {
          onClose = listener;
        }
      }
    };
    return {
      // the dev server's type is far wider than what the close watch reads
      server: server as never,
      emitted,
      change: (file: string) => {
        for (const listener of listeners) listener(file);
      },
      closeServer: () => onClose()
    };
  };

  it("is made only where the watcher reads FSEvents and the server sends updates", () => {
    expect(serverCloseWatch(fakeServer("").server, "linux")).toBeUndefined();
    expect(serverCloseWatch(fakeServer("", false).server, "darwin")).toBeUndefined();
    const watching = serverCloseWatch(fakeServer("").server, "darwin");
    expect(watching).toBeDefined();
    watching?.close();
  });

  it("follows a file a page loaded once it is edited, hands its next edit on, and stops with the server", async () => {
    const dir = mkdtempSync(join(tmpdir(), "forgebook-close-"));
    const file = join(dir, "Badge.tsx");
    const other = join(dir, "Other.tsx");
    writeFileSync(file, "one");
    writeFileSync(other, "one");
    const fake = fakeServer(file);
    const watching = serverCloseWatch(fake.server, "darwin");
    try {
      fake.change(other);
      fake.change(file);
      await settle();
      writeFileSync(other, "two");
      writeFileSync(file, "two");
      await vi.waitFor(() => expect(fake.emitted).toContain(VITE_PATHS.normalize(file)), { timeout: 5000 });
      expect(fake.emitted).not.toContain(VITE_PATHS.normalize(other));
      fake.closeServer();
      fake.emitted.length = 0;
      writeFileSync(file, "three");
      await settle();
      await settle();
      expect(fake.emitted).toEqual([]);
    } finally {
      watching?.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("follows the files of the server that runs now: a restart's new one, until the plugin is told the end", () => {
    const current = currentCloseWatch();
    const dir = mkdtempSync(join(tmpdir(), "forgebook-close-"));
    const file = join(dir, "Badge.stories.tsx");
    writeFileSync(file, "one");
    try {
      current.serve(fakeServer("").server, "darwin");
      current.follow(file);
      expect(current.isLateReport("client", file)).toBe(false);
      expect(current.isLateReport("client", file)).toBe(true);
      current.serve(fakeServer("").server, "darwin");
      expect(current.isLateReport("client", file)).toBe(false);
      current.follow(file);
      expect(current.isLateReport("client", file)).toBe(false);
      current.close();
      expect(current.isLateReport("client", file)).toBe(false);
      current.serve(undefined);
      current.follow(file);
      expect(current.isLateReport("client", file)).toBe(false);
    } finally {
      current.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
