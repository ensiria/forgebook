/**
 * Tests for the programs the benchmark runs to completion: a time limit holds for the whole tree, and a child left
 * holding the output does not keep the call waiting. They start real Node processes, no browser.
 *
 * @module
 */
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { createTestIo } from "@ensiria/cli-kit/testing";
import { describe, expect, it } from "vitest";

import { execProgram } from "./programs.ts";

/** A script that starts a child which outlives it, holding the output pipes it inherited, and prints the child's id. */
const LEAVES_A_CHILD = `
const { spawn } = require("node:child_process");
const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "inherit" });
child.unref();
console.log(child.pid);
`;

/** A script that starts such a child and then never ends itself. */
const NEVER_ENDS = `${LEAVES_A_CHILD}\nsetInterval(() => {}, 1000);`;

/** Whether a process is alive. */
const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** A test's streams, with no runner of its own: `execProgram` starts real programs. */
const realIo = (): ScriptIo => ({
  ...createTestIo({ cwd: process.cwd() }).io,
  runProgram: undefined
});

describe("execProgram", () => {
  it("ends at the program's exit, though a child it left still holds the output", async () => {
    const started = Date.now();
    const { stdout } = await execProgram(process.execPath, ["-e", LEAVES_A_CHILD], {
      io: realIo(),
      output: "capture",
      timeoutMs: 30_000
    });
    expect(Date.now() - started).toBeLessThan(15_000);
    const child = Number(stdout.trim());
    // the child that held the pipes is stopped with the program's tree
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(isAlive(child)).toBe(false);
  }, 30_000);

  it("stops the whole tree at the time limit and fails, saying so", async () => {
    const started = Date.now();
    await expect(
      execProgram(process.execPath, ["-e", NEVER_ENDS], { io: realIo(), output: "capture", timeoutMs: 1000 })
    ).rejects.toThrow(/ran past 1000 ms/);
    expect(Date.now() - started).toBeLessThan(15_000);
  }, 30_000);
});
