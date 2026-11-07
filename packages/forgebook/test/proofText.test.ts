/**
 * Tests for what a pull request's proof says: a name from a branch can do nothing in the comment or the page, and what was
 * not checked is always there.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { orderedByName } from "../bin/forgebook/proofCommand.mts";
import { ARTIFACT_PLACEHOLDER, codeSpan, proofComment, proofPage } from "../bin/forgebook/proofText.ts";
import {
  COMMENT_FILTER,
  COMMENT_MARKER,
  commentJob,
  DOWNLOAD,
  proofWorkflow
} from "../bin/forgebook/proofWorkflow.ts";
import type { ProofDocument, ProofState } from "../src/vite/agent.types.ts";

const STATE: ProofState = {
  storyId: "kit:badge--plain",
  view: "dark",
  status: "changed",
  percent: 1.5,
  pictures: {}
};

const PROOF: ProofDocument = {
  schema: 1,
  base: "a".repeat(40),
  head: "b".repeat(40),
  verdict: "partly-verified",
  summary: "1 changed UI file, 1 with stories",
  states: [STATE],
  same: 3,
  checked: ["pictures of 1 stories"],
  notChecked: ["real pages of the application, and anything no story shows"]
};

describe("orderedByName", () => {
  it("puts the stories that show a changed file first", () => {
    const ids = ["kit:avatar--a", "kit:counter-label--b", "kit:button--c"];
    expect(orderedByName(ids, ["src/CounterLabel/CounterLabel.module.css"])).toEqual([
      "kit:counter-label--b",
      "kit:avatar--a",
      "kit:button--c"
    ]);
  });
});

describe("codeSpan", () => {
  it("keeps a name in one span whatever it holds", () => {
    expect(codeSpan("a`b")).toBe("`` a`b ``");
    expect(codeSpan("x\n| y |")).not.toMatch(/[\n|]/);
    expect(codeSpan("z".repeat(500)).length).toBeLessThan(130);
  });
});

describe("proofComment", () => {
  it("says what was touched, what was checked and what was not, with a place for the pictures", () => {
    const comment = proofComment(PROOF);
    expect(comment).toContain("` kit:badge--plain `");
    expect(comment).toContain("1 differ, 3 the same.");
    expect(comment).toContain("#### Checked");
    expect(comment).toContain("#### Not checked");
    expect(comment).toContain(ARTIFACT_PLACEHOLDER);
  });

  it("gives a hostile name no link, image, mention or way out of its block", () => {
    const name = "![x](https://evil.example/p.png) @everyone <img src=x> ``` [y](https://evil.example)";
    const comment = proofComment({
      ...PROOF,
      summary: `\`\`\`\n${name}`,
      notChecked: [name],
      states: [{ ...STATE, storyId: name, view: "", status: "new", percent: 0, pictures: {} }]
    });
    const outsideCode = comment.replace(/^(`{3,})text\n[\s\S]*?^\1$/gm, "").replace(/(`+) [^\n]*? \1/g, "");
    expect(outsideCode).not.toContain("evil.example");
    expect(outsideCode).not.toContain("@everyone");
    expect(outsideCode).not.toContain("<img");
  });

  it("says nothing is all clear when no state differs", () => {
    const comment = proofComment({ ...PROOF, states: [] });
    expect(comment).toContain("No picture differs: 3 compared and the same.");
    expect(comment).toContain("real pages of the application");
  });

  it("stays under what GitHub accepts, and says it was cut", () => {
    const comment = proofComment({
      ...PROOF,
      notChecked: Array.from({ length: 5000 }, () => "x".repeat(60))
    });
    expect(comment.length).toBeLessThan(65_536);
    expect(comment).toContain("Cut here to fit");
    expect(comment.endsWith("`proof.json`.\n")).toBe(true);
    expect((comment.match(/^`{3,}/gm) ?? []).length % 2).toBe(0);
  });
});

describe("proofPage", () => {
  it("shows no picture but the run's own", () => {
    const page = proofPage({
      ...PROOF,
      states: [{ ...STATE, pictures: { after: "javascript:alert(1)", before: "pictures/a.png" } }]
    });
    expect(page).not.toContain("javascript:");
    expect(page).toContain("pictures/a.png");
    expect(page).toContain("Content-Security-Policy");
  });

  it("escapes what a branch names", () => {
    const page = proofPage({
      ...PROOF,
      states: [
        {
          ...PROOF.states[0],
          storyId: "<script>alert(1)</script>",
          view: "",
          status: "new",
          percent: 0,
          pictures: { after: 'a"><script>.png' }
        }
      ]
    });
    expect(page).not.toContain("<script>");
  });
});

describe("the comment the posting job writes", () => {
  const hostile =
    "![x](https://evil.example/p.png) @everyone <img src=x> \u0060\u0060\u0060 [y](https://evil.example) &#64;octocat";
  const written = (proof: unknown, files: readonly string[] = []): string => {
    const run = spawnSync(
      "jq",
      [
        "-r",
        "--argjson",
        "files",
        JSON.stringify(files),
        "--arg",
        "run",
        "https://github.com/o/r/actions/runs/1",
        "--arg",
        "pictures",
        "",
        COMMENT_FILTER
      ],
      { input: JSON.stringify(proof), encoding: "utf8" }
    );
    expect(run.stderr).toBe("");
    return run.stdout;
  };

  it("leaves a forged proof no mention, link or image", () => {
    const comment = written(
      {
        ...PROOF,
        verdict: hostile,
        summary: hostile,
        checked: [hostile],
        notChecked: [hostile],
        states: [{ storyId: hostile, view: hostile, status: hostile, percent: "x", pictures: {} }]
      },
      [hostile]
    );
    const outsideCode = comment
      .replace(/^\u0060\u0060\u0060text\n[\s\S]*?^\u0060\u0060\u0060$/gm, "")
      .replace(/\u0060 [^\n\u0060]*? \u0060/g, "");
    expect(outsideCode).not.toContain("evil.example");
    expect(outsideCode).not.toContain("@everyone");
    expect(outsideCode).not.toContain("#64");
    expect(comment).toContain("unknown");
  });

  it("says at its top that the branch made it, and which files shape the run", () => {
    const comment = written(PROOF, [".npmrc"]);
    expect(comment.indexOf("could forge")).toBeLessThan(comment.indexOf("States touched"));
    expect(comment).toContain(".npmrc");
    expect(comment).toContain("#### Not checked");
    expect(comment).toContain("1 differ, 3 the same.");
  });

  it("is what this repository's own workflow runs", () => {
    const own = readFileSync(
      join(import.meta.dirname, "..", "..", "..", ".github", "workflows", "proof.yml"),
      "utf8"
    );
    expect(own).toContain(commentJob(DOWNLOAD));
  });
});

describe("proofWorkflow", () => {
  const workflow = proofWorkflow("/nowhere", "");

  it("gives the job that runs the branch's code no write token and no credential", () => {
    const proofJob = workflow.slice(workflow.indexOf("  proof:"), workflow.indexOf("  comment:"));
    expect(proofJob).toContain("contents: read");
    expect(proofJob).toContain("persist-credentials: false");
    expect(proofJob).not.toMatch(/^\s*[\w-]+: write$/m);
  });

  it("posts from a job that checks nothing out and runs no project code", () => {
    const commentJob = workflow.slice(workflow.indexOf("  comment:"));
    expect(commentJob).toContain("pull-requests: write");
    expect(commentJob).not.toContain("actions/checkout");
    expect(commentJob).not.toContain("forgebook proof");
    expect(commentJob).not.toContain("comment.md");
    expect(commentJob).toContain(COMMENT_MARKER);
    expect(commentJob).toContain("continue-on-error: true");
  });

  it("never runs on the trigger that hands a fork's code a write token, and writes no event text in a command", () => {
    expect(workflow).not.toContain("pull_request_target");
    for (const line of workflow.split("\n").filter((each) => /^\s*run: /.test(each) || /gh api/.test(each))) {
      expect(line).not.toContain("${{");
    }
  });
});
