/**
 * The measurements: each one a definition in a real browser, the same for every tool.
 *
 * @remarks
 * A browser decides every time, since "server ready" is not "usable": a tool can print its address and then rebuild
 * its dependencies and reload the page. The times come from the page itself (`stamps.ts`). Every sample starts a new
 * browser context, with nothing cached. Status lines are written by the caller between samples, never during one.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { isAbsolute, join } from "node:path";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Browser, BrowserContext, Page } from "@playwright/test";

import { contentSize } from "./diskUsage.ts";
import { stampScript, waitForStamps } from "./stamps.ts";
import { serveStatic } from "./staticServer.ts";
import type { EditKind, MeasureSubject } from "./subject.ts";
import { HOST, type Target, type TargetCommand } from "./targets.ts";

/** How long a page or a server may take before a sample fails, in milliseconds. */
const SAMPLE_TIMEOUT = 180_000;

/** How often a starting server is asked whether it answers, in milliseconds. */
const POLL_INTERVAL = 25;

/** The pause between two edits, so one update does not land on the last, in milliseconds. */
const EDIT_PAUSE = 150;

/** How long a page has to stay unchanged after a story shows, or a reload could replace it, in milliseconds. */
const SETTLE = 1500;

/** How long a page may take to go quiet, in milliseconds: some never do, and that must not cost the metric. */
const QUIET_TIMEOUT = 30_000;

/** How often the server's memory is read, in milliseconds. */
const MEMORY_INTERVAL = 250;

/** A word every generated component holds, so the first search reads the whole index. */
const SEARCH_WORDS = "widget";

/** A viewport tall enough that a component's stories are all in view, so a lazy frame is not left waiting. */
const TALL_VIEWPORT = { width: 1280, height: 2600 };

/** The size of an ordinary window. */
const VIEWPORT = { width: 1280, height: 900 };

/** The servers alive now, so an interrupted run leaves none behind to answer for the next. */
const liveServers = new Set<ChildProcess>();

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
  readonly subject: MeasureSubject;
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

/** A command's program: in the project's `node_modules/.bin`, unless the target names it in full. */
const programOf = (context: Pick<MeasureContext, "directory">, command: TargetCommand): string =>
  isAbsolute(command.bin) ? command.bin : join(context.directory, "node_modules", ".bin", command.bin);

/** Whether something already listens on a port. */
const isPortTaken = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host: HOST, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

/**
 * A dev server, in a process group of its own, so stopping it stops whatever it started.
 *
 * @throws when the port is taken: what answered there would pass for this server, with a time near zero.
 */
export const startServer = async (context: MeasureContext): Promise<ChildProcess> => {
  if (await isPortTaken(context.port)) throw new Error(`port ${context.port} is already taken`);
  const command = context.target.dev(context.port);
  const server = spawn(programOf(context, command), [...command.args], {
    cwd: context.directory,
    detached: true,
    stdio: "ignore",
    env: environment(context.io, command)
  });
  liveServers.add(server);
  return server;
};

/** Whether a server's process has ended, by its own exit or a signal. */
const hasEnded = (server: ChildProcess): boolean => server.exitCode !== null || server.signalCode !== null;

/** Stops a server and waits for it to be gone, so the next one finds the port free. */
export const stopServer = (server: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    liveServers.delete(server);
    if (hasEnded(server) || server.pid === undefined) {
      resolve();
      return;
    }
    server.once("exit", () => resolve());
    process.kill(-server.pid, "SIGKILL");
  });

/** Stops every server alive, when a run is interrupted. */
export const stopAllServers = async (): Promise<void> => {
  await Promise.all([...liveServers].map(stopServer));
};

/** The address of a server of this context. */
export const baseOf = (context: Pick<MeasureContext, "port">): string => `http://${HOST}:${context.port}/`;

/** Waits until a server answers, however it answers; one that dies fails at once, with no timeout to sit through. */
export const waitForServer = async (server: ChildProcess, address: string): Promise<void> => {
  const deadline = Date.now() + SAMPLE_TIMEOUT;
  while (Date.now() < deadline) {
    if (hasEnded(server)) throw new Error(`the server stopped (${server.exitCode ?? server.signalCode})`);
    const hasAnswered = await fetch(address).then(
      () => true,
      () => false
    );
    if (hasAnswered) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  throw new Error(`nothing answered at ${address}`);
};

/** A clean browser context with its page, stamping, throttled when asked. */
const openPage = async (
  context: MeasureContext,
  viewport: { readonly width: number; readonly height: number }
): Promise<{ readonly browserContext: BrowserContext; readonly page: Page }> => {
  const browserContext = await context.browser.newContext({ viewport });
  await browserContext.addInitScript({
    content: stampScript({
      texts: [context.subject.sidebar],
      selectors: context.target.propsTable === undefined ? [] : [context.target.propsTable],
      ...context.subject.watch
    })
  });
  const page = await browserContext.newPage();
  page.setDefaultTimeout(SAMPLE_TIMEOUT);
  if (context.throttle > 1) {
    const session = await browserContext.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: context.throttle });
  }
  return { browserContext, page };
};

/**
 * The stamps of keys once the page stopped replacing itself: a document that reloads later starts them over, and the
 * draw a person keeps is the last one.
 */
const settledStamps = async (page: Page, keys: readonly string[], deadline: number): Promise<number[]> => {
  let times = await waitForStamps(page, keys, deadline);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, SETTLE));
    const again = await waitForStamps(page, keys, deadline);
    if (again.join() === times.join()) return times;
    times = again;
  }
};

/** Waits for the network to go quiet, for as long as it is worth waiting: a page that keeps asking is measured as it is. */
const quiet = async (page: Page): Promise<void> => {
  await page.waitForLoadState("networkidle", { timeout: QUIET_TIMEOUT }).catch(() => undefined);
};

/** Removes the tool's caches, as a first start finds them. */
const removeCaches = async ({ target, directory }: MeasureContext): Promise<void> => {
  await Promise.all(
    target.caches.map((cache) => rm(join(directory, cache), { recursive: true, force: true }))
  );
};

/** One start of the dev server: spawned → the story on screen, and → the sidebar's last group. */
export type StartSample = {
  /** Spawned → the first story drawn, in milliseconds. */
  readonly story: number;
  /** Spawned → the sidebar's last group drawn, in milliseconds. */
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
  const start = Date.now();
  const server = await startServer(context);
  try {
    await waitForServer(server, baseOf(context));
    await page.goto(context.subject.storyAddress(baseOf(context)));
    const keys = [context.subject.storyKey, context.subject.sidebar];
    const [story = 0, sidebar = 0] = await settledStamps(page, keys, start + SAMPLE_TIMEOUT);
    return { story: story - start, sidebar: sidebar - start };
  } finally {
    await browserContext.close();
    await stopServer(server);
  }
};

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
  const { file, text, mark } = context.subject.edit(kind);
  const original = await readFile(file, "utf8");
  const { browserContext, page } = await openPage(context, VIEWPORT);
  const server = await startServer(context);
  try {
    await waitForServer(server, baseOf(context));
    await page.goto(context.subject.storyAddress(baseOf(context)));
    await settledStamps(page, [context.subject.storyKey], Date.now() + SAMPLE_TIMEOUT);
    const samples: number[] = [];
    for (let edit = 0; edit < edits; edit += 1) {
      const shown = mark(edit);
      const start = Date.now();
      await writeFile(file, text(original, shown));
      const [drawn = 0] = await waitForStamps(page, [shown], start + SAMPLE_TIMEOUT);
      samples.push(drawn - start);
      await new Promise((resolve) => setTimeout(resolve, EDIT_PAUSE));
    }
    return samples;
  } finally {
    await writeFile(file, original);
    await browserContext.close();
    await stopServer(server);
  }
};

/** One visit to a component's page. */
export type PageSample = {
  /** Opened → every story drawn, in milliseconds. */
  readonly stories: number;
  /** Opened → the table of props drawn, in milliseconds; none where the tool has none. */
  readonly props: number | undefined;
};

/**
 * Opens a component's page on a fresh server, so the first request wakes whatever waits for one, and times it.
 *
 * @param context - the measurement's context.
 * @param address - the page's address.
 */
export const measureComponentPage = async (context: MeasureContext, address: string): Promise<PageSample> => {
  const { browserContext, page } = await openPage(context, TALL_VIEWPORT);
  const server = await startServer(context);
  try {
    await waitForServer(server, baseOf(context));
    const start = Date.now();
    await page.goto(address);
    // by text and not by count: a tool may draw a story twice, which must not stand in for one still missing
    const labels = context.subject.pageKeys;
    const table = context.target.propsTable;
    const keys = table === undefined ? labels : [...labels, table];
    const times = await settledStamps(page, keys, start + SAMPLE_TIMEOUT);
    const props = table === undefined ? undefined : times.at(-1);
    return {
      stories: Math.max(...times.slice(0, labels.length)) - start,
      props: props === undefined ? undefined : props - start
    };
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
 * A run of its own, since reading `ps` in a loop would disturb a timing. Resident memory summed over the process tree,
 * so pages shared between processes count more than once: a tool of several processes reads a little high.
 *
 * @param context - the measurement's context.
 * @param address - the page visited.
 * @param isCold - whether the tool's caches are removed first, as a first start finds them.
 * @returns the peak, in bytes.
 */
export const measureMemory = async (
  context: MeasureContext,
  address: string,
  isCold = false
): Promise<number> => {
  if (isCold) await removeCaches(context);
  const { browserContext, page } = await openPage(context, TALL_VIEWPORT);
  const server = await startServer(context);
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
    await quiet(page);
    await new Promise((resolve) => setTimeout(resolve, SETTLE * 2));
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
  /** The bytes of its output. */
  readonly size: number;
};

/** The folder a build writes to, from the project's root. */
const BUILD_FOLDER = "bench-build";

/**
 * Builds the catalogue from nothing: no output and no cache.
 *
 * @param context - the measurement's context.
 */
export const measureBuild = async (context: MeasureContext): Promise<BuildSample> => {
  const out = join(context.directory, BUILD_FOLDER);
  await rm(out, { recursive: true, force: true });
  await removeCaches(context);
  const command = context.target.build(BUILD_FOLDER);
  const start = Date.now();
  await exec(programOf(context, command), [...command.args], {
    cwd: context.directory,
    env: environment(context.io, command),
    io: context.io,
    output: "capture",
    timeoutMs: SAMPLE_TIMEOUT * 3
  });
  return { time: Date.now() - start, size: await contentSize(out) };
};

/** The script a first load fetched, gzipped. */
export type LoadSample = {
  /** JavaScript fetched by the top page, in bytes. */
  readonly shell: number;
  /** JavaScript fetched by the frames, in bytes; none where stories draw in the page itself. */
  readonly frame: number | undefined;
  /** JavaScript fetched in all, each file once, in bytes: a file both sides fetch counts in both columns. */
  readonly total: number;
  /** JavaScript the first search then fetches, in bytes; none where a tool's search loads with its page. */
  readonly search: number | undefined;
};

/**
 * Serves the last build and counts the JavaScript a first load fetches once the network went quiet, then what the first
 * search adds: the list's code and the index, which nobody who never searches pays for.
 *
 * @param context - the measurement's context.
 */
export const measureFirstLoad = async (context: MeasureContext): Promise<LoadSample> => {
  const server = await serveStatic(join(context.directory, BUILD_FOLDER), HOST, context.port);
  const { browserContext, page } = await openPage(context, VIEWPORT);
  const main = new Set<string>();
  const frames = new Set<string>();
  // what was served: a library's page may ask for a script its build does not hold, which fetched nothing
  page.on("response", (response) => {
    const request = response.request();
    if (request.resourceType() !== "script" || !response.ok()) return;
    const path = new URL(request.url()).pathname;
    (request.frame() === page.mainFrame() ? main : frames).add(path);
  });
  try {
    await page.goto(context.subject.storyAddress(server.base));
    await waitForStamps(page, [context.subject.storyKey], Date.now() + SAMPLE_TIMEOUT);
    await quiet(page);
    const total = (paths: ReadonlySet<string>): number =>
      [...paths].reduce((sum, path) => sum + server.gzippedSize(path), 0);
    const first = {
      shell: total(main),
      frame: page.frames().length > 1 ? total(frames) : undefined,
      total: total(new Set([...main, ...frames]))
    };
    const { search } = context.target;
    if (search === undefined) return { ...first, search: undefined };
    const loaded = new Set(main);
    await page.locator(search.field).fill(SEARCH_WORDS);
    await page.locator(search.ready).waitFor({ timeout: SAMPLE_TIMEOUT });
    return { ...first, search: total(new Set([...main].filter((path) => !loaded.has(path)))) };
  } finally {
    await browserContext.close();
    await server.close();
  }
};
