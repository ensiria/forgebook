#!/usr/bin/env node
/**
 * The `check-markdown-blocks` command: fails when a tracked Markdown file has a fence nobody closed, a YAML or JSON sample
 * that does not parse, or a link to a heading that sits inside a block. Run by `pnpm checks`, so by the CI too.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";

import { exec } from "@ensiria/cli-kit/exec";
import { defineScript, ScriptError } from "@ensiria/cli-kit/script";

import { markdownProblems } from "./markdownBlocks.ts";

await defineScript({
  name: "check-markdown-blocks",
  command: "node tools/check-markdown-blocks/check-markdown-blocks.mts",
  summary:
    "Check the fences, the YAML and JSON samples and the page's own links in every tracked Markdown file.",
  icon: "check",
  examples: [{ command: "check-markdown-blocks", description: "Every Markdown file git tracks." }],
  run: async ({ io, log }) => {
    const { stdout } = await exec("git", ["ls-files", "-z", "*.md"], { io });
    // -z: without it git quotes a name with an accent, and the quoted name is no file; a file just deleted is not there
    const files = stdout.split("\0").filter((file) => file !== "" && existsSync(file));
    const problems = files.flatMap((file) =>
      markdownProblems(readFileSync(file, "utf8")).map(({ line, message }) => `${file}:${line} ${message}`)
    );
    for (const problem of problems) log.error(problem);
    if (problems.length > 0) {
      throw new ScriptError(`${problems.length} problems in the Markdown files' blocks`, {
        hint: "A file's prose renders as code, or its sample cannot be copied, until they are fixed"
      });
    }
    log.success(`${files.length} Markdown files: their blocks are closed and their samples parse`);
  }
}).run();
