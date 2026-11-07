/**
 * What a run measures, read from Forgebook's documents and the agent's words, and the arms compared task by task.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { checkCodeMeasure, probeComponents, stressMeasure, verifyMeasure } from "./forgebookMeasures.ts";
import { pinnedManifest } from "./forgebookSetup.ts";
import { summariseMeasures } from "./measuresSummary.ts";
import { claimOf, outcomeOf } from "./outcome.ts";
import { violationCounts } from "./pageRun.ts";
import { seeded } from "./random.ts";
import { ARMS, planRuns } from "./runPlan.ts";
import { measured } from "./testRuns.ts";

describe("Forgebook's documents", () => {
  it("give verify's verdict, or why not", () => {
    expect(verifyMeasure('{"verdict":"failed","summary":"1 problem","problems":1}')).toEqual({
      verdict: "failed",
      summary: "1 problem",
      problems: 1
    });
    expect(verifyMeasure("not json")).toMatch(/no verdict/);
  });

  it("count check-code's findings by rule", () => {
    const text = JSON.stringify({
      problems: [{ rule: "raw-color" }, { rule: "raw-color" }, { rule: "raw-size" }]
    });
    expect(checkCodeMeasure(text)).toEqual({ problems: 3, byRule: { "raw-color": 2, "raw-size": 1 } });
  });

  it("count the stress matrix's cases", () => {
    const report = JSON.stringify({
      schema: 1,
      cases: [
        { name: "long-text", problems: [{ rule: "spill" }] },
        { name: "rtl", problems: [] },
        { name: "dark", problems: [], notVerified: "did not draw" }
      ],
      skipped: []
    });
    expect(stressMeasure([report, report])).toEqual({ cases: 6, broken: 2, notVerified: 2 });
    expect(stressMeasure(["{}"])).toMatch(/no report/);
  });

  it("find the probes' components in the stories' list", () => {
    const text = JSON.stringify({
      components: [
        { id: "stories:eval-a", file: "./src/a.eval.stories.tsx" },
        { id: "stories:b", file: "./src/b.stories.tsx" }
      ]
    });
    expect(probeComponents(text, ["src/a.eval.stories.tsx"])).toEqual(["stories:eval-a"]);
  });

  it("count axe's violations by rule and node", () => {
    expect(
      violationCounts({
        violations: [
          { id: "color-contrast", nodes: [{}, {}] },
          { id: "button-name", nodes: [{}] }
        ]
      })
    ).toEqual({ "color-contrast": 2, "button-name": 1 });
  });
});

describe("the agent's claim", () => {
  it("is its last RESULT line", () => {
    expect(claimOf("working…\nRESULT: not done: tests\n…\nRESULT: done\n")).toBe("done");
    expect(claimOf("**RESULT: not done: no browser**")).toBe("not-done");
    expect(claimOf("All finished!")).toBe("none");
  });

  it("is compared with the checks", () => {
    expect(outcomeOf("done", true)).toBe("done-and-working");
    expect(outcomeOf("done", false)).toBe("claimed-but-broken");
    expect(outcomeOf("not-done", false)).toBe("honest-not-done");
    expect(outcomeOf("none", true)).toBe("working-unclaimed");
    expect(outcomeOf("none", false)).toBe("broken-no-claim");
  });
});

describe("the runs' order", () => {
  it("runs every task in both arms each repeat, the two arms side by side", () => {
    const plan = planRuns(["a", "b", "c"], 2, seeded(4));
    expect(plan).toHaveLength(12);
    for (let index = 0; index < plan.length; index += 2) {
      expect(plan[index]?.task).toBe(plan[index + 1]?.task);
      expect(new Set([plan[index]?.arm, plan[index + 1]?.arm])).toEqual(new Set(ARMS));
    }
    expect(plan.slice(0, 6).every((run) => run.repeat === 1)).toBe(true);
    expect(planRuns(["a", "b", "c"], 2, seeded(4))).toEqual(plan);
  });
});

describe("the app's manifest", () => {
  it("pins Forgebook's packages for each package manager", () => {
    const packages = { forgebook: "file:/p/forgebook.tgz" };
    expect(JSON.parse(pinnedManifest('{"pnpm":{"overrides":{"x":"1"}}}', packages, "pnpm"))).toEqual({
      pnpm: { overrides: { x: "1", forgebook: "file:/p/forgebook.tgz" } }
    });
    expect(JSON.parse(pinnedManifest("{}", packages, "npm"))).toEqual({ overrides: packages });
    expect(JSON.parse(pinnedManifest("{}", packages, "yarn"))).toEqual({ resolutions: packages });
  });
});

describe("the arms compared", () => {
  it("take each task's difference, and leave out what a run could not measure", () => {
    const runs = [
      measured("a", "with", 1, { checkCode: { problems: 0, byRule: {} } }),
      measured("a", "without", 1, { checkCode: { problems: 2, byRule: {} }, isWorking: false }),
      measured("b", "with", 1, { checkCode: "check-code gave no findings" }),
      measured("b", "without", 1, { checkCode: { problems: 4, byRule: {} } })
    ];
    const summary = summariseMeasures(runs, seeded(1), 200);
    expect(summary["checkCodeProblems"]?.arms.with).toEqual({ mean: 0, runs: 1 });
    expect(summary["checkCodeProblems"]?.arms.without).toEqual({ mean: 3, runs: 2 });
    expect(summary["checkCodeProblems"]?.difference.value).toBe(-2);
    expect(summary["working"]?.difference.value).toBe(0.5);
  });
});
