/**
 * Tests for `forgebook stories` and `forgebook story` as a person or a CI step runs them: a process on a small
 * catalogue with no dev server running, so each answers from a server of its own.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runScriptProcess } from "@ensiria/cli-kit/testing";
import type { ScriptProcessRun } from "@ensiria/cli-kit/testing.types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

/** The command's entry. */
const ENTRY = join(import.meta.dirname, "..", "bin", "forgebook", "forgebook.mts");

/** No catalogue answers there, so the command starts a server of its own. */
const NO_SERVER = "http://127.0.0.1:9";

/** A catalogue folder with its configuration and story files. */
const catalogue = (root: string, name: string, files: Readonly<Record<string, string>>): string => {
  const dir = join(root, name);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "forgebook.config.ts"),
    `export default ${JSON.stringify({ framework: STUB_FRAMEWORK, title: name, stories: ["src/*.stories.tsx"] })};\n`
  );
  for (const [file, code] of Object.entries(files)) writeFileSync(join(dir, "src", file), code);
  return join(dir, "forgebook.config.ts");
};

let root = "";
let healthy = "";
let broken = "";

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "forgebook-command-"));
  healthy = catalogue(root, "Healthy", {
    "button.stories.tsx": [
      'export default { title: "Actions/Button", args: { size: "md" } };',
      "/** The main action. */",
      'export const Primary = { args: { label: "Save" } };',
      ""
    ].join("\n")
  });
  broken = catalogue(root, "Broken", {
    "button.stories.tsx": 'export default { title: "Actions/Button" };\nexport const Primary = {};\n',
    "again.stories.tsx": 'export default { title: "Actions/Button" };\nexport const Twice = {};\n'
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Runs the command with a catalogue's configuration. */
const forgebook = (config: string, argv: readonly string[]): ScriptProcessRun =>
  runScriptProcess(ENTRY, [...argv, "--config", config, "--url", NO_SERVER]);

describe("forgebook stories", () => {
  it("lists the stories as JSON from a server of its own, with their links", async () => {
    const run = forgebook(healthy, ["stories", "--json"]);
    expect(run.exitCode).toBe(0);
    const document: unknown = JSON.parse(run.stdout);
    expect(document).toMatchObject({
      schema: 1,
      title: "Healthy",
      components: [
        {
          title: "Actions/Button",
          stories: [{ id: "stories:actions-button--primary", description: "The main action." }]
        }
      ],
      problems: []
    });
    expect(run.stdout).toContain(`${NO_SERVER}/?story=stories%3Aactions-button--primary`);
  }, 60_000);

  it("fails with the index's problems, so a CI step catches a broken story file", async () => {
    const run = forgebook(broken, ["stories"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("again.stories.tsx");
  }, 60_000);
});

describe("forgebook story", () => {
  it("gives a story's args, the meta's under its own, and its links in the view asked for", async () => {
    const run = forgebook(healthy, [
      "story",
      "stories:actions-button--primary",
      "--view",
      "theme=dark",
      "--json"
    ]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      schema: 1,
      args: { size: "md", label: "Save" },
      story: {
        links: { frame: `${NO_SERVER}/frame.html?theme=dark&story=stories%3Aactions-button--primary` }
      },
      problems: []
    });
  }, 60_000);

  it("says when a story does not exist", async () => {
    const run = forgebook(healthy, ["story", "stories:nothing--here"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain('No story "stories:nothing--here"');
  }, 60_000);
});
