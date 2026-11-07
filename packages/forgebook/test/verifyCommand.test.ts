/**
 * Tests for `forgebook verify` as an agent runs it, as a process on a small repository with no browser installed: what it
 * can tell without one, and that stories it cannot run cover nothing. What only a browser finds is in the shell suite
 * (`fixtures/app/shell/verify.e2e.ts`).
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runScriptProcess } from "@ensiria/cli-kit/testing";
import type { ScriptProcessRun } from "@ensiria/cli-kit/testing.types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { catalogueTools } from "../bin/forgebook/mcpTools.ts";
import { runVerify } from "../bin/forgebook/verifyRun.ts";
import type { AgentAnswer } from "../src/vite/agentRoutes.ts";
import type { McpTool } from "../src/vite/mcpProtocol.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

const ENTRY = join(import.meta.dirname, "..", "bin", "forgebook", "forgebook.mts");
const NO_SERVER = "http://127.0.0.1:9";
const TOKENS = readFileSync(join(import.meta.dirname, "fixtures", "tokens.json"), "utf8");

const FILES: Readonly<Record<string, string>> = {
  "Card.tsx": "import { Icon } from './Icon';\nexport const Card = () => <p><Icon /></p>;\n",
  "Icon.tsx": "export const Icon = () => <i />;\n",
  "format.ts": "export const format = (text: string): string => text;\n",
  "Card.stories.tsx":
    "import { Card } from './Card';\nexport default { title: 'Layout/Card', component: Card };\nexport const Plain = {};\n"
};

let root = "";
let counter = 0;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "forgebook-verify-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

type Project = {
  readonly dir: string;
  readonly git: (...args: readonly string[]) => void;
  readonly write: (file: string, text: string) => void;
  readonly verify: (...args: readonly string[]) => ScriptProcessRun;
};

/** A committed repository holding a catalogue. */
const project = (config: Readonly<Record<string, unknown>> = {}): Project => {
  counter += 1;
  const dir = join(root, `p${counter}`);
  mkdirSync(join(dir, "src"), { recursive: true });
  const git = (...args: readonly string[]): void => {
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
      cwd: dir
    });
  };
  const write = (file: string, text: string): void => writeFileSync(join(dir, file), text);
  const configFile = join(dir, "forgebook.config.ts");
  writeFileSync(
    configFile,
    `export default ${JSON.stringify({ framework: STUB_FRAMEWORK, title: "t", stories: ["src/*.stories.tsx"], ...config })};\n`
  );
  for (const [file, text] of Object.entries(FILES)) write(join("src", file), text);
  write(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { jsx: "react-jsx", allowJs: true }, include: ["src"] })
  );
  write(".gitignore", "node_modules/\n.vite/\n");
  write("tokens.json", TOKENS);
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "first");
  return {
    dir,
    git,
    write,
    verify: (...args) =>
      runScriptProcess(ENTRY, [
        "verify",
        "--since",
        "HEAD",
        "--json",
        "--config",
        configFile,
        "--url",
        NO_SERVER,
        ...args
      ])
  };
};

/** A run's document. */
const answer = (run: ScriptProcessRun): Readonly<Record<string, unknown>> => JSON.parse(run.stdout);

describe("forgebook verify", { timeout: 60_000 }, () => {
  it("fails a new component no story reaches, and names the command that writes its stories", () => {
    const repo = project();
    repo.write("src/Badge.tsx", 'export const Badge = () => <b style={{ color: "#ff0033" }} />;\n');
    const run = repo.verify();
    expect(run.exitCode).not.toBe(0);
    expect(answer(run)).toMatchObject({
      schema: 2,
      verdict: "not-verified",
      summary:
        "1 changed UI file, 0 with stories: not verified; colours and sizes not checked: no tokens file",
      skipped: ["colours and sizes not checked: no tokens file"],
      uiFiles: [{ file: "src/Badge.tsx", coverage: "none", fix: "npx forgebook new src/Badge.tsx" }]
    });
  });

  it("compares with what the application declares, so colours are no longer skipped", () => {
    const repo = project();
    repo.write(
      "src/system.css",
      ":root { --a: #111111; --b: #222222; --c: #333333; --d: #444444; --brand: #ff0033; --space-2: 8px; }\n"
    );
    repo.write("src/Badge.tsx", 'export const Badge = () => <b style={{ color: "#ff0033" }} />;\n');
    const document = answer(repo.verify());
    expect(document).toMatchObject({
      verdict: "failed",
      code: {
        checked: [
          "raw-color",
          "raw-size",
          "suppression",
          "deleted-test",
          "deprecated-component",
          "duplicate-component"
        ],
        problems: [{ rule: "raw-color", file: "src/Badge.tsx", fix: "--brand" }],
        tokenSources: [{ kind: "css-variables", file: "src/system.css", tokens: 6 }]
      }
    });
    expect(document["skipped"]).not.toContain("colours and sizes not checked: no tokens file");
  });

  it("says the same to a person, the coverage in one line", () => {
    const repo = project();
    repo.write("src/Badge.tsx", "export const Badge = () => <b />;\n");
    const configFile = join(repo.dir, "forgebook.config.ts");
    const run = runScriptProcess(ENTRY, [
      "verify",
      "--since",
      "HEAD",
      "--config",
      configFile,
      "--url",
      NO_SERVER
    ]);
    expect(run.exitCode).not.toBe(0);
    expect(run.stdout).toContain("npx forgebook new src/Badge.tsx");
    expect(run.stdout).toContain("1 changed UI file, 0 with stories: not verified");
  });

  it("finds a raw value against the tokens, with the token to use", () => {
    const repo = project({ tokens: ["tokens.json"] });
    repo.write("src/a.css", "body { color: #1c1b1b; }\n");
    const run = repo.verify();
    expect(run.exitCode).not.toBe(0);
    expect(answer(run)).toMatchObject({
      verdict: "failed",
      skipped: [],
      code: { problems: [{ rule: "raw-color", file: "src/a.css", fix: "color.brand.ink" }] }
    });
  });

  it("does not count stories that could not run: a project with no browser is not verified", () => {
    const repo = project();
    repo.write("src/Icon.tsx", "export const Icon = () => <em />;\n");
    const run = repo.verify();
    expect(run.exitCode).not.toBe(0);
    const document = answer(run);
    expect(document).toMatchObject({
      verdict: "not-verified",
      ran: 0,
      uiFiles: [{ file: "src/Icon.tsx", coverage: "none", stories: 0 }]
    });
    expect(JSON.stringify(document["uiFiles"])).toContain("@forgebook/testing");
  });

  it("passes a change no one sees, with no browser to run", () => {
    const repo = project();
    repo.write("README.md", "# hello\n");
    repo.write("src/unused.ts", "export const unused = 1;\n");
    const run = repo.verify();
    expect(run.exitCode).toBe(0);
    expect(answer(run)).toMatchObject({ verdict: "nothing-to-verify", uiFiles: [], skipped: [] });
  });

  it("does not take a component for used because a barrel lists it", () => {
    const repo = project();
    repo.write("src/index.ts", "export { Card } from './Card';\nexport { Badge } from './Badge';\n");
    repo.write("src/Badge.tsx", "export const Badge = () => <b />;\n");
    repo.write(
      "src/Card.stories.tsx",
      "import { Card } from './index';\nexport default { title: 'Layout/Card', component: Card };\nexport const Plain = {};\n"
    );
    // the graph's own answer: here `verify` alone would say none for want of a browser
    const run = runScriptProcess(ENTRY, [
      "changed",
      "--json",
      "--config",
      join(repo.dir, "forgebook.config.ts"),
      "--url",
      NO_SERVER
    ]);
    expect(answer(run)["uiFiles"]).toContainEqual(
      expect.objectContaining({ file: "src/Badge.tsx", coverage: "none", stories: [] })
    );
  });

  it("runs the stories of what a deleted file breaks", () => {
    const repo = project();
    unlinkSync(join(repo.dir, "src", "Icon.tsx"));
    const document = answer(repo.verify());
    expect(document["stories"]).toEqual([expect.objectContaining({ title: "Layout/Card" })]);
  });

  it("compares a branch with where it left the base, not with what the base gained since", () => {
    const repo = project();
    repo.git("checkout", "-q", "-b", "work");
    repo.write("src/format.ts", "export const format = (text: string): string => text.trim();\n");
    repo.git("add", "-A");
    repo.git("commit", "-q", "-m", "work");
    repo.git("checkout", "-q", "main");
    repo.write("src/Late.tsx", "export const Late = () => <b />;\n");
    repo.git("add", "-A");
    repo.git("commit", "-q", "-m", "later on main");
    repo.git("checkout", "-q", "work");
    const run = repo.verify("--since", "main");
    expect(run.exitCode).toBe(0);
    expect(answer(run)).toMatchObject({ since: "main", files: ["src/format.ts"] });
  });

  it("counts what is committed on a branch when no commit is named", () => {
    const repo = project();
    repo.git("checkout", "-q", "-b", "work");
    repo.write("src/Badge.tsx", "export const Badge = () => <b />;\n");
    repo.git("add", "-A");
    repo.git("commit", "-q", "-m", "work");
    const configFile = join(repo.dir, "forgebook.config.ts");
    const run = runScriptProcess(ENTRY, ["verify", "--json", "--config", configFile, "--url", NO_SERVER]);
    expect(run.exitCode).not.toBe(0);
    expect(answer(run)).toMatchObject({ since: "main", verdict: "not-verified" });
  });

  it("does not pass on nothing in a shallow clone: no history, no commit named", () => {
    const repo = project();
    const shallow = join(root, `shallow${counter}`);
    const clone = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${repo.dir}`, shallow]);
    expect(clone.status).toBe(0);
    const run = runScriptProcess(ENTRY, [
      "verify",
      "--json",
      "--config",
      join(shallow, "forgebook.config.ts"),
      "--url",
      NO_SERVER
    ]);
    expect(run.exitCode).not.toBe(0);
    expect(answer(run)).toMatchObject({ verdict: "not-verified", files: [] });
  });

  it("sees a new component in a package beside the catalogue, and fails it", () => {
    const repo = project();
    mkdirSync(join(repo.dir, "packages", "ui"), { recursive: true });
    repo.write("packages/ui/New.tsx", "export const New = () => <b />;\n");
    mkdirSync(join(repo.dir, "apps"), { recursive: true });
    const document = answer(repo.verify());
    expect(document["uiFiles"]).toContainEqual(
      expect.objectContaining({ file: "packages/ui/New.tsx", coverage: "none" })
    );
  });

  it("does not stop on a tokens file it cannot read, and says the code was not checked", () => {
    const repo = project({ tokens: ["tokens.json"] });
    repo.write("tokens.json", "{ broken");
    repo.write("README.md", "# hello\n");
    const run = repo.verify();
    expect(run.exitCode).toBe(0);
    expect(answer(run)).toMatchObject({ verdict: "nothing-to-verify" });
  });

  it("refuses what names no commit, and leaves the file an option would write", () => {
    const repo = project();
    const precious = join(repo.dir, "precious.txt");
    writeFileSync(precious, "keep\n");
    const run = runScriptProcess(ENTRY, [
      "verify",
      `--since=--output=${precious}`,
      "--config",
      join(repo.dir, "forgebook.config.ts"),
      "--url",
      NO_SERVER
    ]);
    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain("names no commit");
    expect(readFileSync(precious, "utf8")).toBe("keep\n");
  });
});

describe("the verify tool", () => {
  const reachOf = (verdict: "failed" | "verified"): McpTool | undefined =>
    catalogueTools({
      ask: () => Promise.reject(new Error("not asked")),
      writeNew: () => Promise.reject(new Error("not asked")),
      check: async () => "unused",
      stress: async () => "unused",
      checkPage: async () => "unused",
      shot: async () => "unused",
      servePreview: async () => "unused",
      plugins: { schema: 1, apiVersions: [1], plugins: [] },
      switches: { schema: 1, switches: [] },
      verify: async () => ({
        schema: 2,
        verdict,
        summary: "s",
        skipped: [],
        since: "HEAD",
        base: "a",
        variants: "all",
        files: [],
        uiFiles: [],
        storyCount: 0,
        stories: [],
        ran: 0,
        failures: [],
        notVerified: [],
        code: { checked: [], problems: [], notes: [] },
        problems: 0
      })
    }).find((tool) => tool.name === "verify");

  it("answers as the command does, a failure as an error", async () => {
    expect((await reachOf("failed")?.call({}))?.isError).toBe(true);
    const passed = await reachOf("verified")?.call({ since: "origin/main", quick: true });
    expect(passed).toMatchObject({ isError: false, structured: { schema: 2, verdict: "verified" } });
  });
});

describe("runVerify", () => {
  it("says why there is no change to speak of", async () => {
    const repo = project();
    const answered = await runVerify(
      {
        dir: repo.dir,
        ask: () => Promise.reject(new Error("not asked")),
        check: () => Promise.reject(new Error("not asked"))
      },
      { since: "no-such-ref", isQuick: false }
    );
    expect(answered).toBe('"no-such-ref" names no commit here');
  });

  it("asks the check for every variant unless told otherwise, on every story at once", async () => {
    const repo = project();
    const asks: unknown[] = [];
    const ask = async (route: string): Promise<AgentAnswer> => ({
      status: 200,
      body:
        route === "check-code"
          ? { schema: 1, since: "HEAD", checked: [], skipped: [], problems: [] }
          : {
              schema: 1,
              since: "HEAD",
              files: ["src/Icon.tsx"],
              stories: [{ id: "a" }, { id: "b" }],
              uiFiles: [],
              outside: [],
              problems: []
            }
    });
    const check = async (input: unknown): Promise<string> => {
      asks.push(input);
      return "no browser";
    };
    await runVerify({ dir: repo.dir, ask, check }, { since: "HEAD", isQuick: false });
    await runVerify({ dir: repo.dir, ask, check }, { since: "HEAD", isQuick: true });
    expect(asks).toEqual([
      { ids: ["a", "b"], isAllVariants: true },
      { ids: ["a", "b"], isAllVariants: false }
    ]);
  });
});
