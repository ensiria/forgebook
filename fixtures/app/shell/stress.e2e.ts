/**
 * `forgebook check --stress` on a real browser, on the fixture catalogue's own stories: values reach the story from a page
 * on the catalogue's origin, a case reports only what the plain story does not have, and nothing is written.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/** The fixture's folder. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

/** The parts of the answer these tests read. */
type StressAnswer = {
  readonly cases: readonly {
    readonly name: string;
    readonly problems: readonly { readonly kind: string; readonly rule?: string }[];
    readonly notVerified?: string;
  }[];
  readonly skipped: readonly string[];
};

test("every case of a story runs, reads against the plain story, and writes nothing", () => {
  test.setTimeout(240_000);
  const before = spawnSync("git", ["status", "--porcelain", "--", "."], {
    cwd: APP,
    encoding: "utf8"
  }).stdout;
  const run = spawnSync(
    process.execPath,
    [
      ENTRY,
      "check",
      "kit:inputs-selection-select--small",
      "--stress",
      "--json",
      "--url",
      "http://127.0.0.1:9"
    ],
    { cwd: APP, encoding: "utf8", timeout: 230_000 }
  );
  const answer: StressAnswer = JSON.parse(run.stdout);
  expect(answer.cases.map((each) => each.name)).toEqual([
    "plain",
    "long-text",
    "unbreakable",
    "empty",
    "huge-number",
    "rtl",
    "zoom-200",
    "narrow",
    "dark",
    "contrast"
  ]);
  // the story's own unnamed select is the plain case's problem, and no case repeats it
  const plain = answer.cases[0]?.problems.map((each) => each.rule);
  expect(plain).toContain("select-name");
  for (const each of answer.cases.slice(1)) {
    expect(each.notVerified, each.name).toBeUndefined();
    expect(each.problems.map((problem) => problem.rule)).not.toContain("select-name");
  }
  expect(spawnSync("git", ["status", "--porcelain", "--", "."], { cwd: APP, encoding: "utf8" }).stdout).toBe(
    before
  );
});

test("a box too narrow for long text breaks in the long cases, and only there", () => {
  test.setTimeout(240_000);
  const parent = join(APP, "test-results");
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, "stress-"));
  try {
    mkdirSync(join(dir, "src"));
    // a package of its own, so Vite keeps its prebundled dependencies here and not in the fixture's, which the suite's
    // dev servers read
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "stress-seeds", private: true, type: "module" })
    );
    writeFileSync(
      join(dir, "forgebook.config.ts"),
      `import { react } from "@forgebook/react/vite";\nimport { defineConfig } from "forgebook";\n\nexport default defineConfig({ framework: react(), title: "Seeds", stories: ["src/*.stories.tsx"] });\n`
    );
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true }
      })
    );
    writeFileSync(
      join(dir, "src", "Badge.tsx"),
      `/** A short status. */\nexport const Badge = ({ label }: { readonly label: string }) => (\n  <div style={{ width: 80 }}>\n    <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>{label}</span>\n  </div>\n);\n`
    );
    writeFileSync(
      join(dir, "src", "Badge.stories.tsx"),
      `import { Badge } from "./Badge";\n\nexport default { title: "Status/Badge", component: Badge };\n\n/** A short label. */\nexport const Plain = { args: { label: "New" } };\n`
    );
    const run = spawnSync(
      process.execPath,
      [ENTRY, "check", "stories:status-badge--plain", "--stress", "--json", "--url", "http://127.0.0.1:9"],
      { cwd: dir, encoding: "utf8", timeout: 230_000 }
    );
    const answer: StressAnswer = JSON.parse(run.stdout);
    const spilling = answer.cases
      .filter((each) => each.problems.some((problem) => problem.kind === "spill"))
      .map((each) => each.name);
    expect(spilling).toEqual(expect.arrayContaining(["long-text", "unbreakable", "rtl", "narrow"]));
    expect(spilling).not.toContain("plain");
    expect(spilling).not.toContain("empty");
    expect(answer.skipped).toEqual(
      expect.arrayContaining(["stories:status-badge--plain: huge-number: no prop takes a number"])
    );
    expect(run.status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
