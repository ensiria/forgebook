#!/usr/bin/env node
/**
 * The dry-run stand-in for a coding agent: applies a task's scripted edits for one arm and claims its result, with no
 * model, so the evaluation's pipeline can be run end to end for nothing. Its numbers prove the pipeline, not Forgebook.
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { defineScript } from "@ensiria/cli-kit/script";

import { applyEdit, parseScript } from "./dryRunScript.ts";

await defineScript({
  name: "dry-run-agent",
  command: "node tools/eval/dry-run-agent/dry-run-agent.mts",
  summary: "Apply a task's scripted edits for one arm, as a coding agent would, with no model.",
  icon: "check",
  header: false,
  options: {
    task: { type: "string", required: true, valueName: "folder", description: "The task's folder." },
    arm: { type: "string", required: true, choices: ["with", "without"], description: "The arm's script." }
  },
  examples: [
    {
      command: "dry-run-agent --task tools/eval/tasks/apps-empty-state --arm with",
      description: "In the project's folder: the arm with Forgebook's edits."
    }
  ],
  run: ({ options, io }) => {
    const script = parseScript(readFileSync(join(options.task, "dry-run", `${options.arm}.json`), "utf8"));
    io.stdout.write(`${script.say}\n`);
    for (const edit of script.edits) {
      const file = join(io.cwd, edit.file);
      const text = existsSync(file) ? readFileSync(file, "utf8") : undefined;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, applyEdit(text, edit));
      io.stdout.write(`edited ${edit.file}\n`);
    }
    // the stdout of an agent's run is its transcript: the claim is its last line, as the prompt asks
    io.stdout.write(`RESULT: ${script.result}\n`);
  }
}).run();
