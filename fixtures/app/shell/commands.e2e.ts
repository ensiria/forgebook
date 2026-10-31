/**
 * The commands that work with the catalogue in a browser, run against the suite's own dev server: `forgebook check`,
 * `forgebook shot`, and `forgebook errors`, which lists what the frames open in the suite's browser reported.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    await page.goto("frame.html?story=kit:inputs-selection-select--throws");
    await expect(page.locator("html")).toHaveAttribute("data-forgebook-status", "error");
    await expect
      .poll(() => JSON.parse(forgebook(baseURL ?? "", ["errors", "--since", String(since), "--json"]).stdout))
      .toMatchObject({
        errors: [{ kind: "render", storyId: "kit:inputs-selection-select--throws", n: since + 1 }]
      });
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
});
