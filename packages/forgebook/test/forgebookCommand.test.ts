/**
 * Tests for the `forgebook` commands as a person, a CI step or an agent runs them: a process on a small catalogue with
 * no dev server running, so each answers from a server of its own; `agents` and `init` in a project folder of their own.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runScriptProcess } from "@ensiria/cli-kit/testing";
import type { ScriptProcessRun } from "@ensiria/cli-kit/testing.types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { KIT_DIR, STORYBOOK_DIR } from "./fixturePaths.ts";
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

describe("forgebook mcp", () => {
  it("answers an agent's handshake and tool calls on stdout, one message per line, and ends with its input", () => {
    const messages = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {} }
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_story", arguments: { id: "stories:actions-button--primary" } }
      }
    ];
    const run = spawnSync(process.execPath, [ENTRY, "mcp", "--config", healthy, "--url", NO_SERVER], {
      input: messages.map((message) => JSON.stringify(message)).join("\n"),
      encoding: "utf8"
    });
    expect(run.status).toBe(0);
    const answers: unknown[] = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(answers).toMatchObject([
      { id: 1, result: { protocolVersion: "2025-11-25", serverInfo: { name: "forgebook" } } },
      { id: 2, result: { isError: false, structuredContent: { args: { size: "md", label: "Save" } } } }
    ]);
  }, 60_000);
});

describe("forgebook docs", () => {
  it("fails a check when the package's CATALOG.md is missing, and names the command that writes it", () => {
    const run = runScriptProcess(ENTRY, ["docs", "--package", KIT_DIR, "--check"]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("CATALOG.md is stale");
    expect(run.stderr).toContain("forgebook docs");
  }, 60_000);
});

describe("forgebook new", () => {
  it("prints a component's first stories, read from its file", () => {
    const run = runScriptProcess(ENTRY, ["new", join(KIT_DIR, "src", "Select.tsx"), "--print"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('import { Select } from "./Select";');
    expect(run.stdout).toContain("args: { options: [] },");
    expect(run.stdout).toContain("export const SizeLg: Story<typeof Select>");
  }, 60_000);

  it("refuses to replace a stories file that exists", () => {
    // Select.stories.tsx exists beside Select.tsx: nothing is written
    const run = runScriptProcess(ENTRY, ["new", join(KIT_DIR, "src", "Select.tsx")]);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toContain("Select.stories.tsx exists");
  }, 60_000);
});

describe("forgebook agents", () => {
  it("prints the instructions, with the commands that check a story", () => {
    const run = runScriptProcess(ENTRY, ["agents", "--print"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("## Stories (Forgebook)");
    expect(run.stdout).toContain("npx forgebook check <id> --json");
  });

  it("adds its section to the project's AGENTS.md, renews it when run again, and writes the skill", () => {
    const project = join(root, "project");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "AGENTS.md"), "# Ours\n\nKeep this.\n");
    const agents = (): number | null =>
      spawnSync(process.execPath, [ENTRY, "agents", "--skill"], { cwd: project, encoding: "utf8" }).status;
    expect(agents()).toBe(0);
    expect(agents()).toBe(0);
    const text = readFileSync(join(project, "AGENTS.md"), "utf8");
    expect(text.startsWith("# Ours\n\nKeep this.\n")).toBe(true);
    expect(text.split("## Stories (Forgebook)")).toHaveLength(2);
    const skill = readFileSync(join(project, ".agents", "skills", "forgebook", "SKILL.md"), "utf8");
    expect(skill).toContain("name: forgebook");
    expect(readFileSync(join(project, ".claude", "skills", "forgebook", "SKILL.md"), "utf8")).toBe(skill);
  });
});

describe("forgebook init", () => {
  it("writes forgebook.config.ts from a project's Storybook files, and refuses to replace it without --force", () => {
    const project = join(root, "on-storybook");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(project, ".storybook"), { recursive: true });
    writeFileSync(join(project, "package.json"), '{ "name": "on-storybook", "type": "module" }\n');
    const init = (...extra: readonly string[]): ReturnType<typeof spawnSync> =>
      spawnSync(process.execPath, [ENTRY, "init", "--from", "storybook", ...extra], {
        cwd: project,
        encoding: "utf8"
      });
    const first = init();
    expect(first.status).toBe(0);
    const config = readFileSync(join(project, "forgebook.config.ts"), "utf8");
    expect(config).toContain('  title: "on-storybook",');
    expect(config).toContain('"src/**/*.stories.tsx"');
    expect(config).toContain('  preview: ".storybook/preview.tsx",');
    expect(config).toContain('id: "density"');
    expect(first.stdout).toContain("forgebook dev");
    expect(first.stderr).toContain("The MDX pages are left out");
    const again = init();
    expect(again.status).toBe(1);
    expect(again.stderr).toContain("forgebook.config.ts is already there");
    expect(init("--force").status).toBe(0);
    // a configuration of another name the catalogue would read is not shadowed either
    const other = join(root, "on-storybook-mts");
    cpSync(join(STORYBOOK_DIR, ".storybook"), join(other, ".storybook"), { recursive: true });
    writeFileSync(join(other, "forgebook.config.mts"), "export default {};\n");
    const shadowing = spawnSync(process.execPath, [ENTRY, "init", "--from", "storybook"], {
      cwd: other,
      encoding: "utf8"
    });
    expect(shadowing.status).toBe(1);
    expect(shadowing.stderr).toContain("forgebook.config.mts is already there");
  }, 60_000);
});
