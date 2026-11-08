/**
 * What `forgebook init --agents` writes for a project's coding agents: `.mcp.json`, the instructions and the skill, the CI
 * workflow, and a hook that runs `verify` when an assistant finishes or before a commit.
 *
 * @remarks
 * Every file is merged or left as it is, never replaced: `.mcp.json` and the assistants' settings keep what they hold, the
 * instructions go between their markers, a workflow or a pre-commit hook already there stays and is named. They go at the
 * repository's root, where assistants and CI start, and they find a package's catalogue through its folder. Which hooks is
 * asked with `--hooks`; by default those of the assistants the repository shows signs of, and otherwise a pre-commit hook,
 * which any assistant meets. A file that is a link is never written through. Nothing here runs the project's code.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

import { VITE_PATHS } from "../../../src/vite/vitePaths.ts";
import { agentsSection } from "../agentGuide.ts";
import { agentsSkill, SKILL_FOLDERS, withAgentsSection } from "../agentsText.ts";
import type { NextStep, PackageManagerName } from "../newProject/newProject.types.ts";
import {
  ASSISTANT_NAMES,
  ASSISTANTS,
  type AssistantName,
  type MergedFile,
  withMcpServer,
  withStopHook
} from "./assistantHooks.ts";
import { WORKFLOW_FILE, workflowText } from "./ciWorkflow.ts";
import { forgebookCommandLine, isPlainFolder, mcpServerOf } from "./projectRunner.ts";

/** A hook `--hooks` names: an assistant's, or the commit's. */
export type HookName = AssistantName | "pre-commit";

/** The lock files a locked install reads. */
const LOCK_FILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"];

/** How an assistant's hook names the project's root, for those whose documentation gives one. */
const PROJECT_ROOT_VARIABLE: Partial<Readonly<Record<AssistantName, string>>> = {
  claude: "$CLAUDE_PROJECT_DIR/",
  gemini: "$GEMINI_PROJECT_DIR/"
};

/** What marks a pre-commit hook as written here. */
const OWN_PRE_COMMIT = /forgebook\b.*\bverify/;

/** The hook written, and what it can do. */
export type WrittenHook = {
  /** Which. */
  readonly name: HookName;
  /** Its file, from the repository's root. */
  readonly file: string;
  /** Whether it refuses to finish, starts another turn, or refuses the commit. */
  readonly effect: "blocks" | "continues" | "blocks-commit";
};

/** What came of the files. */
export type AgentFiles = {
  /** The repository's root, from the project's folder; `.` when they are the same. */
  readonly root: string;
  /** The files written or merged, from the root. */
  readonly written: readonly string[];
  /** The files that already held what they should. */
  readonly unchanged: readonly string[];
  /** The hooks in place. */
  readonly hooks: readonly WrittenHook[];
  /** What it could not do. */
  readonly nextSteps: readonly NextStep[];
};

/**
 * A project's repository root: the nearest folder holding `.git` whose repository tracks it, or the project's otherwise.
 *
 * @param projectDir - the project's folder.
 */
export const repositoryRoot = (projectDir: string): string => {
  let dir = projectDir;
  while (true) {
    if (existsSync(join(dir, ".git"))) return isTrackedBy(dir, projectDir) ? dir : projectDir;
    const parent = dirname(dir);
    if (parent === dir || dir === homedir()) return projectDir;
    dir = parent;
  }
};

/**
 * Whether a repository holds a project: a home folder kept in git is above many projects it knows nothing of, and what is
 * written at its root would be that person's settings for every project.
 *
 * @param root - the repository's folder.
 * @param projectDir - the project's folder.
 */
const isTrackedBy = (root: string, projectDir: string): boolean => {
  if (root === projectDir) return true;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", join(projectDir, "package.json")], {
      cwd: root,
      stdio: "pipe"
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * The hooks to write when none are named: those of the assistants the repository shows signs of, otherwise the commit's.
 *
 * @param root - the repository's root.
 */
export const detectedHooks = (root: string): readonly HookName[] => {
  const used = ASSISTANT_NAMES.filter((name) =>
    ASSISTANTS[name].markers.some((marker) => existsSync(join(root, marker)))
  );
  return used.length === 0 ? ["pre-commit"] : used;
};

/** What the run has done so far. */
type Written = {
  readonly written: string[];
  readonly unchanged: string[];
  readonly nextSteps: NextStep[];
};

/** Whether a path, or a folder on the way to it from the root, is a link: writing through one would change a file elsewhere. */
const isLink = (root: string, name: string): boolean => {
  const parts = name.split("/");
  return parts.some(
    (_, index) =>
      lstatSync(join(root, ...parts.slice(0, index + 1)), { throwIfNoEntry: false })?.isSymbolicLink() ===
      true
  );
};

/** A file's text; none when it is not there. */
const readIfThere = (file: string): string | undefined =>
  existsSync(file) ? readFileSync(file, "utf8") : undefined;

/** Writes a file, its folder made. */
const writeInto = (file: string, text: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

/**
 * Applies a merge to a file.
 *
 * @param root - the repository's root.
 * @param name - the file, from there.
 * @param merge - what to make of its text.
 * @param done - what the run has done.
 * @returns whether the file holds what it should now.
 */
const mergeFile = (
  root: string,
  name: string,
  merge: (text: string | undefined) => MergedFile,
  done: Written
): boolean => {
  const file = join(root, name);
  if (isLink(root, name)) {
    done.nextSteps.push({
      kind: "setup",
      file: name,
      message: `${name} is a link, so it was left as it is: add Forgebook to it by hand`
    });
    return false;
  }
  const text = readIfThere(file);
  const merged = merge(text);
  if (merged.kind === "unreadable") {
    done.nextSteps.push({
      kind: "setup",
      file: name,
      message: `${name} could not be read as the JSON it should be, so it was left as it is: add Forgebook to it by hand`
    });
    return false;
  }
  if (merged.kind === "unchanged" || merged.text === text) {
    done.unchanged.push(name);
    return true;
  }
  writeInto(file, merged.text);
  done.written.push(name);
  return true;
};

/** Writes the instructions into `AGENTS.md`, between their markers, and the skill. */
const writeInstructions = (root: string, framework: string, done: Written): void => {
  const section = agentsSection([framework]);
  mergeFile(root, "AGENTS.md", (text) => ({ kind: "written", text: withAgentsSection(text, section) }), done);
  for (const folder of SKILL_FOLDERS)
    mergeFile(root, `${folder}/SKILL.md`, () => ({ kind: "written", text: agentsSkill(section) }), done);
};

/** Writes the workflow on a repository with GitHub's signs, leaving one there; another host is told. */
const writeWorkflow = (root: string, manager: PackageManagerName, folder: string, done: Written): void => {
  const file = join(root, WORKFLOW_FILE);
  if (isLink(root, WORKFLOW_FILE)) {
    done.nextSteps.push({
      kind: "setup",
      file: WORKFLOW_FILE,
      message: `${WORKFLOW_FILE} is a link, so no workflow was written`
    });
    return;
  }
  if (existsSync(file)) {
    done.unchanged.push(WORKFLOW_FILE);
    return;
  }
  const isGitHub =
    existsSync(join(root, ".github")) ||
    /github\.com/.test(readIfThere(join(root, ".git", "config")) ?? "") ||
    !existsSync(join(root, ".git"));
  if (!isGitHub) {
    done.nextSteps.push({
      kind: "setup",
      file: undefined,
      message: `This repository is not on GitHub, so no workflow was written: in its CI, run ${forgebookCommandLine(manager, folder, "browser --with-deps")}, then ${forgebookCommandLine(manager, folder, "verify --since <target branch>")}`
    });
    return;
  }
  const hasLockFile = LOCK_FILES.some((name) => existsSync(join(root, name)));
  writeInto(file, workflowText(manager, folder, hasLockFile));
  done.written.push(WORKFLOW_FILE);
};

/** The folder a repository's git hooks are read from, as git says; none outside a repository or with `core.hooksPath`. */
const gitHooksFolder = (root: string): string | undefined => {
  try {
    const custom = execFileSync("git", ["config", "core.hooksPath"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe"
    });
    if (custom.trim() !== "") return undefined;
  } catch {
    // git says nothing when it is not set, by failing
  }
  try {
    const path = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-path", "hooks"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe"
    });
    // git may name the folder in a short form (Windows' 8.3 names): the long one, as the root is named, compares
    const folder = path.trim();
    return existsSync(folder) ? realpathSync.native(folder) : folder;
  } catch {
    return undefined;
  }
};

/** The text of a pre-commit hook. */
const preCommitLines = (command: string): string =>
  "# Written by forgebook init --agents: a change whose UI is red does not get committed\n" +
  // a teammate who has not installed yet commits as before: a hook that cannot run must not stop every commit
  `if ${command.replace(" verify --quick", " --version")} >/dev/null 2>&1; then\n  ${command}\nfi\n`;

/** Adds `verify` to Husky's hook, which the repository keeps under version control. */
const writeHusky = (root: string, command: string, done: Written): WrittenHook | undefined => {
  const name = ".husky/pre-commit";
  const file = join(root, name);
  if (isLink(root, name)) {
    done.nextSteps.push({
      kind: "setup",
      file: name,
      message: `${name} is a link, so it was left as it is: add \`${command}\` to it`
    });
    return undefined;
  }
  const text = readIfThere(file) ?? "";
  if (OWN_PRE_COMMIT.test(text)) done.unchanged.push(name);
  else {
    writeInto(file, `${text.replace(/\n*$/, text === "" ? "" : "\n")}${preCommitLines(command)}`);
    chmodSync(file, 0o755);
    done.written.push(name);
  }
  return { name: "pre-commit", file: name, effect: "blocks-commit" };
};

/** Writes the commit's hook where the repository's tools keep it, or says why it did not. */
const writePreCommit = (root: string, command: string, done: Written): WrittenHook | undefined => {
  if (existsSync(join(root, ".husky"))) return writeHusky(root, command, done);
  const other = ["lefthook.yml", ".lefthook.yml", ".pre-commit-config.yaml"].find((name) =>
    existsSync(join(root, name))
  );
  const folder = other === undefined ? gitHooksFolder(root) : undefined;
  const file = folder === undefined ? undefined : join(folder, "pre-commit");
  // set up again, a hook that already runs verify (an earlier run's) is this one's own, not a setup of the repository's
  if (
    file !== undefined &&
    lstatSync(file, { throwIfNoEntry: false })?.isFile() === true &&
    OWN_PRE_COMMIT.test(readIfThere(file) ?? "")
  ) {
    const shown = VITE_PATHS.normalize(relative(realpathSync.native(root), file));
    done.unchanged.push(shown);
    return { name: "pre-commit", file: shown, effect: "blocks-commit" };
  }
  const isTaken =
    file === undefined ||
    existsSync(file) ||
    lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink() === true;
  if (isTaken) {
    done.nextSteps.push({
      kind: "setup",
      file: other,
      message: `The repository's commits have a hook setup of their own${other === undefined ? "" : ` (${other})`}, which was left as it is: add \`${command}\` to it`
    });
    return undefined;
  }
  writeInto(file, `#!/bin/sh\n${preCommitLines(command)}`);
  chmodSync(file, 0o755);
  const shown = VITE_PATHS.normalize(relative(realpathSync.native(root), file));
  done.written.push(shown);
  done.nextSteps.push({
    kind: "setup",
    file: shown,
    message: `${shown} holds the commit's hook, and git does not share that folder: a teammate's clone has none, so commit a hook setup (Husky, Lefthook) if they should have it too`
  });
  return { name: "pre-commit", file: shown, effect: "blocks-commit" };
};

/** Writes one hook. */
const writeHook = (
  root: string,
  name: HookName,
  manager: PackageManagerName,
  folder: string,
  done: Written
): WrittenHook | undefined => {
  if (name === "pre-commit")
    return writePreCommit(root, forgebookCommandLine(manager, folder, "verify --quick"), done);
  const assistant = ASSISTANTS[name];
  // these two name their project's root, so a hook started from another folder still finds the package
  const base = PROJECT_ROOT_VARIABLE[name] ?? "";
  const command = forgebookCommandLine(manager, folder, `hook ${name}`, base);
  if (!mergeFile(root, assistant.file, (text) => withStopHook(name, text, command), done)) return undefined;
  if (assistant.caveat !== undefined)
    done.nextSteps.push({
      kind: "setup",
      file: assistant.file,
      message: `${assistant.caveat}: ${assistant.file}`
    });
  return { name, file: assistant.file, effect: assistant.effect };
};

/** What the files are written for. */
export type AgentFilesRequest = {
  /** The project's folder. */
  readonly projectDir: string;
  /** The adapter's name. */
  readonly framework: string;
  /** The package manager. */
  readonly manager: PackageManagerName;
  /** The hooks asked for by name (`--hooks`); those found when none. */
  readonly hooks: readonly string[] | undefined;
};

/**
 * Writes what a project's coding agents need.
 *
 * @param request - what for.
 */
export const writeAgentFiles = ({ projectDir, framework, manager, hooks }: AgentFilesRequest): AgentFiles => {
  const root = repositoryRoot(projectDir);
  const folder = VITE_PATHS.normalize(relative(root, projectDir));
  const done: Written = { written: [], unchanged: [], nextSteps: [] };
  if (!isPlainFolder(folder))
    return {
      root: VITE_PATHS.normalize(relative(projectDir, root)) || ".",
      written: [],
      unchanged: [],
      hooks: [],
      nextSteps: [
        {
          kind: "setup",
          file: undefined,
          message:
            "This folder's name holds characters a shell or a workflow would read as code, so nothing was written for the agents: run forgebook init --agents from a folder with a plain name"
        }
      ]
    };
  // before anything is written: the skill's own folder must not read as a sign of an assistant
  const names: readonly HookName[] =
    hooks === undefined
      ? detectedHooks(root)
      : [...ASSISTANT_NAMES, "pre-commit" as const].filter((name) => hooks.includes(name));
  mergeFile(root, ".mcp.json", (text) => withMcpServer(text, mcpServerOf(manager, folder)), done);
  writeInstructions(root, framework, done);
  writeWorkflow(root, manager, folder, done);
  const written = names.flatMap((name) => {
    const hook = writeHook(root, name, manager, folder, done);
    return hook === undefined ? [] : [hook];
  });
  return {
    root: VITE_PATHS.normalize(relative(projectDir, root)) || ".",
    written: done.written,
    unchanged: done.unchanged,
    hooks: written,
    nextSteps: done.nextSteps
  };
};
