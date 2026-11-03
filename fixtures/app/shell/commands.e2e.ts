/**
 * The commands that work with the catalogue in a browser, run against the suite's own dev server: `forgebook check`,
 * `forgebook shot`, and `forgebook errors`, which lists what the frames open in the suite's browser reported.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

/** The catalogue's folder, where the commands run. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

/**
 * Runs `forgebook` with its arguments against the suite's server.
 *
 * @param baseURL - the suite's server.
 * @param argv - the command and its arguments.
 */
const forgebook = (baseURL: string, argv: readonly string[]): { status: number | null; stdout: string } => {
  const run = spawnSync(process.execPath, [ENTRY, ...argv, "--url", baseURL], {
    cwd: APP,
    encoding: "utf8",
    timeout: 120_000
  });
  return { status: run.status, stdout: run.stdout };
};

test.describe("forgebook story", () => {
  test.setTimeout(180_000);

  test("gives an agent a story's design: the Figma link, the file, the node, the page to see it on", ({
    baseURL
  }) => {
    if (baseURL === undefined) throw new Error("the suite has no server");
    const run = forgebook(baseURL, ["story", "kit:layouts-form--signup", "--json"]);
    expect(run.status).toBe(0);
    const { design } = JSON.parse(run.stdout);
    expect(design).toEqual({
      figma: "https://www.figma.com/design/FixtureFile123?node-id=12-34",
      fileKey: "FixtureFile123",
      nodeId: "12:34",
      address: expect.stringContaining("tab=figma")
    });
  });

  test("gives an agent each prop's group, and the members of a prop typed with a documented object", ({
    baseURL
  }) => {
    if (baseURL === undefined) throw new Error("the suite has no server");
    const run = forgebook(baseURL, ["story", "kit:inputs-selection-select--overview", "--json"]);
    expect(run.status).toBe(0);
    const { docs } = JSON.parse(run.stdout);
    const byName = new Map(
      docs.props.map((prop: { readonly name: string }): [string, unknown] => [prop.name, prop])
    );
    expect(byName.get("rows")).toMatchObject({ group: "Behaviour" });
    expect(byName.get("value")).not.toHaveProperty("group");
    expect(byName.get("texts")).toMatchObject({
      group: "Texts",
      members: [
        {
          name: "empty",
          type: "string",
          description: "Shown in place of the list when there is no option.",
          defaultValue: '"Nothing to pick"',
          isRequired: false
        },
        {
          name: "listLabel",
          type: "string",
          description: "The list's name for screen readers.",
          isRequired: false
        }
      ]
    });
  });
});

test.describe("forgebook check-page", () => {
  test.setTimeout(180_000);

  /** Runs the command on an address: it needs no catalogue server, only the catalogue's folder. */
  const checkPage = (address: string): { readonly status: number | null; readonly stdout: string } => {
    const run = spawnSync(process.execPath, [ENTRY, "check-page", address, "--json"], {
      cwd: APP,
      encoding: "utf8",
      timeout: 120_000
    });
    return { status: run.status, stdout: run.stdout };
  };

  test("names a real page's problems by kind, and fails on them", () => {
    const html = `<!doctype html><html lang="en"><title>A page</title><main><img src="data:,"></main>
      <script>console.error("broken on purpose")</script></html>`;
    const folder = mkdtempSync(join(tmpdir(), "forgebook-page-"));
    writeFileSync(join(folder, "page.html"), html);
    const run = checkPage(pathToFileURL(join(folder, "page.html")).href);
    rmSync(folder, { recursive: true });
    expect(run.status).not.toBe(0);
    const report: unknown = JSON.parse(run.stdout);
    expect(report).toMatchObject({
      results: [{ problems: expect.arrayContaining([expect.objectContaining({ kind: "axe" })]) }]
    });
    expect(run.stdout).toContain("broken on purpose");
  });

  /** The focus problems of a page with these lines in its body. */
  const focusOf = (body: string): string[] => {
    const folder = mkdtempSync(join(tmpdir(), "forgebook-page-"));
    writeFileSync(
      join(folder, "page.html"),
      `<!doctype html><html lang="en"><title>A page</title><main>${body}</main></html>`
    );
    const run = checkPage(pathToFileURL(join(folder, "page.html")).href);
    rmSync(folder, { recursive: true });
    const report: unknown = JSON.parse(run.stdout);
    const problems = JSON.stringify(report).match(/"kind":"focus","message":"[^"]*"/g) ?? [];
    return [...problems];
  };

  test("names a modal that does not take the focus, and one that lets Tab out", () => {
    const button = "<button>Before</button>";
    const open = '<div role="dialog" aria-modal="true" aria-label="A"><button>Inside</button></div>';
    expect(focusOf(`${button}${open}`).join()).toContain("did not move the focus");
    const taken = `${button}${open}<script>document.querySelector('[role=dialog] button').focus()</script>`;
    expect(focusOf(taken).join()).toContain("Tab leaves the modal");
  });

  test("passes a native modal, which traps the focus itself, and a page with none", () => {
    const native = `<dialog aria-label="A"><button>Inside</button></dialog>
      <script>document.querySelector("dialog").showModal()</script>`;
    expect(focusOf(native)).toEqual([]);
    expect(focusOf("<button>Alone</button>")).toEqual([]);
  });

  test("passes a page with nothing wrong", () => {
    const folder = mkdtempSync(join(tmpdir(), "forgebook-page-"));
    writeFileSync(
      join(folder, "page.html"),
      '<!doctype html><html lang="en"><title>A page</title><main><h1>Fine</h1></main></html>'
    );
    const run = checkPage(pathToFileURL(join(folder, "page.html")).href);
    rmSync(folder, { recursive: true });
    expect(run.status).toBe(0);
  });
});

test.describe("forgebook check", () => {
  test.setTimeout(180_000);

  test("reports a story's problems by kind, in the views asked for, and fails on them", ({ baseURL }) => {
    const run = forgebook(baseURL ?? "", [
      "check",
      "kit:inputs-selection-select--overview",
      "--view",
      "theme=dark",
      "--json"
    ]);
    expect(run.status).toBe(1);
    const report: unknown = JSON.parse(run.stdout);
    expect(report).toMatchObject({
      schema: 1,
      results: [
        {
          storyId: "kit:inputs-selection-select--overview",
          view: "theme=dark",
          problems: [{ kind: "axe", rule: "select-name" }]
        }
      ]
    });
  });

  test("says a story that throws could not be shown, and a component's id checks its stories", ({
    baseURL
  }) => {
    const run = forgebook(baseURL ?? "", ["check", "kit:inputs-selection-select", "--json"]);
    const report: unknown = JSON.parse(run.stdout);
    const results =
      typeof report === "object" && report !== null && "results" in report && Array.isArray(report.results)
        ? report.results
        : [];
    expect(results.length).toBeGreaterThan(5);
    expect(results).toContainEqual(
      expect.objectContaining({
        storyId: "kit:inputs-selection-select--throws",
        problems: expect.arrayContaining([{ kind: "frame", message: "The story could not be shown" }])
      })
    );
  });
});

test.describe("forgebook errors", () => {
  test.setTimeout(120_000);

  test("lists a story that could not be shown once a frame opened it, and only the new ones after a number", async ({
    page,
    baseURL
  }) => {
    const before: unknown = JSON.parse(forgebook(baseURL ?? "", ["errors", "--json"]).stdout);
    const since =
      typeof before === "object" && before !== null && "last" in before && typeof before.last === "number"
        ? before.last
        : 0;
    // the server keeps one list for every test that runs beside this one, and another may open the same story: a
    // mark of this test's own in the frame's address (which the error keeps as its view) tells its error apart
    const mark = `run=${test.info().testId}-${test.info().repeatEachIndex}-${test.info().retry}`;
    await page.goto(`frame.html?story=kit:inputs-selection-select--throws&${mark}`);
    await expect(page.locator("html")).toHaveAttribute("data-forgebook-status", "error");
    await expect
      .poll(() => JSON.parse(forgebook(baseURL ?? "", ["errors", "--since", String(since), "--json"]).stdout))
      .toMatchObject({
        errors: expect.arrayContaining([
          expect.objectContaining({
            kind: "render",
            storyId: "kit:inputs-selection-select--throws",
            view: expect.stringContaining(mark)
          })
        ])
      });
    // only the errors after the number given
    const after: unknown = JSON.parse(
      forgebook(baseURL ?? "", ["errors", "--since", String(since), "--json"]).stdout
    );
    const numbers =
      typeof after === "object" && after !== null && "errors" in after && Array.isArray(after.errors)
        ? after.errors.map((error: unknown) =>
            typeof error === "object" && error !== null && "n" in error ? error.n : undefined
          )
        : [];
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toBeGreaterThan(since);
  });
});

test.describe("forgebook shot", () => {
  test.setTimeout(180_000);

  test("pictures a story in a view written as words, at the view's width and the story's own height", ({
    baseURL
  }) => {
    const out = mkdtempSync(join(tmpdir(), "forgebook-shots-"));
    try {
      const run = forgebook(baseURL ?? "", [
        "shot",
        "kit:inputs-selection-select--in-row",
        "--view",
        "dark 360",
        "--out",
        out,
        "--json"
      ]);
      expect(run.status).toBe(0);
      const report: unknown = JSON.parse(run.stdout);
      expect(report).toMatchObject({
        schema: 1,
        shots: [{ storyId: "kit:inputs-selection-select--in-row", view: "theme=dark&width=360" }]
      });
      const file =
        typeof report === "object" && report !== null && "shots" in report && Array.isArray(report.shots)
          ? String(report.shots[0]?.file)
          : "";
      // a PNG's width and height sit at bytes 16 to 24
      const png = readFileSync(file);
      expect(png.readUInt32BE(16)).toBe(360);
      expect(png.readUInt32BE(20)).toBeLessThan(200);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("frames a picture in the device a view names, and leaves a story framed by default unframed otherwise", ({
    baseURL
  }) => {
    const out = mkdtempSync(join(tmpdir(), "forgebook-shots-"));
    try {
      const run = forgebook(baseURL ?? "", [
        "shot",
        "kit:layouts-app-screen--phone",
        "--view",
        "iphone-16",
        "--view",
        "",
        "--out",
        out,
        "--json"
      ]);
      expect(run.status).toBe(0);
      const report: unknown = JSON.parse(run.stdout);
      const files =
        typeof report === "object" && report !== null && "shots" in report && Array.isArray(report.shots)
          ? report.shots.map((shot: unknown) =>
              typeof shot === "object" && shot !== null && "file" in shot ? String(shot.file) : ""
            )
          : [];
      const [framed, plain] = files.map((file: string) => readFileSync(file));
      // the iPhone 16's viewport is 393 px wide; framed, the picture is wider by the device's band and bezel
      expect(framed?.readUInt32BE(16)).toBeGreaterThan(393);
      expect(framed?.readUInt32BE(20)).toBeGreaterThan(852);
      expect(plain?.readUInt32BE(16)).toBe(1280);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
