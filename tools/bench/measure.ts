/**
 * The measurements: each one a definition in a real browser, the same for every tool.
 *
 * @remarks
 * A browser decides every time, since "server ready" is not "usable": a tool can print its address and then rebuild
 * its dependencies and reload the page. Every sample starts a new browser context, with nothing cached. Status lines
 * are written by the caller between samples, never during one.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Browser, BrowserContext, Page } from "@playwright/test";

import type { CorpusComponent } from "./corpus.ts";
import { diskUsage } from "./diskUsage.ts";
import { serveStatic } from "./staticServer.ts";
import { HOST, type Target, type TargetCommand } from "./targets.ts";

/** How long a page or a server may take before a sample fails, in milliseconds. */
const SAMPLE_TIMEOUT = 180_000;

/** How often a starting server is asked whether it answers, in milliseconds. */
const POLL_INTERVAL = 25;

/** The pause between two edits, so one update does not land on the last, in milliseconds. */
const EDIT_PAUSE = 150;

/** How often the server's memory is read, in milliseconds. */
const MEMORY_INTERVAL = 250;

/** A viewport tall enough that a component's stories are all in view, so a lazy frame is not left waiting. */
const TALL_VIEWPORT = { width: 1280, height: 2600 };

/** The size of an ordinary window. */
const VIEWPORT = { width: 1280, height: 900 };

/** The sidebar's last group, in the order every tool sorts them: seen when the whole index arrived. */
const LAST_GROUP = "Overlays";

/** What a measurement works with. */
export type MeasureContext = {
  /** The tool. */
  readonly target: Target;
  /** The project's folder. */
  readonly directory: string;
  /** The browser. */
  readonly browser: Browser;
  /** The port its servers listen on. */
  readonly port: number;
  /** The story and component measured. */
  readonly component: CorpusComponent;
  /** The CPU throttle of the browser, 1 for none. */
  readonly throttle: number;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/** The environment a target's command runs in: the script's, with the target's additions. */
const environment = (io: ScriptIo, command: TargetCommand): NodeJS.ProcessEnv => ({
  ...io.env,
  BROWSER: "none",
  ...command.env
});

/** Runs a target's command to its end. */
const runCommand = async (context: MeasureContext, command: TargetCommand): Promise<void> => {
  const program = join(context.directory, "node_modules", ".bin", command.bin);
  await exec(program, [...command.args], {
    cwd: context.directory,
    env: environment(context.io, command),
    io: context.io,
    output: "capture",
    timeoutMs: SAMPLE_TIMEOUT * 3
  });
};

/** A dev server, in a process group of its own, so stopping it stops whatever it started. */
const startServer = (context: MeasureContext): ChildProcess => {
  const command = context.target.dev(context.port);
  return spawn(join(context.directory, "node_modules", ".bin", command.bin), [...command.args], {
    cwd: context.directory,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: environment(context.io, command)
  });
};

/** Stops a server and waits for it to be gone, so the next one finds the port free. */
const stopServer = (server: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    if (server.exitCode !== null || server.pid === undefined) {
      resolve();
      return;
    }
    server.once("exit", () => resolve());
    process.kill(-server.pid, "SIGKILL");
  });

/** Waits until a server answers, however it answers; one that dies fails at once, with no timeout to sit through. */
const waitForServer = async (server: ChildProcess, address: string): Promise<void> => {
  const deadline = performance.now() + SAMPLE_TIMEOUT;
  while (performance.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`the server stopped with code ${server.exitCode}`);
    const hasAnswered = await fetch(address).then(
      () => true,
      () => false
    );
    if (hasAnswered) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  throw new Error(`nothing answered at ${address}`);
};

/** A clean browser context with its page, throttled when asked. */
const openPage = async (
  context: MeasureContext,
  viewport: { readonly width: number; readonly height: number }
): Promise<{ readonly browserContext: BrowserContext; readonly page: Page }> => {
  const browserContext = await context.browser.newContext({ viewport });
  const page = await browserContext.newPage();
  page.setDefaultTimeout(SAMPLE_TIMEOUT);
  if (context.throttle > 1) {
    const session = await browserContext.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: context.throttle });
  }
  return { browserContext, page };
};

/** The address of a server of this context. */
const baseOf = (context: MeasureContext): string => `http://${HOST}:${context.port}/`;

/** Removes the tool's caches, as a first start finds them. */
const removeCaches = async ({ target, directory }: MeasureContext): Promise<void> => {
  await Promise.all(
    target.caches.map((cache) => rm(join(directory, cache), { recursive: true, force: true }))
  );
};

/** One start of the dev server: spawned → the story on screen, and → the sidebar's last group. */
export type StartSample = {
  /** Spawned → the first story visible, in milliseconds. */
  readonly story: number;
  /** Spawned → the sidebar's last group visible, in milliseconds. */
  readonly sidebar: number;
};

/**
 * Starts the dev server once and times it.
 *
 * @param context - the measurement's context.
 * @param isCold - whether the caches are removed first.
 */
export const measureStart = async (context: MeasureContext, isCold: boolean): Promise<StartSample> => {
  if (isCold) await removeCaches(context);
  const { browserContext, page } = await openPage(context, VIEWPORT);
  const start = performance.now();
  const server = startServer(context);
  try {
    await waitForServer(server, baseOf(context));
    const seen = async (wait: Promise<void>): Promise<number> => {
      await wait;
      return performance.now() - start;
    };
    const navigation = page.goto(context.target.storyUrl(baseOf(context), context.component));
    const [story, sidebar] = await Promise.all([
      seen(context.target.inStory(page, '[data-bench="label"]').waitFor({ state: "visible" })),
      seen(page.getByText(LAST_GROUP, { exact: true }).first().waitFor({ state: "visible" })),
      navigation
    ]);
    return { story, sidebar };
  } finally {
    await browserContext.close();
    await stopServer(server);
  }
};

/** The kind of file an edit touches. */
export type EditKind = "story" | "component";

/**
 * Edits a file again and again and times the new text reaching the page.
 *
 * @param context - the measurement's context.
 * @param kind - which file is edited.
 * @param edits - how many edits.
 * @returns the milliseconds of each edit; the file is put back afterwards.
 */
export const measureEdits = async (
  context: MeasureContext,
  kind: EditKind,
  edits: number
): Promise<number[]> => {
  const { name } = context.component;
  const file = join(
    context.directory,
    "src/components",
    kind === "story" ? `${name}.stories.tsx` : `${name}.tsx`
  );
  const original = await readFile(file, "utf8");
  const before = kind === "story" ? /label: "[^"]*"/ : /const BUILD = "[^"]*"/;
  const selector = kind === "story" ? '[data-bench="label"]' : '[data-bench="build"]';
  const server = startServer(context);
  const { browserContext, page } = await openPage(context, VIEWPORT);
  try {
    await waitForServer(server, baseOf(context));
    await page.goto(context.target.storyUrl(baseOf(context), context.component));
    await context.target.inStory(page, selector).waitFor({ state: "visible" });
    const samples: number[] = [];
    for (let edit = 0; edit < edits; edit += 1) {
      const text = `edit ${edit}`;
      const replacement = kind === "story" ? `label: "${text}"` : `const BUILD = "${text}"`;
      const start = performance.now();
      await writeFile(file, original.replace(before, replacement));
      await context.target.inStory(page, `${selector}:text-is("${text}")`).waitFor();
      samples.push(performance.now() - start);
      await new Promise((resolve) => setTimeout(resolve, EDIT_PAUSE));
    }
    return samples;
  } finally {
    await writeFile(file, original);
    await browserContext.close();
    await stopServer(server);
  }
};

/** How many of the corpus's stories are drawn in the page, in all its frames. */
const drawnStories = async (page: Page): Promise<number> => {
  const counts = await Promise.all(
    page.frames().map((frame) =>
      frame
        .locator('[data-bench="label"]')
        .count()
        .catch(() => 0)
    )
  );
  return counts.reduce((sum, count) => sum + count, 0);
};

/** One visit to a component's page. */
export type PageSample = {
  /** Opened → every story drawn, in milliseconds. */
  readonly stories: number;
  /** Opened → the table of props visible, in milliseconds; none where the tool has none. */
  readonly props: number | undefined;
};

/**
 * Opens a component's page on a fresh server, so the first request wakes whatever waits for one, and times it.
 *
 * @param context - the measurement's context.
 * @param address - the page's address.
 */
export const measureComponentPage = async (context: MeasureContext, address: string): Promise<PageSample> => {
  const server = startServer(context);
  const { browserContext, page } = await openPage(context, TALL_VIEWPORT);
  try {
    await waitForServer(server, baseOf(context));
    const start = performance.now();
    const navigation = page.goto(address);
    const allDrawn = (async (): Promise<number> => {
      while ((await drawnStories(page)) < context.component.stories.length) {
        if (performance.now() - start > SAMPLE_TIMEOUT) throw new Error("the stories were never all drawn");
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
      return performance.now() - start;
    })();
    const table = context.target.propsTable?.(page);
    const props = table?.waitFor({ state: "visible" }).then(() => performance.now() - start);
    const [stories, propsTime] = await Promise.all([allDrawn, props, navigation]);
    return { stories, props: propsTime };
  } finally {
    await browserContext.close();
    await stopServer(server);
  }
};

/**
 * The dev server's process tree's memory now, in bytes.
 *
 * @param rootPid - the server's process.
 * @param io - the script's streams.
 */
const treeMemory = async (rootPid: number, io: ScriptIo): Promise<number> => {
  const { stdout } = await exec("ps", ["-A", "-o", "pid=,ppid=,rss="], { io, output: "capture" });
  const rows = stdout
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number));
  const tree = new Set([rootPid]);
  let isGrowing = true;
  while (isGrowing) {
    isGrowing = false;
    for (const [pid = 0, parent = 0] of rows) {
      if (tree.has(parent) && !tree.has(pid)) {
        tree.add(pid);
        isGrowing = true;
      }
    }
  }
  return rows.reduce((sum, [pid = 0, , rss = 0]) => (tree.has(pid) ? sum + rss * 1024 : sum), 0);
};

/**
 * The dev server's peak memory across a start and a visit to a page.
 *
 * @remarks
 * A run of its own, since reading `ps` in a loop would disturb a timing.
 *
 * @param context - the measurement's context.
 * @param address - the page visited.
 * @returns the peak resident memory of the server's tree, in bytes.
 */
export const measureMemory = async (context: MeasureContext, address: string): Promise<number> => {
  const server = startServer(context);
  const { browserContext, page } = await openPage(context, TALL_VIEWPORT);
  let peak = 0;
  let isDone = false;
  const pid = server.pid;
  if (pid === undefined) throw new Error("the server did not start");
  const sampling = (async (): Promise<void> => {
    while (!isDone) {
      peak = Math.max(peak, await treeMemory(pid, context.io));
      await new Promise((resolve) => setTimeout(resolve, MEMORY_INTERVAL));
    }
  })();
  try {
    await waitForServer(server, baseOf(context));
    await page.goto(address);
    await page.waitForLoadState("networkidle");
    await new Promise((resolve) => setTimeout(resolve, MEMORY_INTERVAL * 4));
    return peak;
  } finally {
    isDone = true;
    await sampling;
    await browserContext.close();
    await stopServer(server);
  }
};

/** One build. */
export type BuildSample = {
  /** Its time, in milliseconds. */
  readonly time: number;
  /** The size of its output on disk, in bytes. */
  readonly size: number;
};

/** The folder a build writes to, from the project's root. */
const BUILD_FOLDER = "bench-build";

/**
 * Builds the catalogue from nothing.
 *
 * @param context - the measurement's context.
 */
export const measureBuild = async (context: MeasureContext): Promise<BuildSample> => {
  const out = join(context.directory, BUILD_FOLDER);
  await rm(out, { recursive: true, force: true });
  const start = performance.now();
  await runCommand(context, context.target.build(BUILD_FOLDER));
  const time = performance.now() - start;
  return { time, size: await diskUsage(out) };
};

/** The script a first load fetched, gzipped. */
export type LoadSample = {
  /** JavaScript fetched by the top page, in bytes. */
  readonly shell: number;
  /** JavaScript fetched by the frames, in bytes; none where stories draw in the page itself. */
  readonly frame: number | undefined;
};

/**
 * Serves the last build and counts the JavaScript a first load fetches until the story is on screen.
 *
 * @param context - the measurement's context.
 */
export const measureFirstLoad = async (context: MeasureContext): Promise<LoadSample> => {
  const server = await serveStatic(join(context.directory, BUILD_FOLDER), HOST, context.port);
  const { browserContext, page } = await openPage(context, VIEWPORT);
  const main = new Set<string>();
  const frames = new Set<string>();
  let hasFrame = false;
  page.on("request", (request) => {
    if (request.frame() !== page.mainFrame()) hasFrame = true;
    if (request.resourceType() !== "script") return;
    const path = new URL(request.url()).pathname;
    (request.frame() === page.mainFrame() ? main : frames).add(path);
  });
  try {
    await page.goto(context.target.storyUrl(server.base, context.component));
    await context.target.inStory(page, '[data-bench="label"]').waitFor({ state: "visible" });
    await page.waitForLoadState("load");
    const total = (paths: ReadonlySet<string>): number =>
      [...paths].reduce((sum, path) => sum + server.gzippedSize(path), 0);
    return { shell: total(main), frame: hasFrame ? total(frames) : undefined };
  } finally {
    await browserContext.close();
    await server.close();
  }
};
