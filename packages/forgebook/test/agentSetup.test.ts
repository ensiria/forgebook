/**
 * What `forgebook init --agents` writes and what its hook answers: files merged and never replaced, the formats each
 * assistant documents, the loop guard, a workflow a shell cannot be tricked by, and what a failure to draw is called.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

import { createTestIo } from "@ensiria/cli-kit/testing";
import { afterEach, describe, expect, it } from "vitest";

import { detectedHooks, repositoryRoot, writeAgentFiles } from "../bin/forgebook/agentSetup/agentFiles.ts";
import { withMcpServer, withStopHook } from "../bin/forgebook/agentSetup/assistantHooks.ts";
import { workflowText } from "../bin/forgebook/agentSetup/ciWorkflow.ts";
import { candidateRank, drawCandidates, storyFolders } from "../bin/forgebook/agentSetup/drawCandidates.ts";
import { diagnosed } from "../bin/forgebook/agentSetup/drawDiagnosis.ts";
import { chosenExport, resultProblem, runDraw } from "../bin/forgebook/agentSetup/drawRun.ts";
import { liftedProviders } from "../bin/forgebook/agentSetup/liftedProviders.ts";
import {
  forgebookCommandLine,
  forgebookInstalledLine,
  isPlainFolder,
  mcpServerOf
} from "../bin/forgebook/agentSetup/projectRunner.ts";
import {
  allowed,
  answerToVerdict,
  blocked,
  isContinuing,
  isTurnAborted,
  sayAnswer
} from "../bin/forgebook/agentSetup/stopHook.ts";
import { isUniformPicture } from "../bin/forgebook/agentSetup/uniformPicture.ts";
import { CHECKOUT, SETUP_BUN, SETUP_NODE } from "../bin/forgebook/workflowActions.ts";
import type { VerifyDocument } from "../src/vite/agent.types.ts";

const made: string[] = [];

/** A folder holding these files, removed after the test. */
const folderWith = (files: Readonly<Record<string, string>>): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "forgebook-agents-")));
  made.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A merged file's text. */
const textOf = (merged: ReturnType<typeof withMcpServer>): string =>
  merged.kind === "written" ? merged.text : `(${merged.kind})`;

describe("each assistant's hook", () => {
  it("is Claude Code's Stop, as its documentation writes it", () => {
    expect(JSON.parse(textOf(withStopHook("claude", undefined, "npx --no forgebook hook claude")))).toEqual({
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "npx --no forgebook hook claude", timeout: 600 }] }]
      }
    });
  });

  it("is Codex's Stop, in its own file", () => {
    const { hooks } = JSON.parse(textOf(withStopHook("codex", undefined, "c")));
    expect(hooks.Stop[0].hooks[0]).toEqual({ type: "command", command: "c", timeout: 600 });
  });

  it("is Cursor's stop, with its version and its own loop limit", () => {
    expect(JSON.parse(textOf(withStopHook("cursor", undefined, "c")))).toEqual({
      version: 1,
      hooks: { stop: [{ command: "c", timeout: 600, loop_limit: 5 }] }
    });
  });

  it("is Gemini CLI's AfterAgent, whose timeout is in milliseconds", () => {
    const { hooks } = JSON.parse(textOf(withStopHook("gemini", undefined, "c")));
    expect(hooks.AfterAgent[0].hooks[0]).toMatchObject({ command: "c", timeout: 600_000 });
  });

  it("keeps what the file holds, the event's other hooks too", () => {
    const text = JSON.stringify({
      permissions: { allow: ["Bash"] },
      hooks: { Stop: [{ hooks: [{ type: "command", command: "mine" }] }], PreToolUse: [] }
    });
    const merged = JSON.parse(textOf(withStopHook("claude", text, "npx --no forgebook hook claude")));
    expect(merged.permissions).toEqual({ allow: ["Bash"] });
    expect(merged.hooks.PreToolUse).toEqual([]);
    expect(merged.hooks.Stop).toHaveLength(2);
    expect(merged.hooks.Stop[0].hooks[0].command).toBe("mine");
  });

  it("is written for each package's catalogue", () => {
    const once = textOf(withStopHook("claude", undefined, 'cd "a" && forgebook hook claude'));
    expect(withStopHook("claude", once, 'cd "b" && forgebook hook claude').kind).toBe("written");
  });

  it("is written once", () => {
    const once = textOf(withStopHook("claude", undefined, "npx --no forgebook hook claude"));
    expect(withStopHook("claude", once, "npx --no forgebook hook claude")).toEqual({ kind: "unchanged" });
  });

  it.each(["{ // a comment\n}", "[]", '{ "hooks": [] }', '{ "hooks": { "Stop": {} } }'])(
    "leaves %s as it is",
    (text) => {
      expect(withStopHook("claude", text, "c")).toEqual({ kind: "unreadable" });
    }
  );
});

describe(".mcp.json", () => {
  const server = { command: "npx", args: ["forgebook", "mcp"] };

  it("is written, or merged beside the servers there", () => {
    expect(JSON.parse(textOf(withMcpServer(undefined, server)))).toEqual({
      mcpServers: { forgebook: server }
    });
    const merged = JSON.parse(
      textOf(withMcpServer('{ "mcpServers": { "other": { "command": "x" } }, "a": 1 }', server))
    );
    expect(merged).toEqual({ a: 1, mcpServers: { other: { command: "x" }, forgebook: server } });
  });

  it("keeps a forgebook server the project wrote, and a file it cannot read", () => {
    expect(withMcpServer('{ "mcpServers": { "forgebook": { "command": "mine" } } }', server).kind).toBe(
      "unchanged"
    );
    expect(withMcpServer("not json", server).kind).toBe("unreadable");
  });
});

describe("how the root reaches a package's catalogue", () => {
  it("is plain at the root", () => {
    expect(forgebookCommandLine("npm", "", "hook claude")).toBe("npx --no forgebook hook claude");
    expect(mcpServerOf("npm", "")).toEqual({ command: "npx", args: ["--no", "forgebook", "mcp"] });
    expect(mcpServerOf("bun", "")).toEqual({ command: "bunx", args: ["--no-install", "forgebook", "mcp"] });
  });

  it("quotes a folder for the shell, and tells a client's package manager", () => {
    expect(forgebookCommandLine("pnpm", "apps/my web", "hook codex")).toBe(
      'cd "apps/my web" && pnpm exec forgebook hook codex'
    );
    expect(mcpServerOf("pnpm", "apps/web")).toEqual({
      command: "pnpm",
      args: ["--dir", "apps/web", "exec", "forgebook", "mcp"]
    });
    expect(mcpServerOf("yarn", "apps/web").args).toEqual([
      "--silent",
      "--cwd",
      "apps/web",
      "forgebook",
      "mcp"
    ]);
    expect(mcpServerOf("npm", "apps/web").args).toEqual([
      "--prefix",
      "apps/web",
      "exec",
      "--no",
      "--",
      "forgebook",
      "mcp",
      "--config",
      "apps/web/forgebook.config.ts"
    ]);
  });

  it("asks npx for the installed command's version, not its own", () => {
    expect(forgebookInstalledLine("npm", "")).toBe("npx --no -- forgebook --version");
    expect(forgebookInstalledLine("npm", "apps/web")).toBe(
      'cd "apps/web" && npx --no -- forgebook --version'
    );
    expect(forgebookInstalledLine("pnpm", "")).toBe("pnpm exec forgebook --version");
    expect(forgebookInstalledLine("yarn", "")).toBe("yarn --silent forgebook --version");
    expect(forgebookInstalledLine("bun", "")).toBe("bunx --no-install forgebook --version");
  });
});

describe("the workflow", () => {
  it("compares with the pull request's target, whose name never enters the script", () => {
    const text = workflowText("pnpm", "");
    expect(text).toContain("fetch-depth: 0");
    expect(text).toContain("contents: read");
    expect(text).toContain("corepack enable");
    expect(text).toContain("pnpm install --frozen-lockfile");
    expect(text).toContain("pnpm exec forgebook browser --with-deps");
    expect(text).toContain('verify --since "origin/$BASE_BRANCH"');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is GitHub Actions' syntax, in the file it reads
    expect(text).toContain("BASE_BRANCH: ${{ github.base_ref }}");
    expect(text.split("\n").filter((line) => line.includes("run:") && line.includes("${{"))).toEqual([]);
  });

  it("pins every action to a commit of its current release, as the proof's workflow does", () => {
    const uses = (["npm", "pnpm", "yarn", "bun"] as const).flatMap((manager) =>
      workflowText(manager, "")
        .split("\n")
        .filter((line) => line.includes("uses:"))
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/uses: [\w-]+\/[\w-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
    expect(workflowText("npm", "")).toContain(`- uses: ${CHECKOUT}`);
    expect(workflowText("npm", "")).toContain(`- uses: ${SETUP_NODE}`);
    expect(workflowText("bun", "")).toContain(`- uses: ${SETUP_BUN}`);
  });

  it("runs in a package's folder", () => {
    expect(workflowText("npm", "apps/web")).toContain(
      'cd "apps/web" && npx --no forgebook browser --with-deps'
    );
    expect(workflowText("npm", "apps/web")).toContain('cd "apps/web" && npx --no forgebook verify');
    // the install is at the root, where the lock file is
    expect(workflowText("pnpm", "apps/web")).toContain("- run: pnpm install --frozen-lockfile");
    expect(workflowText("pnpm", "apps/web")).not.toContain("working-directory");
    expect(workflowText("npm", "", false)).toContain("- run: npm install");
  });
});

/** A repository, with git's own folder, for what reads it. */
const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const dir = folderWith(files);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
};

describe("the files written", () => {
  const request = { framework: "react", manager: "npm", hooks: undefined } as const;

  it("go at the repository's root, with a package's folder in what they run", () => {
    const root = repositoryWith({ "CLAUDE.md": "", "apps/web/package.json": "{}", ".github/x": "" });
    const projectDir = join(root, "apps", "web");
    execFileSync("git", ["add", "apps/web/package.json"], { cwd: root });
    expect(repositoryRoot(projectDir)).toBe(root);
    const files = writeAgentFiles({ ...request, projectDir });
    expect(files.root).toBe("../..");
    expect(files.hooks).toEqual([{ name: "claude", file: ".claude/settings.json", effect: "blocks" }]);
    expect(readFileSync(join(root, ".claude/settings.json"), "utf8")).toContain(
      'cd \\"$CLAUDE_PROJECT_DIR/apps/web\\" && npx --no forgebook hook claude'
    );
    expect(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")).mcpServers.forgebook.args).toContain(
      "apps/web"
    );
    expect(readFileSync(join(root, ".github/workflows/forgebook-verify.yml"), "utf8")).toContain("apps/web");
    for (const file of [
      "AGENTS.md",
      ".agents/skills/forgebook/SKILL.md",
      ".claude/skills/forgebook/SKILL.md"
    ])
      expect(existsSync(join(root, file))).toBe(true);
  });

  it("leave an AGENTS.md's other sections, and a run twice changes nothing but its own", () => {
    const root = repositoryWith({ "AGENTS.md": "# Ours\n\nKeep this.\n", ".claude/x": "" });
    writeAgentFiles({ ...request, projectDir: root });
    const first = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(first).toContain("Keep this.");
    const again = writeAgentFiles({ ...request, projectDir: root });
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(first);
    expect(again.unchanged).toEqual(expect.arrayContaining([".mcp.json", ".claude/settings.json"]));
  });

  it("are the commit's hook on a repository with no signs, the skill they write being none", () => {
    const root = repositoryWith({});
    expect(writeAgentFiles({ ...request, projectDir: root }).hooks[0]?.name).toBe("pre-commit");
  });

  it("stay in the package when the repository above does not track it", () => {
    const root = repositoryWith({ "dotfiles/x": "", "project/package.json": "{}" });
    const projectDir = join(root, "project");
    expect(repositoryRoot(projectDir)).toBe(projectDir);
    execFileSync("git", ["add", "project/package.json"], { cwd: root });
    expect(repositoryRoot(projectDir)).toBe(root);
  });

  it("find the assistants a repository shows signs of, else the commit", () => {
    expect(detectedHooks(folderWith({ ".cursor/x": "", "GEMINI.md": "" }))).toEqual(["cursor", "gemini"]);
    expect(detectedHooks(folderWith({}))).toEqual(["pre-commit"]);
  });

  it("are the hooks named, or none", () => {
    const root = repositoryWith({ "CLAUDE.md": "" });
    expect(writeAgentFiles({ ...request, projectDir: root, hooks: ["none"] }).hooks).toEqual([]);
    expect(existsSync(join(root, ".claude/settings.json"))).toBe(false);
    expect(writeAgentFiles({ ...request, projectDir: root, hooks: ["codex"] }).hooks[0]?.file).toBe(
      ".codex/hooks.json"
    );
  });

  it("write nothing with a folder's name a shell would read as code", () => {
    const root = repositoryWith({ "apps/$(touch x)/package.json": "{}" });
    execFileSync("git", ["add", "."], { cwd: root });
    const { written, nextSteps } = writeAgentFiles({
      ...request,
      projectDir: join(root, "apps", "$(touch x)")
    });
    expect(written).toEqual([]);
    expect(existsSync(join(root, ".mcp.json"))).toBe(false);
    expect(JSON.stringify(nextSteps)).toContain("read as code");
    expect(isPlainFolder("apps/my web")).toBe(true);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is GitHub Actions' syntax, which must be refused
    expect(isPlainFolder("apps/${{ x }}")).toBe(false);
  });

  it("do not write through a linked folder", () => {
    const root = repositoryWith({ "elsewhere/x": "" });
    symlinkSync(join(root, "elsewhere"), join(root, ".claude"));
    const { nextSteps } = writeAgentFiles({ ...request, projectDir: root, hooks: ["claude"] });
    expect(existsSync(join(root, "elsewhere", "settings.json"))).toBe(false);
    expect(JSON.stringify(nextSteps)).toContain(".claude/settings.json is a link");
  });

  it("never write through a link, and name what they left", () => {
    const root = repositoryWith({ "elsewhere.json": "{}" });
    symlinkSync(join(root, "elsewhere.json"), join(root, ".mcp.json"));
    const { nextSteps } = writeAgentFiles({ ...request, projectDir: root, hooks: ["none"] });
    expect(readFileSync(join(root, "elsewhere.json"), "utf8")).toBe("{}");
    expect(JSON.stringify(nextSteps)).toContain(".mcp.json is a link");
  });

  it("name a settings file they could not read, leaving it", () => {
    const root = repositoryWith({ ".claude/settings.json": "{ // comment\n}" });
    const { nextSteps, hooks } = writeAgentFiles({ ...request, projectDir: root, hooks: ["claude"] });
    expect(hooks).toEqual([]);
    expect(readFileSync(join(root, ".claude/settings.json"), "utf8")).toBe("{ // comment\n}");
    expect(JSON.stringify(nextSteps)).toContain(".claude/settings.json could not be read");
  });

  it("keep a workflow there, and tell another host what to run", () => {
    const root = repositoryWith({ ".github/workflows/forgebook-verify.yml": "ours" });
    expect(writeAgentFiles({ ...request, projectDir: root, hooks: ["none"] }).unchanged).toContain(
      ".github/workflows/forgebook-verify.yml"
    );
    expect(readFileSync(join(root, ".github/workflows/forgebook-verify.yml"), "utf8")).toBe("ours");
    const gitlab = repositoryWith({});
    const { nextSteps } = writeAgentFiles({ ...request, projectDir: gitlab, hooks: ["none"] });
    expect(JSON.stringify(nextSteps)).toContain("not on GitHub");
  });

  it("write the commit's hook, an executable, and never over one", () => {
    const root = repositoryWith({});
    const { hooks } = writeAgentFiles({ ...request, projectDir: root, hooks: ["pre-commit"] });
    expect(hooks[0]).toEqual({ name: "pre-commit", file: ".git/hooks/pre-commit", effect: "blocks-commit" });
    expect(readFileSync(join(root, ".git/hooks/pre-commit"), "utf8")).toContain(
      "if npx --no -- forgebook --version >/dev/null 2>&1; then"
    );
    expect(readFileSync(join(root, ".git/hooks/pre-commit"), "utf8")).toContain(
      "npx --no forgebook verify --quick"
    );
    const again = writeAgentFiles({ ...request, projectDir: root, hooks: ["pre-commit"] });
    expect(again.hooks).toEqual(hooks);
    expect(again.unchanged).toContain(".git/hooks/pre-commit");
    expect(JSON.stringify(again.nextSteps)).not.toContain("hook setup of their own");
    const taken = repositoryWith({});
    writeFileSync(join(taken, ".git/hooks/pre-commit"), "ours");
    const left = writeAgentFiles({ ...request, projectDir: taken, hooks: ["pre-commit"] });
    expect(left.hooks).toEqual([]);
    expect(readFileSync(join(taken, ".git/hooks/pre-commit"), "utf8")).toBe("ours");
    expect(JSON.stringify(left.nextSteps)).toContain("verify --quick");
  });

  it("add to Husky's hook, keeping what it runs", () => {
    const root = repositoryWith({ ".husky/pre-commit": "npm test\n" });
    writeAgentFiles({ ...request, projectDir: root, hooks: ["pre-commit"] });
    const text = readFileSync(join(root, ".husky/pre-commit"), "utf8");
    expect(text).toContain("npm test\n");
    expect(text).toContain("npx --no forgebook verify --quick");
    expect(writeAgentFiles({ ...request, projectDir: root, hooks: ["pre-commit"] }).unchanged).toContain(
      ".husky/pre-commit"
    );
  });
});

/** A verdict, as far as a hook reads one. */
const verdict = (name: VerifyDocument["verdict"]): VerifyDocument =>
  ({
    schema: 2,
    verdict: name,
    summary: "s",
    skipped: [],
    since: "main",
    base: "abc",
    variants: "all",
    files: [],
    uiFiles: [{ file: "a.tsx", coverage: "none", stories: 0 }],
    storyCount: 0,
    stories: [],
    ran: 0,
    failures: [],
    notVerified: [],
    code: { checked: [], problems: [], notes: [] }
  }) as unknown as VerifyDocument;

describe("the hook's answer", () => {
  it("blocks in each assistant's way", () => {
    expect(blocked("claude", "r")).toEqual({ exitCode: 2, stdout: "", stderr: "r" });
    expect(blocked("codex", "r").exitCode).toBe(2);
    expect(blocked("gemini", "r").exitCode).toBe(2);
    expect(blocked("cursor", "r")).toEqual({ exitCode: 0, stdout: '{"followup_message":"r"}\n', stderr: "" });
  });

  it("ends with its code, the reason only once", () => {
    const io = createTestIo();
    expect(() => sayAnswer(blocked("claude", "the reason"), io.io)).toThrow(
      expect.objectContaining({ exitCode: 2, isReported: true })
    );
    expect(io.stderr()).toBe("the reason");
    const fine = createTestIo();
    sayAnswer(allowed(), fine.io);
    expect(fine.stdout()).toBe("{}\n");
  });

  it("lets it finish with JSON on stdout, which Codex requires", () => {
    expect(allowed()).toEqual({ exitCode: 0, stdout: "{}\n", stderr: "" });
  });

  it("reads each assistant's way of saying it is already continuing", () => {
    expect(isContinuing('{"stop_hook_active":true}')).toBe(true);
    expect(isContinuing('{"loop_count":2}')).toBe(true);
    expect(isContinuing('{"loop_count":0,"stop_hook_active":false}')).toBe(false);
    expect(isContinuing("not json")).toBe(false);
    expect(isContinuing("")).toBe(false);
  });

  it("sends the agent back on red, and lets it go when the same failure comes again", () => {
    const dir = folderWith({});
    const first = answerToVerdict("claude", verdict("not-verified"), "text", dir, false);
    expect(first.exitCode).toBe(2);
    expect(first.stderr).toContain("not-verified");
    const looping = answerToVerdict("claude", verdict("not-verified"), "text", dir, true);
    expect(looping.exitCode).toBe(0);
    expect(looping.stdout).toContain("do not call the change done");
  });

  it("sends it back again on a different failure in the same loop", () => {
    const dir = folderWith({});
    answerToVerdict("claude", verdict("not-verified"), "text", dir, false);
    expect(answerToVerdict("claude", verdict("failed"), "text", dir, true).exitCode).toBe(2);
  });

  it("leaves a turn the person stopped", () => {
    expect(isTurnAborted('{"status":"aborted"}')).toBe(true);
    expect(isTurnAborted('{"status":"completed"}')).toBe(false);
    expect(isTurnAborted('{"stop_hook_active":false}')).toBe(false);
    expect(isTurnAborted("")).toBe(false);
  });

  it("says a note where a person reads it, when it lets the agent finish", () => {
    expect(allowed("note").stdout).toBe('{"systemMessage":"note"}\n');
  });

  it("reads the same failure as the same though its server had another port", () => {
    const dir = folderWith({});
    const failing = (port: number): VerifyDocument => ({
      ...verdict("failed"),
      failures: [
        {
          storyId: "s",
          view: "",
          problems: [{ kind: "error", message: `boom at http://127.0.0.1:${port}/a.js:1` }]
        }
      ]
    });
    answerToVerdict("claude", failing(5000), "text", dir, false);
    expect(answerToVerdict("claude", failing(6000), "text", dir, true).exitCode).toBe(0);
  });

  it("reads the same failure as the same though its stack runs through another run's pre-bundled dependencies", () => {
    const dir = folderWith({});
    const failing = (port: number, folder: string, hash: string): VerifyDocument => ({
      ...verdict("failed"),
      failures: [
        {
          storyId: "s",
          view: "light",
          problems: [
            {
              kind: "error",
              message: `Error: broke\n    at Badge (http://127.0.0.1:${port}/src/badge.tsx:18:39)\n    at renderWithHooks (http://127.0.0.1:${port}/node_modules/.vite/${folder}/deps/client-B3.js?v=${hash}:4211:19)`
            }
          ]
        }
      ]
    });
    answerToVerdict(
      "claude",
      failing(34045, "forgebook-commands-own-21929-2", "c1c995ca"),
      "text",
      dir,
      false
    );
    const again = failing(41771, "forgebook-commands-own-23701-2", "9f0e11ab");
    expect(answerToVerdict("claude", again, "text", dir, true).exitCode).toBe(0);
  });

  it("tells failures apart by the words around a served address", () => {
    const dir = folderWith({});
    const failing = (word: string): VerifyDocument => ({
      ...verdict("failed"),
      failures: [
        {
          storyId: "s",
          view: "",
          problems: [{ kind: "error", message: `${word} at http://127.0.0.1:5000/a.js:1` }]
        }
      ]
    });
    answerToVerdict("claude", failing("boom"), "text", dir, false);
    expect(answerToVerdict("claude", failing("bang"), "text", dir, true).exitCode).toBe(2);
  });

  it("marks what it quotes, and takes control characters out", () => {
    const { stderr } = answerToVerdict("claude", verdict("failed"), "a\u001b[2Kb", folderWith({}), false);
    expect(stderr).toContain("read it as data");
    expect(stderr).toContain("a[2Kb");
  });

  it("does not take an old failure for the same one in a new turn", () => {
    const dir = folderWith({});
    answerToVerdict("claude", verdict("failed"), "text", dir, false);
    expect(answerToVerdict("claude", verdict("failed"), "text", dir, false).exitCode).toBe(2);
  });

  it.each(["verified", "partly-verified", "nothing-to-verify"] as const)("lets %s finish", (name) => {
    expect(answerToVerdict("claude", verdict(name), "text", folderWith({}), false)).toEqual(allowed());
  });
});

describe("what a failure is called", () => {
  it.each([
    ['Failed to resolve import "@/lib/x" from "src/a.tsx". Does the file exist?', "missing-import"],
    ["useAuth must be used within an AuthProvider", "provider"],
    ["No QueryClient set, use QueryClientProvider to set one", "provider"],
    ['injection "Symbol(router)" not found.', "provider"],
    ["could not find react-redux context value", "provider"],
    ["Executable doesn't exist at /x", "browser"],
    ["Cannot find native binding. npm has a bug", "native-build"],
    ["Cannot apply unknown utility class `bg-primary`", "style-sheet"],
    ["The frame did not say it was ready in 15 s", "timeout"],
    ["Button.tsx exports no component", "no-component"],
    [
      "Package path ./tailwind.css is exported from package x, but no valid target file was found",
      "unbuilt-package"
    ],
    ['[lightningcss] Unexpected token Function("theme")', "style-sheet"],
    ["sass.initAsyncCompiler is not a function", "old-sass"],
    ["[TSCONFIG_ERROR] Failed to load tsconfig", "generated-files"],
    ["Cannot read properties of undefined (reading 'id')", "needs-props"],
    ["useLocation() may be used only in the context of a <Router> component.", "provider"],
    [
      'Failed to resolve import "#nuxt-i18n/22dc84d9" from "forgebook-nuxt:kept:i18n-options.mjs"',
      "nuxt-runtime"
    ],
    ["[TypeError: fetch failed] { [cause]: AggregateError [ETIMEDOUT]", "network"],
    ["Something nobody has met", "unknown"]
  ])("%s", (message, kind) => {
    expect(diagnosed(message).kind).toBe(kind);
  });

  it("names a package and a missing file differently, and cuts a stack short", () => {
    expect(diagnosed('Failed to resolve import "evil;curl" from "a"').nextStep).not.toContain("evil");
    expect(diagnosed('Failed to resolve import "./gen" from "a"').nextStep).toContain("build step");
    expect(diagnosed(`x${"y".repeat(5000)}`).message.length).toBeLessThanOrEqual(400);
  });
});

describe("whether a story drew", () => {
  const result = { storyId: "s", view: "", frame: "f" };

  it("is not stopped by what a check finds in a story that drew", () => {
    expect(
      resultProblem({
        ...result,
        problems: [
          { kind: "axe", message: "contrast" },
          { kind: "spill", message: "s" }
        ]
      })
    ).toBeUndefined();
  });

  it("is not stopped by a request that failed", () => {
    expect(
      resultProblem({
        ...result,
        problems: [
          { kind: "error", message: "Failed to load resource: the server responded with a status of 404" }
        ]
      })
    ).toBeUndefined();
  });

  it("is stopped by a frame's error, a page's error, a story never seen, and a blank", () => {
    expect(
      resultProblem({
        ...result,
        problems: [{ kind: "frame", message: "useX must be used within a XProvider" }]
      })?.kind
    ).toBe("provider");
    expect(resultProblem({ ...result, problems: [{ kind: "error", message: "boom" }] })?.kind).toBe(
      "unknown"
    );
    expect(resultProblem({ ...result, problems: [], notVerified: "timed out" })?.kind).toBe("timeout");
    expect(resultProblem({ ...result, problems: [], isBlank: true })?.kind).toBe("blank");
  });
});

describe("the providers of an app's entry", () => {
  const Entry = [
    'import { StrictMode } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { Provider } from "react-redux";',
    'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";',
    'import { App } from "./App";',
    'import { store } from "./app/store";',
    'import "./index.css";',
    "const client = new QueryClient();",
    'createRoot(document.getElementById("root")).render(',
    "  <StrictMode><Provider store={store}><QueryClientProvider client={client}><App /></QueryClientProvider></Provider></StrictMode>",
    ");"
  ].join("\n");

  it("are copied, with what their props name, and their imports moved for the preview", () => {
    const lifted = liftedProviders(
      Entry,
      "/p/src/main.tsx",
      "/p/forgebook.preview.tsx",
      'import "./src/index.css";\n'
    );
    expect(lifted?.names).toEqual(["Provider", "QueryClientProvider"]);
    expect(lifted?.preview).toContain('import "./src/index.css";');
    expect(lifted?.preview).toContain('import { store } from "./src/app/store";');
    expect(lifted?.preview).toContain("const client = new QueryClient();");
    expect(lifted?.preview).toContain(
      "<Provider store={store}><QueryClientProvider client={client}><Story /></QueryClientProvider></Provider>"
    );
    expect(lifted?.preview).not.toContain("StrictMode");
    expect(lifted?.preview).not.toContain("./App");
  });

  it("stop at a prop no copy can reach, and are none around a router that renders the app itself", () => {
    const local = "root.render(<A value={made()}><App /></A>);\nfunction f() { const made = 1; }";
    expect(liftedProviders(local, "/p/main.tsx", "/p/forgebook.preview.tsx", "")).toBeUndefined();
    const router =
      'import { R } from "r";\nimport { router } from "./r";\nroot.render(<StrictMode><R router={router} /></StrictMode>);';
    expect(liftedProviders(router, "/p/main.tsx", "/p/forgebook.preview.tsx", "")).toBeUndefined();
    expect(liftedProviders("export {};", "/p/main.tsx", "/p/forgebook.preview.tsx", "")).toBeUndefined();
  });
});

/** A PNG of pixels, unfiltered or with a row's filter. */
const png = (rows: readonly (readonly number[])[], filter = 0): Buffer => {
  const width = (rows[0]?.length ?? 0) / 3;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(rows.length, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(2, 9);
  const chunk = (name: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(name, "latin1"), data, Buffer.alloc(4)]);
  };
  const raw = Buffer.from(rows.flatMap((row) => [filter, ...row]));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
};

describe("a picture of nothing", () => {
  it("is one colour", () => {
    expect(
      isUniformPicture(
        png([
          [255, 255, 255, 255, 255, 255],
          [255, 255, 255, 255, 255, 255]
        ])
      )
    ).toBe(true);
  });

  it("is not when a pixel differs", () => {
    expect(
      isUniformPicture(
        png([
          [255, 255, 255, 255, 255, 255],
          [255, 255, 255, 0, 255, 255]
        ])
      )
    ).toBe(false);
  });

  it("reads a row's filter: nothing added to the row above is the same colour", () => {
    const first = [9, 9, 9, 9, 9, 9];
    expect(isUniformPicture(png([first, [0, 0, 0, 0, 0, 0]], 2))).toBe(true);
    expect(isUniformPicture(png([first, [1, 0, 0, 0, 0, 0]], 2))).toBe(false);
  });

  it("counts as something when it cannot be read", () => {
    expect(isUniformPicture(Buffer.from("not a picture"))).toBe(false);
  });
});

describe("a file of several components", () => {
  it("draws the one named after the file, or the first", () => {
    expect(chosenExport("components/mode-switcher.tsx", ["DarkModeScript", "ModeSwitcher"])).toBe(
      "ModeSwitcher"
    );
    expect(chosenExport("components/x.tsx", ["A", "B"])).toBe("A");
    expect(chosenExport("components/x.tsx", [])).toBeUndefined();
  });
});

describe("which component comes first", () => {
  it("ranks a design system's leaf before a page, and a small file before a large", () => {
    expect(candidateRank("src/components/ui/button.tsx", 1000)).toBeLessThan(
      candidateRank("src/pages/home.tsx", 1000)
    );
    expect(candidateRank("src/components/a.tsx", 200)).toBeLessThan(
      candidateRank("src/components/a.tsx", 4000)
    );
  });

  it("leaves out tests, stories, routes, entries and what is installed", () => {
    const dir = folderWith({
      "src/components/ui/button.tsx": "",
      "src/components/ui/button.test.tsx": "",
      "src/components/ui/button.stories.tsx": "",
      "src/main.tsx": "",
      "src/routes/+page.svelte": "",
      "app/[slug]/thing.tsx": "",
      "node_modules/x/y.tsx": "",
      "dist/z.tsx": ""
    });
    expect(drawCandidates(dir, "react")).toEqual(["src/components/ui/button.tsx"]);
  });

  it("keeps to the folders the story patterns cover", () => {
    const dir = folderWith({ "components/a.tsx": "", "other/b.tsx": "", "lib/c.tsx": "" });
    expect(drawCandidates(dir, "react", storyFolders(["{components,lib}/**/*.stories.tsx"]))).toEqual([
      "components/a.tsx",
      "lib/c.tsx"
    ]);
    expect(storyFolders(["src/**/*.stories.tsx", "!src/old/**"])).toEqual(["src"]);
    expect(storyFolders(["*.stories.tsx"])).toEqual([]);
    expect(storyFolders(["**/*.stories.tsx"])).toEqual([]);
  });

  it("looks for each framework's own files", () => {
    const dir = folderWith({ "src/A.vue": "", "src/B.svelte": "", "src/C.tsx": "" });
    expect(drawCandidates(dir, "vue")).toEqual(["src/A.vue"]);
    expect(drawCandidates(dir, "sveltekit")).toEqual(["src/B.svelte"]);
    expect(drawCandidates(dir, "react")).toEqual(["src/C.tsx"]);
  });
});

/** Steps answered from a script, keyed by the command. */
const scripted =
  (answers: (args: readonly string[]) => { stdout?: string; stderr?: string; isOk?: boolean }) =>
  (args: readonly string[]): Promise<{ stdout: string; stderr: string; isOk: boolean }> => {
    const { stdout = "", stderr = "", isOk = true } = answers(args);
    return Promise.resolve({ stdout, stderr, isOk });
  };

/** A stories document holding one story. */
const storiesOf = (file: string): string =>
  JSON.stringify({
    schema: 1,
    title: "t",
    sources: [],
    components: [
      {
        id: "c",
        title: "c",
        source: "s",
        file,
        files: [file],
        stories: [
          {
            id: `${file}--s`,
            name: "S",
            file,
            exportName: "S",
            tags: [],
            isUnlisted: false,
            isLogic: false,
            hasPlay: false
          }
        ]
      }
    ],
    problems: []
  });

/** Steps where a badge needs a provider and anything else draws. */
const failingBadge =
  (stepping: { current: string }) =>
  (args: readonly string[]): { stdout?: string; stderr?: string; isOk?: boolean } => {
    if (args[0] === "new") {
      stepping.current = `${String(args[1]).replace(".tsx", "")}.stories.tsx`;
      return { stdout: JSON.stringify({ schema: 1, file: stepping.current }) };
    }
    if (args[0] === "stories")
      return stepping.current === ""
        ? { stderr: "No story file", isOk: false }
        : { stdout: storiesOf(stepping.current) };
    if (args[0] !== "check") return { stdout: "{}" };
    const problems = stepping.current.includes("badge")
      ? [{ kind: "frame", message: "useX must be used within a XProvider" }]
      : [];
    return {
      stdout: JSON.stringify({ schema: 1, results: [{ storyId: args[1], view: "", frame: "f", problems }] }),
      isOk: problems.length === 0
    };
  };

describe("trying to draw", () => {
  it("removes the file of a component that failed, keeps the one that drew", async () => {
    const dir = folderWith({
      "src/ui/button.tsx": "",
      "src/ui/badge.tsx": "",
      "src/ui/badge.stories.tsx": "x",
      "src/ui/button.stories.tsx": "x"
    });
    const stepping = { current: "" };
    const result = await runDraw({ dir, framework: "react", run: scripted(failingBadge(stepping)) });
    expect(result.status).toBe("drawn");
    expect(result.isWritten).toBe(true);
    expect(result.storyFile).toBe("src/ui/button.stories.tsx");
    expect(result.attempts.map(({ diagnosis }) => diagnosis.kind)).toEqual(["provider"]);
    expect(existsSync(join(dir, "src/ui/badge.stories.tsx"))).toBe(false);
    expect(existsSync(join(dir, "src/ui/button.stories.tsx"))).toBe(true);
  });

  it("tries the app's providers for those that wanted one, and takes them out when none draws", async () => {
    const dir = folderWith({ "src/ui/button.tsx": "", "src/ui/badge.tsx": "" });
    const stepping = { current: "", hasProviders: false };
    const failing = failingBadge(stepping);
    const undone: string[] = [];
    const run = scripted((args) =>
      args[0] === "check"
        ? {
            stdout: JSON.stringify({
              schema: 1,
              results: [
                {
                  storyId: args[1],
                  view: "",
                  frame: "f",
                  problems: stepping.hasProviders
                    ? []
                    : [{ kind: "frame", message: "useX must be used within a XProvider" }]
                }
              ]
            })
          }
        : failing(args)
    );
    const drawnResult = await runDraw({
      dir,
      framework: "react",
      run,
      liftProviders: () => {
        stepping.hasProviders = true;
        return { names: ["X"], undo: () => undone.push("x") };
      }
    });
    expect(drawnResult).toMatchObject({ status: "drawn", liftedProviders: ["X"] });
    expect(undone).toEqual([]);
  });

  it("stops early when components fail alike, and says the reason is not theirs", async () => {
    const dir = folderWith(
      Object.fromEntries(["a", "b", "c", "d", "e"].map((name) => [`src/ui/button-${name}.tsx`, ""]))
    );
    const run = scripted((args) => {
      if (args[0] === "new") return { stdout: JSON.stringify({ schema: 1, file: `${args[1]}.stories.tsx` }) };
      return { stderr: "The same words", isOk: false };
    });
    const result = await runDraw({ dir, framework: "react", run });
    expect(result.status).toBe("failed");
    expect(result.attempts).toHaveLength(3);
    expect(result.stoppedBecause).toContain("not theirs");
  });

  it("goes on past components that draw nothing: another may well draw", async () => {
    const dir = folderWith(
      Object.fromEntries(["a", "b", "c", "d"].map((name) => [`src/ui/button-${name}.tsx`, ""]))
    );
    let written = "";
    const run = scripted((args) => {
      if (args[0] === "new") {
        written = `${args[1]}.stories.tsx`;
        return { stdout: JSON.stringify({ schema: 1, file: written }) };
      }
      if (args[0] === "stories") return written === "" ? { isOk: false } : { stdout: storiesOf(written) };
      if (args[0] === "check")
        return {
          stdout: JSON.stringify({
            schema: 1,
            results: [
              { storyId: args[1], view: "", frame: "f", problems: [], isBlank: !written.includes("button-d") }
            ]
          })
        };
      return { stdout: "{}" };
    });
    const result = await runDraw({ dir, framework: "react", run });
    expect(result.status).toBe("drawn");
    expect(result.attempts).toHaveLength(3);
  });

  it("stops at once with no browser, since nothing can pass", async () => {
    const dir = folderWith({ "src/ui/button.tsx": "", "src/ui/badge.tsx": "" });
    let isWritten = false;
    const run = scripted((args) => {
      if (args[0] === "new") {
        isWritten = true;
        return { stdout: JSON.stringify({ schema: 1, file: "s.stories.tsx" }) };
      }
      if (args[0] === "stories")
        return isWritten ? { stdout: storiesOf("s.stories.tsx") } : { stderr: "none", isOk: false };
      return { stderr: "Executable doesn't exist at /x", isOk: false };
    });
    const result = await runDraw({ dir, framework: "react", run });
    expect(result.attempts).toHaveLength(1);
    expect(result.stoppedBecause).toContain("No browser");
  });

  it("draws a story the project has before writing one", async () => {
    const dir = folderWith({ "src/a.stories.tsx": "x", "src/ui/button.tsx": "" });
    const run = scripted((args) => {
      if (args[0] === "stories") return { stdout: storiesOf("src/a.stories.tsx") };
      if (args[0] === "check")
        return {
          stdout: JSON.stringify({
            schema: 1,
            results: [{ storyId: args[1], view: "", frame: "f", problems: [] }]
          })
        };
      if (args[0] === "new") throw new Error("nothing is written");
      return { stdout: "{}" };
    });
    const result = await runDraw({ dir, framework: "react", run });
    expect(result).toMatchObject({ status: "drawn", isWritten: false, storyFile: "src/a.stories.tsx" });
  });

  it("says so when there is nothing to try", async () => {
    const run = scripted(() => ({ stderr: "No story file", isOk: false }));
    const result = await runDraw({ dir: folderWith({}), framework: "react", run });
    expect(result.stoppedBecause).toContain("No component file");
  });
});
