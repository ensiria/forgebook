/**
 * What a dev server's docs programs hold: the files asked for and what they import, not every file of the
 * configuration, until enough are asked that the whole is cheaper; and every file when a reader needs them all.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  markSourcesChanged,
  type ProgramReach,
  programFor,
  readAskedFilesOnly
} from "../src/vite/docsProgram.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-docs-asked-"));

// as a dev server's worker does
readAskedFilesOnly();

/**
 * A package of a number of files, each on its own, with a `tsconfig.json`.
 *
 * @param name - the package's folder.
 * @param count - its files.
 * @returns the files' paths.
 */
const packageOf = (name: string, count: number): string[] => {
  const folder = join(ROOT, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noLib: true, types: [] }, include: ["*.ts"] })
  );
  return Array.from({ length: count }, (_, index) => {
    const file = join(folder, `file${index}.ts`);
    writeFileSync(file, `export const value${index} = ${index};\n`);
    return file;
  });
};

/** The root files of the program that holds a file. */
const rootsFor = (file: string, reach: ProgramReach = "asked"): readonly string[] => {
  const found = programFor(file, { reach });
  if (typeof found === "string") throw new Error(found);
  return found.program.getRootFileNames();
};

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("programFor on a dev server", () => {
  it("holds the files asked for, one more at each new one", () => {
    const [first = "", second = ""] = packageOf("asked", 5);
    expect(rootsFor(first)).toHaveLength(1);
    expect(rootsFor(second)).toHaveLength(2);
    expect(rootsFor(first)).toHaveLength(2);
  });

  it("holds every file when a reader needs them all", () => {
    const [first = ""] = packageOf("whole", 5);
    expect(rootsFor(first, "whole")).toHaveLength(5);
  });

  it("takes the whole configuration once enough files were asked for", () => {
    const files = packageOf("many", 30);
    for (const file of files.slice(0, 16)) rootsFor(file);
    expect(rootsFor(files[16] ?? "")).toHaveLength(30);
  });

  it("holds, asked or not, the files that hold for every file: declarations and augmentations, added ones too", () => {
    const [first = ""] = packageOf("ambient", 3);
    const folder = join(ROOT, "ambient");
    writeFileSync(
      join(folder, "theme.ts"),
      'declare module "theme" { interface Variants { b: true } }\nexport {};\n'
    );
    expect(rootsFor(first).map((name) => name.split("/").at(-1))).toEqual(["theme.ts", "file0.ts"]);
    writeFileSync(join(folder, "globals.d.ts"), "declare const later: number;\n");
    markSourcesChanged();
    expect(rootsFor(first).map((name) => name.split("/").at(-1))).toContain("globals.d.ts");
  });

  it("roots a file a renewed program no longer reaches", () => {
    const [first = "", second = ""] = packageOf("unlinked", 2);
    writeFileSync(first, `export { value1 } from "./file1";\n`);
    markSourcesChanged();
    rootsFor(first);
    rootsFor(second);
    writeFileSync(first, "export const alone = 1;\n");
    markSourcesChanged();
    const found = programFor(second);
    if (typeof found === "string") throw new Error(found);
    expect(found.program.getSourceFile(second.replaceAll("\\", "/"))).toBeDefined();
  });
});
