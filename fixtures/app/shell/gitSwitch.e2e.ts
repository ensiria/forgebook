/**
 * A catalogue's page across `git switch`, with `forgebook dev` running throughout: the branch's stories in the
 * sidebar, a removed one gone, a new folder's shown, a story drawn as the branch writes it, then the same back on the
 * first branch, and an edit after it all drawn, with no restart and no reload by hand.
 *
 * @remarks
 * The catalogue is a repository of its own, made in the system's temporary folder for each run, with the plain HTML
 * fixture's dependencies linked in: a checkout rewrites a repository's files, and the fixtures' files are not to be
 * rewritten. Its server is this spec's, on free ports.
 *
 * @module
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, type Locator, type Page, test } from "@playwright/test";

/** The plain HTML fixture's dependencies, which the repository's catalogue runs on. */
const DEPENDENCIES = join(import.meta.dirname, "..", "..", "html", "node_modules");

/** The `forgebook` command's entry. */
const ENTRY = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "forgebook",
  "bin",
  "forgebook",
  "forgebook.mts"
);

/** A story file: a component with one story, its button saying what it is. */
const storyFile = (title: string, story: string, text: string): string =>
  [
    'import type { Meta, Story } from "@forgebook/html";',
    `export default { title: "${title}" } satisfies Meta;`,
    `export const ${story}: Story = { render: () => \`<p data-testid="said">${text}</p>\` };`,
    ""
  ].join("\n");

/** A free port. */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === "string") reject(new Error("The probe has no port"));
        else resolve(address.port);
      });
    });
  });

/**
 * A repository with two branches: `main` with a button and a card, `other` with the button's story renamed, the card
 * removed and a field in a new folder.
 */
const makeRepository = (): string => {
  const repo = mkdtempSync(join(tmpdir(), "forgebook-switch-"));
  const git = (...args: readonly string[]): void => {
    execFileSync(
      "git",
      ["-c", "commit.gpgsign=false", "-c", "user.name=Test", "-c", "user.email=t@example.com", ...args],
      {
        cwd: repo
      }
    );
  };
  const write = (path: string, text: string): void => {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
  };
  // each package linked on its own, so Vite's cache stays in this repository and not in the fixture's
  mkdirSync(join(repo, "node_modules"));
  for (const name of readdirSync(DEPENDENCIES).filter((each) => !each.startsWith("."))) {
    symlinkSync(join(DEPENDENCIES, name), join(repo, "node_modules", name), "junction");
  }
  write(".gitignore", "node_modules\n");
  write("package.json", '{ "name": "switch", "private": true, "type": "module" }\n');
  write(
    "forgebook.config.ts",
    [
      'import { html } from "@forgebook/html/vite";',
      'import { defineConfig } from "forgebook";',
      'export default defineConfig({ framework: html(), title: "Switch", stories: ["src/**/*.stories.ts"] });',
      ""
    ].join("\n")
  );
  write("src/Button.stories.ts", storyFile("Inputs/Button", "Primary", "main button"));
  write("src/Card.stories.ts", storyFile("Layout/Card", "Plain", "card"));
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "main");
  git("switch", "-q", "-c", "other");
  git("rm", "-q", "src/Card.stories.ts");
  write("src/Button.stories.ts", storyFile("Inputs/Button", "Secondary", "other button"));
  write("src/forms/Field.stories.ts", storyFile("Forms/Field", "Empty", "field"));
  git("add", "-A");
  git("commit", "-q", "-m", "other");
  git("switch", "-q", "main");
  return repo;
};

/** The sidebar's groups, once they say exactly these. */
const expectGroups = async (sidebar: Locator, shown: string, gone: string): Promise<void> => {
  await expect(sidebar.getByText(shown, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(sidebar.getByText(gone, { exact: true })).toHaveCount(0, { timeout: 20_000 });
};

/** The stories the agents' API lists, as `forgebook stories` and the MCP server read them. */
const listedStories = async (origin: string): Promise<string> => {
  const text = await (await fetch(`${origin}/__forgebook/api/stories`)).text();
  // each story's id once, as `"id":"…"`; its links write it encoded
  const ids = [...text.matchAll(/"id":"(stories:[a-z-]+--[a-z-]+)"/g)].map(([, id]) => id);
  return ids.toSorted().join(" ");
};

/** The stories of each branch, as the agents' API lists them. */
const STORIES = {
  main: "stories:inputs-button--primary stories:layout-card--plain",
  other: "stories:forms-field--empty stories:inputs-button--secondary"
} as const;

/**
 * Opens a story's address. A switch's reloads may still arrive as the page goes to it: one replaces the navigation and
 * the page reloads where it was, so the address is asked for again, as a reader would.
 */
const openStory = async (page: Page, address: string): Promise<void> => {
  for (;;) {
    try {
      await page.goto(address);
      return;
    } catch (error) {
      if (!/ERR_ABORTED|interrupted by another navigation/.test(String(error))) throw error;
    }
  }
};

/** What the open story's frame says. */
const said = (page: Page): Locator => page.frameLocator("iframe.forgebook-frame-view").getByTestId("said");

test.describe("git switch with forgebook dev running", () => {
  test.setTimeout(240_000);
  let repo = "";
  let server: ChildProcess | undefined;
  let origin = "";

  test.beforeAll(async () => {
    repo = makeRepository();
    const port = await freePort();
    const framePort = await freePort();
    const args = ["dev", "--port", String(port), "--frame-port", String(framePort), "--host", "127.0.0.1"];
    server = spawn(process.execPath, [ENTRY, ...args], { cwd: repo, stdio: "ignore" });
    origin = `http://127.0.0.1:${port}`;
    await expect
      .poll(
        () =>
          fetch(origin).then(
            (response) => response.ok,
            () => false
          ),
        { timeout: 90_000 }
      )
      .toBe(true);
  });

  test.afterAll(async () => {
    const stopping = server;
    if (stopping !== undefined && stopping.exitCode === null && stopping.signalCode === null) {
      await new Promise((resolve) => {
        stopping.once("exit", resolve);
        stopping.kill();
        // a server busy on a loaded machine may take longer to stop than the hook may wait: it is stopped for good
        setTimeout(() => stopping.kill("SIGKILL"), 5_000).unref();
      });
    }
    rmSync(repo, { recursive: true, force: true });
  });

  test("the sidebar, the stories and an edit follow the branch, there and back", async ({ page }) => {
    const git = (...args: readonly string[]): void => {
      execFileSync("git", args, { cwd: repo });
    };
    await openStory(page, `${origin}/?story=stories:inputs-button--primary`);
    await expect(said(page)).toHaveText("main button", { timeout: 90_000 });
    const sidebar = page.getByRole("navigation").first();
    await expectGroups(sidebar, "Layout", "Forms");

    // the agents' API reads the lists as soon as the branch is switched, before the page hears of it: an agent asking
    // must not leave the page holding the branch before
    for (let round = 0; round < 3; round += 1) {
      git("switch", "-q", "other");
      await expect.poll(() => listedStories(origin), { timeout: 20_000 }).toBe(STORIES.other);
      await expectGroups(sidebar, "Forms", "Layout");
      git("switch", "-q", "main");
      await expect.poll(() => listedStories(origin), { timeout: 20_000 }).toBe(STORIES.main);
      await expectGroups(sidebar, "Layout", "Forms");
    }

    git("switch", "-q", "other");
    await expectGroups(sidebar, "Forms", "Layout");
    await expect.poll(() => listedStories(origin), { timeout: 20_000 }).toBe(STORIES.other);
    await openStory(page, `${origin}/?story=stories:inputs-button--secondary`);
    await expect(said(page)).toHaveText("other button", { timeout: 30_000 });
    await openStory(page, `${origin}/?story=stories:forms-field--empty`);
    await expect(said(page)).toHaveText("field", { timeout: 30_000 });

    git("switch", "-q", "main");
    await expectGroups(sidebar, "Layout", "Forms");
    await expect.poll(() => listedStories(origin), { timeout: 20_000 }).toBe(STORIES.main);
    await openStory(page, `${origin}/?story=stories:inputs-button--primary`);
    await expect(said(page)).toHaveText("main button", { timeout: 30_000 });

    const button = join(repo, "src", "Button.stories.ts");
    writeFileSync(button, readFileSync(button, "utf8").replace("main button", "edited button"));
    await expect(said(page)).toHaveText("edited button", { timeout: 30_000 });
  });
});
