/**
 * A command run with room for its files: the limit raised before the program starts, its arguments kept as given.
 *
 * @module
 */
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { OPEN_FILES, withOpenFiles } from "./openFiles.ts";

describe("a command with room for its files", () => {
  it("runs as it is on Windows", () => {
    expect(withOpenFiles({ program: "node.exe", args: ["a"] }, "win32")).toEqual({
      program: "node.exe",
      args: ["a"]
    });
  });

  it.skipIf(process.platform === "win32")(
    "raises the limit, then runs the program with its arguments",
    () => {
      const { program, args } = withOpenFiles({
        program: "/bin/sh",
        args: ["-c", 'ulimit -n; echo "$0"', "it's me"]
      });
      const [limit, echoed] = execFileSync(program, [...args], { encoding: "utf8" })
        .trim()
        .split("\n");
      expect(Number(limit) >= OPEN_FILES || limit === "unlimited").toBe(true);
      expect(echoed).toBe("it's me");
    }
  );
});
