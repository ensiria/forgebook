/**
 * The files of a change sorted by kind, `git diff --numstat -z` read, the scope, and the judges' diff redacted.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import {
  fileKind,
  isForJudges,
  isOutsideScope,
  parseNumstat,
  REDACTED,
  redactedDiff
} from "./changedFiles.ts";

describe("a changed file's kind", () => {
  it("sorts the product, its tests, stories, set-up and lockfiles", () => {
    expect(fileKind("src/features/apps/index.tsx")).toBe("product");
    expect(fileKind("src/components/a.test.tsx")).toBe("test");
    expect(fileKind("src/components/a.stories.tsx")).toBe("story");
    expect(fileKind("forgebook.preview.tsx")).toBe("tooling");
    expect(fileKind(".claude/settings.json")).toBe("tooling");
    expect(fileKind("AGENTS.md")).toBe("tooling");
    expect(fileKind(".github/workflows/forgebook-verify.yml")).toBe("tooling");
    expect(fileKind(".github/workflows/ci.yml")).toBe("product");
    expect(fileKind("pnpm-lock.yaml")).toBe("lockfile");
  });

  it("shows judges the product and its tests only", () => {
    expect(isForJudges("product")).toBe(true);
    expect(isForJudges("test")).toBe(true);
    expect(isForJudges("story")).toBe(false);
    expect(isForJudges("tooling")).toBe(false);
  });
});

describe("git's numstat", () => {
  it("reads plain entries, binaries and renames", () => {
    const output = "3\t1\tsrc/a.tsx\0-\t-\timg.png\0" + "2\t0\t\0old.tsx\0new.tsx\0";
    expect(parseNumstat(output)).toEqual([
      { path: "src/a.tsx", added: 3, removed: 1 },
      { path: "img.png", added: 0, removed: 0 },
      { path: "new.tsx", added: 2, removed: 0 }
    ]);
  });
});

describe("the task's scope", () => {
  it("takes files and folders", () => {
    expect(isOutsideScope("src/features/apps/x.tsx", ["src/features/apps/"])).toBe(false);
    expect(isOutsideScope("src/a.tsx", ["src/a.tsx"])).toBe(false);
    expect(isOutsideScope("src/b.tsx", ["src/a.tsx", "src/features/"])).toBe(true);
  });
});

describe("the judges' diff", () => {
  it("names the tool nowhere, and counts what it took out", () => {
    const { text, redactions } = redactedDiff("+// checked with Forgebook\n+import x from 'forgebook'\n");
    expect(text).not.toMatch(/forgebook/i);
    expect(text).toContain(REDACTED);
    expect(redactions).toBe(2);
  });
});
