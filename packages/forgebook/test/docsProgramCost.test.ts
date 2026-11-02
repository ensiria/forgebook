/**
 * What the docs keep of a library: one TypeScript program per `tsconfig.json`, each holding what its package reaches, so a
 * monorepo must not keep them all.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ts from "typescript-6";
import { afterAll, describe, expect, it, vi } from "vitest";

import { KEPT_PROGRAMS, markSourcesChanged, programFor } from "../src/vite/docsProgram.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-docs-programs-"));

/** A package with a `tsconfig.json`; its source file's path. */
const packageFile = (name: string): string => {
  const folder = join(ROOT, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noLib: true, types: [] }, include: ["*.ts"] })
  );
  const file = join(folder, "a.ts");
  writeFileSync(file, "export const a = 1;\n");
  return file;
};

/** The program that holds a file. */
const program = (file: string): unknown => {
  const found = programFor(file);
  if (typeof found === "string") throw new Error(found);
  return found.program;
};

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("programFor", () => {
  it("reads a configuration's files once per change: once per story file is quadratic in a library's size", () => {
    const file = packageFile("read-once");
    const readDirectory = vi.spyOn(ts.sys, "readDirectory");
    program(file);
    program(file);
    program(file);
    expect(readDirectory).toHaveBeenCalledTimes(1);
    markSourcesChanged();
    program(file);
    expect(readDirectory).toHaveBeenCalledTimes(2);
    readDirectory.mockRestore();
  });

  it("keeps the programs read last and lets the oldest go, whose memory a monorepo cannot afford", () => {
    const files = Array.from({ length: KEPT_PROGRAMS + 1 }, (_, index) => packageFile(`package-${index}`));
    const [first = "", second = "", ...others] = files;
    const firstProgram = program(first);
    const secondProgram = program(second);
    // reading the first again makes the second the oldest
    expect(program(first)).toBe(firstProgram);
    for (const file of others) program(file);
    expect(program(first)).toBe(firstProgram);
    expect(program(second)).not.toBe(secondProgram);
  });
});
