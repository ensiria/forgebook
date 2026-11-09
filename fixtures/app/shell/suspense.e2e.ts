/**
 * What a story still loading means on a real browser: a frame waits for a `Suspense` boundary it did not write before it
 * says the story is ready, so `check`, `verify` and `shot` read the content and never a fallback, and one it gave up on
 * is never read as passed. On a small React catalogue of its own, with a contrast defect only in the loaded content.
 *
 * @remarks
 * Its repository lives under `test-results`, inside the fixture so the project's packages resolve; no test opens the
 * suite's dev server. A production build is covered too, since what the frame reads is React's own tree.
 *
 * @module
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { connect, createServer as createNetServer } from "node:net";
import { extname, join } from "node:path";

import { expect, type Page, test } from "@playwright/test";

/** The fixture's folder, whose packages the catalogue resolves. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

const CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: react(), title: "Late", stories: ["src/*.stories.tsx"] });
`;

const TABLE = `export const Table = ({ tone = "#1c1b1b" }: { readonly tone?: string }) => (
  <table style={{ color: tone, background: "#ffffff" }}>
    <tbody><tr><td data-testid="content">Forty invented rows</td></tr></tbody>
  </table>
);
`;

const STORIES = `import { lazy, Suspense, use } from "react";

import { Table } from "./Table";

const later = <TValue,>(value: TValue): Promise<TValue> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 150));
const Loading = () => <p>Loading the table</p>;
const Clean = lazy(() => later({ default: () => <Table /> }));
const Faint = lazy(() => later({ default: () => <Table tone="#f4f4f4" /> }));
const words = later("#f4f4f4");
const FaintByUse = () => <Table tone={use(words)} />;
const Never = lazy(() => new Promise<{ default: () => null }>(() => undefined));
const stuck = () => (
  <section>
    <Suspense fallback={<Loading />}>
      <Never />
    </Suspense>
  </section>
);

export default { title: "Data/Table", component: Table };

export const CleanLazy = {
  render: () => <section><Suspense fallback={<Loading />}><Clean /></Suspense></section>,
  play: ({ canvasElement }: { readonly canvasElement: HTMLElement }) => {
    if (canvasElement.querySelector("[data-testid=content]") === null) throw new Error("The play read the fallback");
  }
};
export const FaintLazy = {
  render: () => <section><Suspense fallback={<Loading />}><Faint /></Suspense></section>
};
export const FaintUse = {
  render: () => <section><Suspense fallback={<Loading />}><FaintByUse /></Suspense></section>
};
export const Stuck = { render: stuck, parameters: { suspense: { timeout: 800 } } };
export const LoadingState = {
  render: stuck,
  parameters: { suspense: { expected: true } },
  play: ({ canvasElement }: { readonly canvasElement: HTMLElement }) => {
    if (!canvasElement.textContent?.includes("Loading")) throw new Error("The play did not find the fallback");
  }
};
`;

/**
 * A part a story imports once it is drawn, with no `Suspense` around it: a placeholder that passes every check until the
 * module comes, and the part, or what the story shows when the module fails, each with a contrast defect a check finds
 * only once the frame waited.
 */
const LATE = `import { type ComponentType, useEffect, useState } from "react";

export const Late = ({ load }: { readonly load: () => Promise<{ readonly Part: ComponentType }> }) => {
  const [part, setPart] = useState<{ readonly Part: ComponentType } | "failed">();
  useEffect(() => {
    load().then((loaded) => setPart(loaded), () => setPart("failed"));
  }, [load]);
  if (part === undefined) return <p style={{ color: "#1c1b1b", background: "#ffffff" }}>Loading the chart</p>;
  if (part === "failed") return <p style={{ color: "#f4f4f4", background: "#ffffff" }}>The chart could not load</p>;
  return <part.Part />;
};
`;

/** The part, a module that takes a while, as a chart's long-series chunk does. */
const FAINT_PART = `await new Promise((resolve) => setTimeout(resolve, 400));

export const Part = () => <p style={{ color: "#f4f4f4", background: "#ffffff" }}>Two thousand invented points</p>;
`;

/** A module that fails once it is loading. */
const BROKEN_PART = `await new Promise((resolve) => setTimeout(resolve, 1500));

throw new Error("The invented chunk failed");
`;

const LATE_STORIES = `import { Late } from "./Late";

const faint = () => import("./FaintPart");
const broken = () => import("./BrokenPart") as Promise<{ readonly Part: () => null }>;

export default { title: "Data/Late", component: Late };

export const LoadedOnDraw = { args: { load: faint } };
export const FailedChunk = { args: { load: broken } };
export const Plain = { render: () => <p style={{ color: "#1c1b1b", background: "#ffffff" }}>Nothing to load</p> };
`;

/** A story's id in this catalogue. */
const storyId = (name: string): string => `stories:data-table--${name}`;

/** A story's id among those that import a part once drawn. */
const lateId = (name: string): string => `stories:data-late--${name}`;

/** The parts of a check's answer these tests read. */
type CheckAnswer = {
  readonly results: readonly {
    readonly notVerified?: string;
    readonly problems: readonly { readonly kind: string; readonly rule?: string }[];
  }[];
};

/** A free port. */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === "string") reject(new Error("The probe has no port"));
        else resolve(address.port);
      });
    });
  });

/** Whether a port takes a connection. */
const isListening = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

/** The frame's status, once it has one. */
const statusOf = async (page: Page): Promise<string | null> => {
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-forgebook-status", /./, { timeout: 20_000 });
  return root.getAttribute("data-forgebook-status");
};

test.describe("a story still loading", () => {
  test.describe.configure({ mode: "serial" });
  let dir = "";

  /** Runs `forgebook` in the catalogue. */
  const forgebook = (...args: readonly string[]): ReturnType<typeof spawnSync> =>
    spawnSync(process.execPath, [ENTRY, ...args], { cwd: dir, encoding: "utf8", timeout: 110_000 });

  /** Checks a story, as an agent does. */
  const check = (
    name: string,
    id: string = storyId(name)
  ): { readonly exit: number | null; readonly answer: CheckAnswer } => {
    const run = forgebook("check", id, "--json", "--url", "http://127.0.0.1:9");
    return { exit: run.status, answer: JSON.parse(String(run.stdout)) };
  };

  test.beforeAll(() => {
    const parent = join(APP, "test-results");
    mkdirSync(parent, { recursive: true });
    dir = mkdtempSync(join(parent, "suspense-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "forgebook.config.ts"), CONFIG);
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n.vite/\ndist/\n");
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true
        },
        include: ["src"]
      })
    );
    writeFileSync(join(dir, "src", "Table.tsx"), TABLE);
    writeFileSync(join(dir, "src", "Table.stories.tsx"), STORIES);
    writeFileSync(join(dir, "src", "Late.tsx"), LATE);
    writeFileSync(join(dir, "src", "FaintPart.tsx"), FAINT_PART);
    writeFileSync(join(dir, "src", "BrokenPart.tsx"), BROKEN_PART);
    writeFileSync(join(dir, "src", "Late.stories.tsx"), LATE_STORIES);
  });

  test.afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  for (const name of ["faint-lazy", "faint-use"]) {
    test(`check reads the content behind a boundary the story wrote: ${name}`, () => {
      test.setTimeout(120_000);
      const { exit, answer } = check(name);
      expect(answer.results[0]?.problems.map((each) => each.rule)).toContain("color-contrast");
      expect(exit).not.toBe(0);
    });
  }

  test("check reads a part the story imported while first drawn, with no Suspense around it", () => {
    test.setTimeout(120_000);
    const { exit, answer } = check("", lateId("loaded-on-draw"));
    expect(answer.results[0]?.notVerified).toBeUndefined();
    expect(answer.results[0]?.problems.map((each) => each.rule)).toContain("color-contrast");
    expect(exit).not.toBe(0);
  });

  test("check reads what a story shows once a module it imported failed, ready and not pending", () => {
    test.setTimeout(120_000);
    const { exit, answer } = check("", lateId("failed-chunk"));
    expect(answer.results[0]?.notVerified).toBeUndefined();
    expect(answer.results[0]?.problems.map((each) => each.rule)).toContain("color-contrast");
    expect(exit).not.toBe(0);
  });

  test("a story with no Suspense and nothing to import is ready and passes", () => {
    test.setTimeout(120_000);
    const { exit, answer } = check("", lateId("plain"));
    expect(answer.results[0]).toMatchObject({ problems: [] });
    expect(answer.results[0]?.notVerified).toBeUndefined();
    expect(exit).toBe(0);
  });

  test("a play finds the content, and a story with nothing wrong passes", () => {
    test.setTimeout(120_000);
    const { exit, answer } = check("clean-lazy");
    expect(answer.results[0]).toMatchObject({ problems: [] });
    expect(answer.results[0]?.notVerified).toBeUndefined();
    expect(exit).toBe(0);
  });

  test("a story that never loads is not verified, never passed", () => {
    test.setTimeout(120_000);
    const { exit, answer } = check("stuck");
    expect(answer.results[0]?.notVerified).toContain("1 React Suspense boundary still shows its fallback");
    expect(answer.results[0]?.notVerified).toContain("after 800 ms");
    expect(exit).not.toBe(0);
  });

  test("a story meant to stay in its fallback says so, and its play reads it", () => {
    test.setTimeout(120_000);
    const { exit, answer } = check("loading-state");
    expect(answer.results[0]).toMatchObject({ problems: [] });
    expect(answer.results[0]?.notVerified).toBeUndefined();
    expect(exit).toBe(0);
  });

  test("a picture of a story that never loads says it is not of the story", () => {
    test.setTimeout(120_000);
    const run = forgebook("shot", storyId("stuck"), "--json", "--url", "http://127.0.0.1:9");
    expect(JSON.parse(String(run.stdout)).shots[0]).toMatchObject({ status: "pending" });
    expect(run.status).not.toBe(0);
  });

  test("verify does not call a change verified on a story that never loads", () => {
    test.setTimeout(120_000);
    const git = (...args: readonly string[]): void => {
      const run = spawnSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
        { cwd: dir, encoding: "utf8" }
      );
      expect(run.status, run.stderr).toBe(0);
    };
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
    writeFileSync(join(dir, "src", "Table.tsx"), TABLE.replace("Forty", "Fifty"));
    const run = forgebook("verify", "--since", "HEAD", "--quick", "--json", "--url", "http://127.0.0.1:9");
    git("checkout", "-q", ".");
    const document = JSON.parse(String(run.stdout));
    expect(document.notVerified.map((each: { readonly storyId: string }) => each.storyId)).toContain(
      storyId("stuck")
    );
    // the faint stories' problems were there before the change: set apart, and the stuck story leaves it not verified
    expect(document.existing.problems).toBeGreaterThan(0);
    expect(document.verdict).toBe("not-verified");
    expect(run.status).not.toBe(0);
  });

  test.describe("in the page", () => {
    let origin = "";
    let stop = (): void => undefined;

    test.beforeAll(async () => {
      test.setTimeout(120_000);
      const port = await freePort();
      const framePort = await freePort();
      const child = spawn(
        process.execPath,
        [ENTRY, "dev", "--port", String(port), "--frame-port", String(framePort), "--host", "127.0.0.1"],
        { cwd: dir, stdio: "ignore" }
      );
      stop = (): void => {
        child.kill();
      };
      await expect.poll(() => isListening(port), { timeout: 60_000 }).toBe(true);
      origin = `http://127.0.0.1:${port}`;
    });

    test.afterAll(() => stop());

    /** The address of a story's frame on the dev server's frames. */
    const frameAddress = (name: string): string => `${origin}/frame.html?story=${storyId(name)}`;

    test("the frame says it gave up, on the page and on its root", async ({ page }) => {
      await page.goto(frameAddress("stuck"));
      expect(await statusOf(page)).toBe("pending");
      await expect(page.locator("html")).toHaveAttribute(
        "data-forgebook-pending-reason",
        /still shows its fallback after 800 ms/
      );
      await expect(page.getByRole("status")).toContainText("Not verified: 1 React Suspense boundary");
    });

    test("a story that loads is ready only with its content in the page", async ({ page }) => {
      await page.goto(frameAddress("clean-lazy"));
      expect(await statusOf(page)).toBe("ready");
      expect(await page.getByTestId("content").count()).toBe(1);
      await expect(page.getByRole("status")).toHaveCount(0);
    });

    test("the Accessibility card does not pass a story that never loaded", async ({ page }) => {
      await page.goto(`${origin}/?story=${storyId("stuck")}&tab=a11y`);
      const frame = page.frameLocator("iframe.forgebook-frame-view");
      await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "pending", {
        timeout: 20_000
      });
      await page.getByRole("button", { name: "Check the story" }).click();
      await expect(page.getByRole("tabpanel")).toContainText("still shows its fallback");
      await expect(page.getByRole("tab", { name: /Accessibility/ })).not.toContainText("passes");
    });

    test("the compare view's frames wait for the same ready", async ({ page }) => {
      await page.goto(`${origin}/?story=${storyId("clean-lazy")}&compare=theme`);
      const frames = page.locator(".forgebook-compare iframe");
      await expect(frames).toHaveCount(4, { timeout: 20_000 });
      for (const index of [0, 1, 2, 3]) {
        const frame = page.frameLocator(".forgebook-compare iframe").nth(index);
        await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "ready", {
          timeout: 20_000
        });
        expect(await frame.getByTestId("content").count()).toBe(1);
      }
    });
  });

  test.describe("in a production build", () => {
    let origin = "";
    let server: Server | undefined;

    test.beforeAll(async () => {
      test.setTimeout(120_000);
      const built = forgebook("build");
      expect(built.status, String(built.stderr)).toBe(0);
      const root = join(dir, "dist");
      const types: Readonly<Record<string, string>> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json"
      };
      server = createServer((request, response) => {
        const path = new URL(request.url ?? "/", "http://here").pathname;
        const file = join(root, path);
        if (!file.startsWith(root) || !existsSync(file)) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
        response.end(readFileSync(file));
      });
      await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("The server has no port");
      origin = `http://127.0.0.1:${address.port}`;
    });

    test.afterAll(() => {
      server?.close();
    });

    test("the frame waits for the same boundaries, and gives up the same way", async ({ page }) => {
      await page.goto(`${origin}/frame.html?story=${storyId("faint-lazy")}`);
      expect(await statusOf(page)).toBe("ready");
      expect(await page.getByTestId("content").count()).toBe(1);
      await page.goto(`${origin}/frame.html?story=${storyId("stuck")}`);
      expect(await statusOf(page)).toBe("pending");
      await page.goto(`${origin}/frame.html?story=${storyId("loading-state")}`);
      expect(await statusOf(page)).toBe("ready");
    });
  });
});
