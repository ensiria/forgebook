/**
 * The evaluation's definitions: what an app, a task and a profile refuse, and every definition of this repository is
 * valid, since a bad one would only show hours into a paid run.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { appProblems, filledCommand, parseApp, parseProfile, parseTask, stepOf } from "./definitions.ts";
import { EVAL_FOLDER, readDefinitions } from "./runEval.ts";

const APP = {
  name: "app",
  repository: "https://github.com/someone/app",
  commit: "a".repeat(40),
  framework: "react",
  packageManager: "pnpm",
  install: ["pnpm", "install"],
  prepare: [],
  dev: ["pnpm", "exec", "vite", "--port", "{port}"],
  readyPath: "/",
  checks: { test: ["pnpm", "test"] }
};

const CONSTRAINTS = ["reuse", "tokens", "states", "a11y", "scope"].map((id) => ({ id, text: `about ${id}` }));

const TASK = {
  id: "task",
  app: "app",
  prompt: "Do it.",
  scope: ["src/a.tsx"],
  constraints: CONSTRAINTS,
  states: [{ name: "default", description: "As it opens.", steps: [{ goto: "/" }] }],
  acceptance: [{ name: "shows", steps: [{ goto: "/" }, { expectVisible: { text: "Hi" } }] }],
  probes: [{ source: "probes/A.stories.tsx", target: "src/a.eval.stories.tsx" }]
};

describe("an app's definition", () => {
  it("is valid as written", () => {
    expect(appProblems(APP, "app")).toEqual([]);
  });

  it("refuses a branch, a non-https repository, credentials, and a server without {port}", () => {
    const problems = appProblems(
      {
        ...APP,
        commit: "main",
        repository: "https://user:pass@github.com/x/y",
        dev: ["vite"],
        checks: { deploy: ["x"] }
      },
      "app"
    );
    expect(problems.join("\n")).toMatch(/commit/);
    expect(problems.join("\n")).toMatch(/repository/);
    expect(problems.join("\n")).toMatch(/\{port\}/);
    expect(problems.join("\n")).toMatch(/unknown check "deploy"/);
  });
});

describe("an app served under a base path", () => {
  it("reads the path its pages are under, none by default", () => {
    expect(parseApp(JSON.stringify(APP), "app").basePath).toBe("");
    expect(parseApp(JSON.stringify({ ...APP, basePath: "/dashboard" }), "app").basePath).toBe("/dashboard");
  });

  it("refuses one that does not start with / or ends with it", () => {
    expect(appProblems({ ...APP, basePath: "dashboard" }, "app").join("\n")).toMatch(/basePath/);
    expect(appProblems({ ...APP, basePath: "/dashboard/" }, "app").join("\n")).toMatch(/basePath/);
  });
});

describe("a task's definition", () => {
  it("reads as written", () => {
    const task = parseTask(JSON.stringify(TASK), "task", ["app"]);
    expect(task.states[0]?.viewport).toBe("desktop");
    expect(task.states[0]?.scheme).toBe("light");
    expect(task.probes).toEqual(TASK.probes);
  });

  it("needs the five constraints, in order", () => {
    const missing = { ...TASK, constraints: CONSTRAINTS.slice(1) };
    expect(() => parseTask(JSON.stringify(missing), "task", ["app"])).toThrow(/constraints/);
  });

  it("refuses a scope or a probe outside its folder, and an acceptance that expects nothing", () => {
    const bad = {
      ...TASK,
      scope: ["../outside"],
      probes: [{ source: "../x.stories.tsx", target: "src/x.stories.tsx" }],
      acceptance: [{ name: "nothing", steps: [{ goto: "/" }] }]
    };
    const error = (() => {
      try {
        parseTask(JSON.stringify(bad), "task", ["app"]);
        return "";
      } catch (thrown) {
        return String(thrown);
      }
    })();
    expect(error).toMatch(/scope/);
    expect(error).toMatch(/probes/);
    expect(error).toMatch(/expects anything/);
  });

  it("refuses an app it does not know", () => {
    expect(() => parseTask(JSON.stringify(TASK), "task", ["other"])).toThrow(/"app"/);
  });
});

describe("a step", () => {
  it("reads every kind", () => {
    expect(stepOf({ goto: "/x" })).toEqual({ goto: "/x" });
    expect(stepOf({ click: { role: "button", name: "Go" } })).toEqual({
      click: { role: "button", name: "Go" }
    });
    expect(stepOf({ fill: { label: "Name" }, value: "Ada" })).toEqual({
      fill: { label: "Name" },
      value: "Ada"
    });
    expect(stepOf({ expectValue: { placeholder: "Find" }, value: "" })).toEqual({
      expectValue: { placeholder: "Find" },
      value: ""
    });
    expect(stepOf({ press: "Escape" })).toEqual({ press: "Escape" });
  });

  it("refuses a role nobody has, a relative address and extra keys", () => {
    expect(stepOf({ click: { role: "bogus" } })).toBeUndefined();
    expect(stepOf({ goto: "x" })).toBeUndefined();
    expect(stepOf({ click: { text: "a" }, value: "b" })).toBeUndefined();
  });
});

describe("an agent's profile", () => {
  const profile = { name: "agent", command: ["agent", "{prompt}"], env: ["KEY"], timeoutMinutes: 30 };

  it("reads as written", () => {
    expect(parseProfile(JSON.stringify(profile), false).command).toEqual(["agent", "{prompt}"]);
  });

  it("never tells a real agent its arm or the task's folder", () => {
    const leaking = { ...profile, command: ["agent", "--arm", "{arm}"] };
    expect(() => parseProfile(JSON.stringify(leaking), false)).toThrow(/arm/);
    expect(() => parseProfile(JSON.stringify({ ...profile, command: ["a", "{task}"] }), false)).toThrow();
    expect(parseProfile(JSON.stringify(leaking), true).command).toContain("{arm}");
  });

  it("fills its placeholders, and refuses one with no value", () => {
    expect(filledCommand(["a", "--p={prompt}"], { prompt: "hi" })).toEqual(["a", "--p=hi"]);
    expect(() => filledCommand(["a", "{nope}"], {})).toThrow(/nope/);
  });
});

describe("this repository's definitions", () => {
  it("are all valid, with their probes in place", () => {
    const { apps, tasks } = readDefinitions();
    expect(tasks.length).toBeGreaterThanOrEqual(10);
    for (const task of tasks) expect(apps.has(task.app)).toBe(true);
  });

  it("include profiles that all read, the stand-in alone reading its arm", () => {
    for (const file of readdirSync(join(EVAL_FOLDER, "agents"))) {
      const name = file.replace(/\.json$/, "");
      const text = readFileSync(join(EVAL_FOLDER, "agents", file), "utf8");
      expect(() => parseProfile(text, name === "dry-run")).not.toThrow();
    }
  });
});
