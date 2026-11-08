/**
 * `forgebook verify` on a real browser, on a catalogue whose story already fails an accessibility rule on the base: a
 * change that brings nothing new passes and names the old problem, one that brings a new problem fails on it alone.
 *
 * @remarks
 * Its repository lives under `test-results`, inside the fixture so the project's packages resolve; the base runs in a
 * worktree beside it, which the command removes. No test opens the suite's dev server.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { expect, test } from "@playwright/test";

/** The fixture's folder, whose packages the catalogue resolves. */
const APP = join(import.meta.dirname, "..");

/** The `forgebook` command's entry. */
const ENTRY = join(APP, "..", "..", "packages", "forgebook", "bin", "forgebook", "forgebook.mts");

const CONFIG = `import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: react(), title: "Base", stories: ["src/*.stories.tsx"] });
`;

/** A button whose text is too pale on its background: a contrast failure the base already has. */
const PALE = (label: string, extra = ""): string =>
  `export const Button = () => <>${extra}<button type="button" style={{ color: "#f4f4f4", background: "#ffffff" }}>${label}</button></>;\n`;

const STORIES = `import { Button } from "./Button";

export default { title: "Actions/Button", component: Button };

export const Plain = {};
`;

/** The parts of `verify`'s answer these tests read. */
type VerifyAnswer = {
  readonly verdict: string;
  readonly summary: string;
  readonly problems: number;
  readonly failures: readonly { readonly problems: readonly { readonly rule?: string }[] }[];
  readonly existing?: { readonly problems: number };
};

test.describe("forgebook verify against the base", () => {
  test.describe.configure({ mode: "serial" });
  let dir = "";

  const git = (...args: readonly string[]): void => {
    const run = spawnSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
      {
        cwd: dir,
        encoding: "utf8"
      }
    );
    expect(run.status, run.stderr).toBe(0);
  };

  const verify = (): { answer: VerifyAnswer; status: number | null } => {
    const run = spawnSync(
      process.execPath,
      [ENTRY, "verify", "--since", "HEAD", "--quick", "--json", "--url", "http://127.0.0.1:9"],
      {
        cwd: dir,
        encoding: "utf8",
        timeout: 170_000
      }
    );
    return { answer: JSON.parse(run.stdout), status: run.status };
  };

  test.beforeAll(() => {
    const parent = join(APP, "test-results");
    mkdirSync(parent, { recursive: true });
    dir = mkdtempSync(join(parent, "verify-base-"));
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
    writeFileSync(join(dir, "src", "Button.tsx"), PALE("Save"));
    writeFileSync(join(dir, "src", "Button.stories.tsx"), STORIES);
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
  });

  test.afterEach(() => {
    git("checkout", "-q", ".");
    git("clean", "-fdq");
  });

  test.afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("passes a change that brings no new problem, and counts the old one apart", () => {
    test.setTimeout(240_000);
    writeFileSync(join(dir, "src", "Button.tsx"), PALE("Save it"));
    const { answer, status } = verify();
    expect(answer.problems, answer.summary).toBe(0);
    expect(answer.existing?.problems).toBeGreaterThan(0);
    expect(answer.summary).toContain("the stories had before the change not counted");
    expect(status).toBe(0);
    // the base's worktree is gone
    const siblings = readdirSync(dirname(dir)).filter((name) =>
      name.startsWith(`.${basename(dir)}-forgebook-base-`)
    );
    expect(siblings).toEqual([]);
    expect(existsSync(join(dir, "src", "Button.tsx"))).toBe(true);
  });

  test("fails on a problem the change brings, and on that one alone", () => {
    test.setTimeout(240_000);
    writeFileSync(join(dir, "src", "Button.tsx"), PALE("Save", '<img src="data:," />'));
    const { answer, status } = verify();
    expect(answer.verdict).toBe("failed");
    expect(status).not.toBe(0);
    const rules = answer.failures.flatMap((each) => each.problems).map((each) => each.rule);
    expect(rules).toContain("image-alt");
    expect(rules).not.toContain("color-contrast");
  });
});
