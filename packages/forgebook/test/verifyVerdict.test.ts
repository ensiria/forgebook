/**
 * Tests for what `verify` concludes, on a seeded set of changes: no change with something wrong may read as passed, and a
 * check that did not run is never counted as one that passed.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { verifyText } from "../bin/forgebook/agentText.ts";
import { isVerifyFailure } from "../bin/forgebook/verifyRun.ts";
import { type VerifyFindings, verifyDocument } from "../bin/forgebook/verifyVerdict.ts";
import type { StoryCheckReport } from "../src/storyCheck.ts";
import type {
  ChangedStoriesDocument,
  ChangedUiFile,
  CheckedCodeDocument,
  VisibilityDocument
} from "../src/vite/agent.types.ts";

const STORY = "kit:badge--plain";

const covered = (file: string, coverage: "own" | "through" = "own"): ChangedUiFile => ({
  file,
  path: file,
  coverage,
  stories: [STORY]
});

const changedOf = (
  uiFiles: readonly ChangedUiFile[],
  extra: Partial<ChangedStoriesDocument> = {}
): ChangedStoriesDocument => ({
  schema: 1,
  since: "HEAD",
  files: uiFiles.map((each) => each.file),
  stories: uiFiles.some((each) => each.stories.length > 0)
    ? [
        {
          id: STORY,
          title: "Badge",
          links: { address: "a", component: "c", frame: "f", embed: "e" }
        }
      ]
    : [],
  uiFiles,
  outside: [],
  problems: [],
  ...extra
});

const CLEAN_CODE: CheckedCodeDocument = {
  schema: 1,
  since: "HEAD",
  checked: ["raw-color", "raw-size", "suppression", "deleted-test"],
  skipped: [],
  problems: []
};

const PASSING: StoryCheckReport = {
  schema: 1,
  results: [{ storyId: STORY, view: "light", frame: "f", problems: [] }]
};

const NOTHING_UNSEEN: VisibilityDocument = {
  schema: 1,
  since: "HEAD",
  packages: [],
  checked: 0,
  unseen: [],
  skipped: []
};

const findings = (extra: Partial<VerifyFindings>): VerifyFindings => ({
  since: "HEAD",
  base: "abc",
  changed: changedOf([covered("src/Badge.tsx")]),
  code: CLEAN_CODE,
  visibility: NOTHING_UNSEEN,
  report: PASSING,
  notRun: undefined,
  isQuick: false,
  isSinceNamed: true,
  ...extra
});

/** Seeded changes that are not done, each of which must exit non-zero. */
const NOT_DONE: readonly { readonly name: string; readonly seed: VerifyFindings; readonly says: string }[] = [
  {
    name: "a changed published component an agent cannot see",
    seed: findings({
      visibility: {
        ...NOTHING_UNSEEN,
        packages: ["kit"],
        checked: 1,
        unseen: [
          {
            file: "src/Badge.tsx",
            component: "Badge",
            reasons: [{ missing: "tsdoc", reason: "Badge has no TSDoc", fix: "write one" }]
          }
        ]
      }
    }),
    says: "1 published component agents cannot see"
  },
  {
    name: "a raw value, with tokens",
    seed: findings({
      code: {
        ...CLEAN_CODE,
        problems: [
          {
            rule: "raw-color",
            file: "src/Badge.tsx",
            line: 1,
            value: "#ff0033",
            message: "A colour written by hand"
          }
        ]
      }
    }),
    says: "1 problem"
  },
  {
    name: "a broken state: the story cannot be shown",
    seed: findings({
      report: {
        schema: 1,
        results: [
          {
            storyId: STORY,
            view: "light",
            frame: "f",
            problems: [{ kind: "frame", message: "The story could not be shown" }]
          }
        ]
      }
    }),
    says: "1 problem"
  },
  {
    name: "a new component with no story",
    seed: findings({
      changed: changedOf([{ file: "src/Badge.tsx", path: "src/Badge.tsx", coverage: "none", stories: [] }]),
      report: undefined
    }),
    says: "1 changed UI file, 0 with stories: not verified"
  },
  {
    name: "a contrast failure",
    seed: findings({
      report: {
        schema: 1,
        results: [
          {
            storyId: STORY,
            view: "dark",
            frame: "f",
            problems: [{ kind: "axe", rule: "color-contrast", message: "Low contrast" }]
          }
        ]
      }
    }),
    says: "1 problem"
  },
  {
    name: "stories that reach the file but could not run",
    seed: findings({ report: undefined, notRun: "Playwright is missing" }),
    says: "1 changed UI file, 0 with stories: not verified"
  },
  {
    name: "stories the graph names and the run left out",
    seed: findings({
      report: { schema: 1, results: [{ storyId: "kit:other--plain", view: "", frame: "f", problems: [] }] }
    }),
    says: "not verified"
  },
  {
    name: "nothing changed against a start nobody named: a shallow clone, committed work",
    seed: findings({ changed: changedOf([]), report: undefined, isSinceNamed: false }),
    says: "If your work is committed, give --since"
  },
  {
    name: "a story file that cannot be read, with no UI file changed",
    seed: findings({
      changed: changedOf([], {
        files: ["src/format.ts"],
        unread: ["src/A.stories.tsx:1:1: broken"],
        problems: ["src/A.stories.tsx:1:1: broken"]
      }),
      report: undefined
    }),
    says: "not verified"
  },
  {
    name: "a catalogue whose import graph cannot be read",
    seed: findings({ changed: changedOf([covered("src/Badge.tsx")], { problems: ["no graph"] }) }),
    says: "not verified"
  }
];

describe("verifyDocument", () => {
  it.each(NOT_DONE)("does not pass $name", ({ seed, says }) => {
    const document = verifyDocument(seed);
    expect(isVerifyFailure(document)).toBe(true);
    expect(document.summary).toContain(says);
  });

  it("has a false-green rate of zero on the seeded set", () => {
    const greens = NOT_DONE.filter(({ seed }) => !isVerifyFailure(verifyDocument(seed)));
    expect(greens).toEqual([]);
  });

  it("names the fix of a storyless component: the command that writes its stories", () => {
    const document = verifyDocument(
      findings({
        changed: changedOf([
          { file: "pkg/src/Badge.tsx", path: "src/Badge.tsx", coverage: "none", stories: [] }
        ]),
        report: undefined
      })
    );
    expect(document.uiFiles[0]).toMatchObject({
      coverage: "none",
      fix: "npx forgebook new src/Badge.tsx"
    });
  });

  it("does not fail a change no one sees, and does not call it verified", () => {
    const document = verifyDocument(
      findings({
        changed: changedOf([], { files: ["src/format.ts", "README.md"] }),
        report: undefined,
        code: { ...CLEAN_CODE, skipped: ["colours and sizes not checked: no tokens file"] }
      })
    );
    expect(isVerifyFailure(document)).toBe(false);
    expect(document.verdict).toBe("nothing-to-verify");
    expect(document.summary).toBe("No changed UI file (2 other files)");
    // no value a token would name was touched: the missing file says nothing of this change
    expect(document.skipped).toEqual([]);
  });

  it("passes an empty change against a commit someone named", () => {
    const document = verifyDocument(
      findings({ changed: changedOf([], { since: "origin/main" }), since: "origin/main", report: undefined })
    );
    expect(document.summary).toBe("Nothing changed since origin/main: nothing to verify");
  });

  it("counts a file reached through another component's stories, and says so", () => {
    const document = verifyDocument(findings({ changed: changedOf([covered("src/Icon.tsx", "through")]) }));
    expect(document.verdict).toBe("verified");
    expect(document.summary).toContain("1 with stories (1 through another component's)");
  });

  it("never reads a skipped check as passed, and does not fail on it", () => {
    const document = verifyDocument(
      findings({ code: { ...CLEAN_CODE, skipped: ["colours and sizes not checked: no tokens file"] } })
    );
    expect(document.verdict).toBe("partly-verified");
    expect(isVerifyFailure(document)).toBe(false);
    expect(document.skipped).toContain("colours and sizes not checked: no tokens file");
    expect(document.summary).toContain("colours and sizes not checked: no tokens file");
  });

  it("says the accessibility check was off, and the views --quick left out", () => {
    const document = verifyDocument(findings({ report: { ...PASSING, a11y: "off" }, isQuick: true }));
    expect(document.verdict).toBe("partly-verified");
    expect(document.variants).toBe("default");
    expect(document.skipped).toEqual([
      "accessibility not checked: the catalogue sets a11y: false",
      "only the default view checked: --quick"
    ]);
  });

  it("names a UI file of another catalogue without judging it, nor its code", () => {
    const document = verifyDocument(
      findings({
        changed: changedOf([covered("src/Badge.tsx")], { outside: ["apps/web/Page.tsx"] }),
        code: {
          ...CLEAN_CODE,
          problems: [
            { rule: "raw-color", file: "apps/web/Page.tsx", line: 1, value: "#111", message: "By hand" }
          ]
        }
      })
    );
    expect(document.verdict).toBe("partly-verified");
    expect(document.code.problems).toEqual([]);
    expect(document.skipped).toEqual(["1 UI file of another catalogue not checked: apps/web/Page.tsx"]);
  });

  it("says a problem in a file no one sees as a note, and does not fail on it", () => {
    const document = verifyDocument(
      findings({
        changed: changedOf([], { files: ["src/a.test.ts"] }),
        report: undefined,
        code: {
          ...CLEAN_CODE,
          problems: [
            { rule: "deleted-test", file: "src/a.test.ts", value: "x", message: "A test was deleted" }
          ]
        }
      })
    );
    expect(isVerifyFailure(document)).toBe(false);
    expect(document.problems).toBe(0);
    expect(document.code.notes).toHaveLength(1);
    expect(document.summary).toContain("1 note from check-code");
  });

  it("quotes a file's name in the command it offers: a name may hold a command", () => {
    const document = verifyDocument(
      findings({
        changed: changedOf([{ file: "src/$(x).tsx", path: "src/$(x).tsx", coverage: "none", stories: [] }]),
        report: undefined
      })
    );
    expect(document.uiFiles[0]?.fix).toBe("npx forgebook new 'src/$(x).tsx'");
  });

  it("says committed work was not compared when no default branch was found", () => {
    const document = verifyDocument(findings({ isSinceNamed: false }));
    expect(document.verdict).toBe("partly-verified");
    expect(document.skipped[0]).toContain("committed work not compared");
  });

  it("lists the first stories and counts them all, and links what failed", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: `s${index}`,
      title: "T",
      links: { address: "a", component: "c", frame: "f", embed: "e" }
    }));
    const document = verifyDocument(
      findings({
        changed: { ...changedOf([covered("src/global.css")]), stories: many },
        report: {
          schema: 1,
          results: [
            { storyId: STORY, view: "", frame: "x", problems: [] },
            { storyId: "s29", view: "", frame: "dead", problems: [{ kind: "error", message: "m" }] }
          ]
        }
      })
    );
    expect(document.storyCount).toBe(30);
    expect(document.stories).toHaveLength(20);
    expect(document.failures[0]?.links?.address).toBe("a");
    expect(document.failures[0]).not.toHaveProperty("frame");
  });

  it("does not fail a logic change whose stories could not run, and says they did not", () => {
    const document = verifyDocument(
      findings({
        changed: { ...changedOf([covered("src/Badge.tsx")]), uiFiles: [], files: ["src/format.ts"] },
        report: undefined,
        notRun: "Playwright is missing"
      })
    );
    expect(document.verdict).toBe("nothing-to-verify");
    expect(document.skipped).toEqual(["stories not run: Playwright is missing"]);
  });

  it("reads a story its frame gave up on as not verified, never as passed", () => {
    const document = verifyDocument(
      findings({
        report: {
          schema: 1,
          results: [{ storyId: STORY, view: "light", frame: "f", problems: [], notVerified: "still loading" }]
        }
      })
    );
    expect(document).toMatchObject({
      verdict: "not-verified",
      ran: 0,
      failures: [],
      notVerified: [{ storyId: STORY, view: "light", notVerified: "still loading" }]
    });
    expect(document.uiFiles[0]).toMatchObject({ coverage: "none", stories: 0 });
    expect(document.summary).toContain("not verified");
    expect(document.summary).toContain("1 not seen in its final state: the frame gave up");
    expect(document.summary).not.toContain("verified in");
  });

  it("is not verified when one view of a story was not seen, though another passed", () => {
    const document = verifyDocument(
      findings({
        report: {
          schema: 1,
          results: [
            { storyId: STORY, view: "light", frame: "f", problems: [] },
            { storyId: STORY, view: "dark", frame: "f", problems: [], notVerified: "still loading" }
          ]
        }
      })
    );
    expect(document).toMatchObject({ verdict: "not-verified", ran: 1 });
    expect(verifyText(document, { color: false, unicode: true, width: 200 })).toContain(
      "not verified: still loading"
    );
  });

  it("names a story it did not wait for, as asked, in what was not checked", () => {
    const document = verifyDocument(
      findings({
        report: {
          schema: 1,
          results: [{ storyId: STORY, view: "light", frame: "f", problems: [], isNotAwaited: true }]
        }
      })
    );
    expect(document.verdict).toBe("partly-verified");
    expect(document.skipped[0]).toContain("parameters.suspense.expected");
  });

  it("never reads what it could not tell of agents as verified", () => {
    const skipped = [
      "what agents see not checked: the catalogue turns off the component docs or Used in, which it reads"
    ];
    const document = verifyDocument(findings({ visibility: { ...NOTHING_UNSEEN, skipped } }));
    expect(document.verdict).toBe("partly-verified");
    expect(document.skipped).toContain(skipped[0]);
  });

  it("fails rather than not verifies when something was found as well", () => {
    const document = verifyDocument(
      findings({
        report: {
          schema: 1,
          results: [
            { storyId: STORY, view: "light", frame: "f", problems: [{ kind: "axe", message: "m" }] },
            { storyId: STORY, view: "dark", frame: "f", problems: [], notVerified: "still loading" }
          ]
        }
      })
    );
    expect(document.verdict).toBe("failed");
  });

  it("is the shape's second version, with only what failed listed", () => {
    const document = verifyDocument(findings({}));
    expect(document).toMatchObject({ schema: 2, verdict: "verified", ran: 1, failures: [], problems: 0 });
  });
});

describe("verifyText", () => {
  it("ends on the verdict, with each failure's fix above it", () => {
    const document = verifyDocument(
      findings({
        changed: changedOf([{ file: "src/Badge.tsx", path: "src/Badge.tsx", coverage: "none", stories: [] }]),
        report: undefined
      })
    );
    const lines = verifyText(document, { color: false, unicode: true, width: 200 }).split("\n");
    expect(lines).toEqual([
      "src/Badge.tsx  not verified: no story reaches it. Fix: npx forgebook new src/Badge.tsx",
      "1 changed UI file, 0 with stories: not verified"
    ]);
  });
});
