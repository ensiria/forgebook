/**
 * Tests for the base's worktree when `verify` runs inside a git hook: git names the index of the commit being made in
 * `GIT_INDEX_FILE`, and checking the base out must neither fail on it nor write into it.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { configOf } from "../bin/forgebook/catalogueCommands.ts";
import { runOnBase } from "../bin/forgebook/verifyBase.ts";
import { STUB_FRAMEWORK } from "./fixtures/stubFramework.ts";

let root = "";
let counter = 0;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "forgebook-base-worktree-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Runs git in a folder, and answers what it wrote. */
const git = (dir: string, ...args: readonly string[]): string =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd: dir,
    encoding: "utf8"
  }).stdout;

/** A repository holding a catalogue, one commit in, with a change staged for the next. */
const stagedChange = (): { readonly dir: string; readonly base: string } => {
  counter += 1;
  const dir = join(root, `p${counter}`);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "forgebook.config.ts"),
    `export default ${JSON.stringify({ framework: STUB_FRAMEWORK, title: "t", stories: ["src/*.stories.tsx"] })};\n`
  );
  writeFileSync(join(dir, "src", "Card.tsx"), "export const Card = () => <p />;\n");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "first");
  writeFileSync(join(dir, "src", "Card.tsx"), "export const Card = () => <p>changed</p>;\n");
  git(dir, "add", "-A");
  return { dir, base: git(dir, "rev-parse", "HEAD").trim() };
};

describe("the base's worktree, from a git hook", { timeout: 60_000 }, () => {
  it.each([
    ["absolute, as git commit -a names it", (dir: string): string => join(dir, ".git", "index")],
    ["relative, as git commit names it", (): string => ".git/index"]
  ])("leaves the commit's index as it was when GIT_INDEX_FILE is %s", async (_name, indexFile) => {
    const { dir, base } = stagedChange();
    const config = await configOf(join(dir, "forgebook.config.ts"));
    // the run's environment, as git gives it to a hook
    const run = await runOnBase(config, base, [], false, { ...env, GIT_INDEX_FILE: indexFile(dir) });
    expect(typeof run === "string" ? run : "").not.toContain("index file");
    expect(git(dir, "diff", "--cached", "--name-only").trim()).toBe("src/Card.tsx");
  });
});
