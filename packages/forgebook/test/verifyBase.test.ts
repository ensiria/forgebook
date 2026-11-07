/**
 * Tests for telling the problems a change brought from those its stories had on the base.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { problemKey, splitByBase } from "../bin/forgebook/verifyBase.ts";
import { type VerifyFindings, verifyDocument } from "../bin/forgebook/verifyVerdict.ts";
import type { StoryCheckReport, StoryProblem } from "../src/storyCheck.ts";

const CONTRAST: StoryProblem = {
  kind: "axe",
  rule: "color-contrast",
  element: "button",
  message: "low contrast"
};
const NAME: StoryProblem = { kind: "axe", rule: "button-name", element: "button", message: "no name" };

/** A report of one story in one view. */
const report = (...problems: readonly StoryProblem[]): StoryCheckReport => ({
  schema: 1,
  results: [{ storyId: "kit:button--plain", view: "", frame: "f", problems }]
});

describe("problemKey", () => {
  it("is the same for the same problem whatever the addresses and folders in its message", () => {
    const result = { storyId: "s", view: "" };
    const head = {
      kind: "frame" as const,
      message: "Failed at http://localhost:5173/src/x.tsx in /repo/src/x.tsx"
    };
    const base = {
      kind: "frame" as const,
      message: "Failed at http://localhost:61234/src/x.tsx in /base/src/x.tsx"
    };
    expect(problemKey(result, head, ["/repo", "/base"])).toBe(problemKey(result, base, ["/repo", "/base"]));
  });
});

describe("splitByBase", () => {
  it("keeps what the change brought and sets apart what the base had too", () => {
    const { report: brought, existing } = splitByBase(report(CONTRAST, NAME), report(CONTRAST), ["/a", "/b"]);
    expect(brought.results[0]?.problems).toEqual([NAME]);
    expect(existing[0]?.problems).toEqual([CONTRAST]);
  });
});

/** What verify concludes, from a change covered by the badge's story and the given reports. */
const verdictOf = (
  head: StoryCheckReport,
  baseRun?: VerifyFindings["baseRun"]
): ReturnType<typeof verifyDocument> =>
  verifyDocument({
    since: "HEAD",
    base: "abc",
    changed: {
      schema: 1,
      since: "HEAD",
      files: ["src/Button.tsx"],
      stories: [
        {
          id: "kit:button--plain",
          title: "Button",
          links: { address: "a", component: "c", frame: "f", embed: "e" }
        }
      ],
      uiFiles: [
        { file: "src/Button.tsx", path: "src/Button.tsx", coverage: "own", stories: ["kit:button--plain"] }
      ],
      outside: [],
      problems: []
    },
    code: { schema: 1, since: "HEAD", checked: ["raw-color"], skipped: [], problems: [] },
    report: head,
    notRun: undefined,
    isQuick: false,
    isSinceNamed: true,
    ...(baseRun === undefined ? {} : { baseRun })
  });

describe("splitByBase, counted", () => {
  it("matches each of the base's problems once: a second copy of an old frame error is new", () => {
    const error: StoryProblem = { kind: "error", message: "Boom at /a/src/x.tsx:3:7" };
    const head = report(error, { ...error, message: "Boom at /a/src/x.tsx:9:1" });
    const { report: brought, existing } = splitByBase(
      head,
      report({ ...error, message: "Boom at /b/src/x.tsx:4:2" }),
      ["/a", "/b"]
    );
    expect(existing[0]?.problems).toHaveLength(1);
    expect(brought.results[0]?.problems).toHaveLength(1);
  });

  it("keys an accessibility problem on its element, whatever its message measures", () => {
    const { existing } = splitByBase(
      report({ ...CONTRAST, message: "ratio 1.1" }),
      report({ ...CONTRAST, message: "ratio 1.2" }),
      []
    );
    expect(existing).toHaveLength(1);
  });

  it("counts every problem of a story the base never saw in its final state", () => {
    const base: StoryCheckReport = {
      schema: 1,
      results: [
        { storyId: "kit:button--plain", view: "", frame: "f", problems: [CONTRAST], notVerified: "gave up" }
      ]
    };
    const split = splitByBase(report(CONTRAST), base, []);
    expect(split.existing).toEqual([]);
    expect(split.unseen).toBe(1);
  });
});

describe("verifyDocument with the base", () => {
  it("passes a change that brought no problem, and says how many the base had", () => {
    const document = verdictOf(report(CONTRAST), {
      base: "abc",
      run: { report: report(CONTRAST), folder: "/b", root: "/a" }
    });
    expect(document.verdict).toBe("verified");
    expect(document.problems).toBe(0);
    expect(document.existing?.problems).toBe(1);
    expect(document.summary).toContain("1 problem the stories had before the change not counted");
    expect(document.skipped.join(" ")).not.toContain("before the change");
  });

  it("fails on what the change brought", () => {
    const document = verdictOf(report(CONTRAST, NAME), {
      base: "abc",
      run: { report: report(CONTRAST), folder: "/b", root: "/a" }
    });
    expect(document.verdict).toBe("failed");
    expect(document.failures[0]?.problems).toEqual([NAME]);
  });

  it("counts every problem, and says so, when the base could not run", () => {
    const document = verdictOf(report(CONTRAST), {
      base: "abcdef",
      run: "git worktree failed"
    });
    expect(document.verdict).toBe("failed");
    expect(document.skipped.join(" ")).toContain("not compared with abcdef: git worktree failed");
    expect(document.existing).toBeUndefined();
  });

  it("counts every problem of a story the base does not have", () => {
    const document = verdictOf(report(NAME), {
      base: "abc",
      run: 'No story or component "kit:button--plain"'
    });
    expect(document.verdict).toBe("failed");
    expect(document.existing?.problems).toBe(0);
  });
});
