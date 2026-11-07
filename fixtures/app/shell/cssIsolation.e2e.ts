/**
 * What a story's global CSS reaches: a story file that styles `body`, `button` and the root draws only its own frame,
 * never another story's, the catalogue's page or another frame on the same docs page, on the dev server and in a static
 * build. And what a static build's default of one origin means: no style crosses, but a story's script can reach the
 * catalogue's page, where the dev server's frames cannot, nor a build's that names the frames' origin.
 *
 * @remarks
 * Every story draws in a document of its own, and the shell opens another story by loading another page, so a sheet a
 * story file imports dies with its frame. Its repository lives under `test-results`, inside the fixture so the project's
 * packages resolve; no test opens the suite's dev server.
 *
 * @module
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { connect, createServer as createNetServer } from "node:net";
import { extname, join } from "node:path";

import { expect, type FrameLocator, type Locator, test } from "@playwright/test";

/** The fixture's folder, whose packages the catalogue resolves. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

const CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Isolation",
  stories: ["src/*.stories.tsx"],
  docs: ["docs/*.md"]
});
`;

/** A sheet as global as a sheet gets: the document, every button, a custom property on the root. */
const LOUD_CSS = `body { background-color: rgb(255, 0, 0); }
button { color: rgb(255, 0, 0); }
:root { --leak: leaked; }
`;

const LOUD = `import "./loud.css";

export default { title: "Isolation/Loud" };

export const Default = { render: () => <button type="button">Loud</button> };
`;

const QUIET = `/** Whether this frame's script can read the page that framed it. */
const reach = (): string => {
  try {
    return window.parent.document.title === undefined ? "blocked" : "reached";
  } catch {
    return "blocked";
  }
};

export default { title: "Isolation/Quiet" };

export const Default = { render: () => <button type="button">Quiet</button> };

export const Reach = { render: () => <output>{reach()}</output> };
`;

const PAGE = `---
title: Guides/Both
---

# Both

\`\`\`story stories:isolation-loud--default
\`\`\`

\`\`\`story stories:isolation-quiet--default
\`\`\`
`;

/** A story's id in this catalogue. */
const storyId = (component: string, name: string): string => `stories:isolation-${component}--${name}`;

/** What a page's document says of its styles: the body's background, a button's colour, the root's property. */
type DocumentStyle = { readonly background: string; readonly button: string; readonly leak: string };

/** What the loud sheet does to a document. */
const LOUD_STYLE: DocumentStyle = { background: "rgb(255, 0, 0)", button: "rgb(255, 0, 0)", leak: "leaked" };

/** A document's style, read in its own window. */
const styleIn = (root: Locator): Promise<DocumentStyle> =>
  root.evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    const button = element.ownerDocument.querySelector("button");
    if (view === null) throw new Error("The document has no window");
    return {
      background: view.getComputedStyle(element.ownerDocument.body).backgroundColor,
      button: button === null ? "" : view.getComputedStyle(button).color,
      leak: view.getComputedStyle(element).getPropertyValue("--leak").trim()
    };
  });

/** A frame's style, once its story is drawn. */
const frameStyle = async (frame: FrameLocator): Promise<DocumentStyle> => {
  await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "ready", { timeout: 30_000 });
  return styleIn(frame.locator("html"));
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

/** The content types the static server gives. */
const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml"
};

/** Serves a folder as a plain static host does, on one origin. */
const serveFolder = (root: string, port: number): Promise<Server> =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://here").pathname;
      const file = join(root, path.endsWith("/") ? `${path}index.html` : path);
      if (!file.startsWith(root) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      response.end(readFileSync(file));
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });

/** The checks both servings share: the catalogue's address, and whether the frames have an origin of their own. */
const isolationChecks = (where: () => string, isOwnOrigin: boolean): void => {
  test("the loud story draws its own frame red, as asked", async ({ page }) => {
    await page.goto(`${where()}/?story=${storyId("loud", "default")}`);
    expect(await frameStyle(page.frameLocator("iframe.forgebook-frame-view"))).toEqual(LOUD_STYLE);
  });

  test("after the loud story, the next story's frame and the catalogue's page are untouched", async ({
    page
  }) => {
    await page.goto(`${where()}/?story=${storyId("loud", "default")}`);
    const frame = page.frameLocator("iframe.forgebook-frame-view");
    expect(await frameStyle(frame)).toEqual(LOUD_STYLE);
    // the component's page, its frames loaded where the loud story's was
    await page.getByRole("link", { name: "Quiet" }).first().click();
    const quiet = await frameStyle(page.frameLocator('iframe[title="Quiet: Default"]'));
    expect(quiet.leak).toBe("");
    expect(quiet.background).not.toBe(LOUD_STYLE.background);
    expect(quiet.button).not.toBe(LOUD_STYLE.button);
    const shell = await styleIn(page.locator("html"));
    expect(shell.leak).toBe("");
    expect(shell.background).not.toBe(LOUD_STYLE.background);
  });

  test("on one docs page, the loud frame keeps its sheet to itself", async ({ page }) => {
    await page.goto(`${where()}/?page=stories:guides-both`);
    const frames = page.locator("iframe.forgebook-frame-view");
    await expect(frames).toHaveCount(2, { timeout: 30_000 });
    const loud = page.frameLocator('iframe[title="Loud: Default"]');
    const quiet = page.frameLocator('iframe[title="Quiet: Default"]');
    expect(await frameStyle(loud)).toEqual(LOUD_STYLE);
    const quietStyle = await frameStyle(quiet);
    expect(quietStyle.leak).toBe("");
    expect(quietStyle.button).not.toBe(LOUD_STYLE.button);
    expect((await styleIn(page.locator("html"))).background).not.toBe(LOUD_STYLE.background);
  });

  test(
    isOwnOrigin
      ? "a story's script cannot reach the catalogue's page"
      : "a story's script reaches the catalogue's page: one origin keeps styles apart, not scripts",
    async ({ page }) => {
      await page.goto(`${where()}/?story=${storyId("quiet", "reach")}`);
      const frame = page.frameLocator("iframe.forgebook-frame-view");
      await expect(frame.locator("output")).toHaveText(isOwnOrigin ? "blocked" : "reached", {
        timeout: 30_000
      });
    }
  );
};

test.describe("a story's global CSS", () => {
  test.describe.configure({ mode: "serial" });
  let dir = "";

  test.beforeAll(() => {
    const parent = join(APP, "test-results");
    mkdirSync(parent, { recursive: true });
    dir = mkdtempSync(join(parent, "css-isolation-"));
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "forgebook.config.ts"), CONFIG);
    // a package of its own, so its dev server keeps Vite's cache in it: with none, Vite takes the fixture app's
    // `node_modules/.vite`, and the suite's own server of the app loses the dependencies it prepared there
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "css-isolation", private: true, type: "module" })
    );
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
    writeFileSync(join(dir, "src", "loud.css"), LOUD_CSS);
    writeFileSync(join(dir, "src", "Loud.stories.tsx"), LOUD);
    writeFileSync(join(dir, "src", "Quiet.stories.tsx"), QUIET);
    writeFileSync(join(dir, "docs", "both.md"), PAGE);
  });

  test.afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test.describe("on the dev server", () => {
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

    isolationChecks(() => origin, true);
  });

  test.describe("in a static build, on one origin as it ships", () => {
    let origin = "";
    let server: Server | undefined;

    test.beforeAll(async () => {
      test.setTimeout(180_000);
      const built = spawnSync(process.execPath, [ENTRY, "build"], {
        cwd: dir,
        encoding: "utf8",
        timeout: 170_000
      });
      expect(built.status, built.stderr).toBe(0);
      const port = await freePort();
      server = await serveFolder(join(dir, "dist"), port);
      origin = `http://127.0.0.1:${port}`;
    });

    test.afterAll(() => {
      server?.close();
    });

    isolationChecks(() => origin, false);
  });

  test.describe("in a static build with the frames' origin named", () => {
    let origin = "";
    const servers: Server[] = [];

    test.beforeAll(async () => {
      test.setTimeout(180_000);
      const [port, framePort] = [await freePort(), await freePort()];
      origin = `http://127.0.0.1:${port}`;
      const frames = `{ origins: { catalogue: "${origin}", frames: "http://127.0.0.1:${framePort}" } }`;
      const config = CONFIG.replace('docs: ["docs/*.md"]', `docs: ["docs/*.md"],\n  frames: ${frames}`);
      writeFileSync(join(dir, "forgebook.origins.config.ts"), config);
      const built = spawnSync(
        process.execPath,
        [ENTRY, "build", "--config", "forgebook.origins.config.ts", "--out", "dist-origins"],
        { cwd: dir, encoding: "utf8", timeout: 170_000 }
      );
      expect(built.status, built.stderr).toBe(0);
      // the same files from two hosts, as the README asks of a site that names both
      for (const each of [port, framePort]) servers.push(await serveFolder(join(dir, "dist-origins"), each));
    });

    test.afterAll(() => {
      for (const server of servers) server.close();
    });

    isolationChecks(() => origin, true);
  });
});
