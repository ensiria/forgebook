/**
 * `forgebook proof` on a real browser: a small React catalogue with its own repository, compared with where it started in
 * one run, as the pull request's workflow runs it.
 *
 * @remarks
 * The repository and the base's checkout live under `test-results`, inside the fixture, so both resolve the project's
 * packages with nothing installed. The same commit against itself is what tells whether two builds draw the same.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/** The fixture's folder, whose packages the catalogue resolves. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

const CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({
  framework: react(),
  title: "Seeds",
  stories: ["src/*.stories.tsx"]
});
`;

const BUTTON = `/** Saves. */\nexport const Button = () => <button type="button">Save</button>;\n`;

const STORIES = `import { Button } from "./Button";

export default { title: "Actions/Button", component: Button };

export const Plain = {};
`;

/** The parts of the proof these tests read. */
type Proof = {
  readonly base: string;
  readonly head: string;
  readonly states: readonly {
    readonly storyId: string;
    readonly status: string;
    readonly pictures: { readonly before?: string; readonly after?: string; readonly marked?: string };
  }[];
  readonly same: number;
  readonly notChecked: readonly string[];
};

test.describe("forgebook proof on a real browser", () => {
  test.describe.configure({ mode: "serial" });
  let dir = "";
  let work = "";

  const git = (...args: readonly string[]): string => {
    const run = spawnSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      { cwd: dir, encoding: "utf8" }
    );
    expect(run.status, run.stderr).toBe(0);
    return run.stdout;
  };

  const proof = (...args: readonly string[]): { document: Proof; out: string; status: number | null } => {
    const out = mkdtempSync(join(work, "out-"));
    const run = spawnSync(
      process.execPath,
      [ENTRY, "proof", "--out", out, "--work", work, "--install", "", "--json", "--quick", ...args],
      { cwd: dir, encoding: "utf8", timeout: 230_000 }
    );
    expect(run.stdout, run.stderr).not.toBe("");
    return { document: JSON.parse(run.stdout), out, status: run.status };
  };

  test.beforeAll(() => {
    const parent = join(APP, "test-results");
    mkdirSync(parent, { recursive: true });
    dir = mkdtempSync(join(parent, "proof-"));
    work = mkdtempSync(join(parent, "proof-work-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "forgebook.config.ts"), CONFIG);
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n.vite/\n");
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true
        },
        include: ["src"]
      })
    );
    writeFileSync(join(dir, "src", "Button.tsx"), BUTTON);
    writeFileSync(join(dir, "src", "Button.stories.tsx"), STORIES);
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
  });

  test.afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  });

  test("two builds of one commit draw the same", () => {
    test.setTimeout(240_000);
    const { document } = proof("--base", "HEAD", "--all");
    expect(document.states).toEqual([]);
    expect(document.same).toBeGreaterThan(0);
  });

  test("a change shows as before and after, leaves no worktree, and needs no baseline", () => {
    test.setTimeout(240_000);
    git("switch", "-q", "-c", "change");
    writeFileSync(
      join(dir, "src", "Button.tsx"),
      `/** Saves. */\nexport const Button = () => <button type="button" style={{ padding: 40 }}>Save it now</button>;\n`
    );
    git("add", "-A");
    git("commit", "-q", "-m", "bigger");
    const { document, out } = proof("--base", "main");
    const [state] = document.states;
    expect(state?.status).toMatch(/changed|resized/);
    for (const picture of [state?.pictures.before, state?.pictures.after]) {
      expect(existsSync(join(out, picture ?? "missing"))).toBe(true);
    }
    const comment = readFileSync(join(out, "comment.md"), "utf8");
    expect(comment).toContain("#### Not checked");
    expect(comment).toContain("only the default view pictured");
    expect(readFileSync(join(out, "index.html"), "utf8")).toContain("<img");
    expect(git("worktree", "list").trim().split("\n")).toHaveLength(1);
    expect(existsSync(join(dir, "forgebook-baselines"))).toBe(false);
    expect(git("status", "--porcelain")).toBe("");
  });

  test("a baseline committed by the branch moves nothing, as none is read", () => {
    test.setTimeout(240_000);
    mkdirSync(join(dir, "forgebook-baselines"));
    writeFileSync(
      join(dir, "forgebook-baselines", "seeds--actions-button--plain--default.png"),
      "not a picture"
    );
    git("add", "-A");
    git("commit", "-q", "-m", "approve my own picture");
    const { document } = proof("--base", "main");
    expect(document.states[0]?.status).toMatch(/changed|resized/);
  });

  test("a story the branch deletes is named as removed", () => {
    test.setTimeout(240_000);
    writeFileSync(
      join(dir, "src", "Button.stories.tsx"),
      STORIES.replace("export const Plain = {};", "export const Other = {};")
    );
    git("add", "-A");
    git("commit", "-q", "-m", "rename");
    const { document, out } = proof("--base", "main");
    const removed = document.states.find((state) => state.status === "removed");
    expect(removed?.storyId).toContain("plain");
    expect(existsSync(join(out, removed?.pictures.before ?? "missing"))).toBe(true);
  });

  test("an edit to what makes the proof is named", () => {
    test.setTimeout(240_000);
    writeFileSync(join(dir, "forgebook.config.ts"), `${CONFIG}// edited\n`);
    git("add", "-A");
    git("commit", "-q", "-m", "config");
    const { document } = proof("--base", "main");
    expect(document.notChecked.join("\n")).toContain("edits what makes this proof");
    expect(document.notChecked.join("\n")).toContain("forgebook.config.ts");
  });
});
