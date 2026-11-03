/**
 * Tests for the file system's answers to the docs' programs: a build asks once per path, a reader whose files may
 * change asks each time, so an install or a package built beside it is seen.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { programFor } from "../src/vite/docsProgram.ts";
import { checkFileChanges } from "../src/vite/parsedFiles.ts";

const ROOT = realpathSync.native(mkdtempSync(join(tmpdir(), "forgebook-docs-answers-")));

/**
 * A package of its own configuration whose file imports a module no one installed.
 *
 * @param name - the package's folder.
 * @returns its file.
 */
const packageFile = (name: string): string => {
  const folder = join(ROOT, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "tsconfig.json"), JSON.stringify({ compilerOptions: { types: [] } }));
  const file = join(folder, "a.ts");
  writeFileSync(file, 'import { b } from "../shared/b";\nexport const a = b;\n');
  return file;
};

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

/**
 * Whether a package's program holds the shared file its file imports.
 *
 * @param name - the package's folder.
 */
const holdsShared = (name: string): boolean => {
  const found = programFor(packageFile(name));
  if (typeof found === "string") throw new Error(found);
  return found.program.getSourceFiles().some((each) => each.fileName.endsWith("/shared/b.ts"));
};

describe("the file system's answers", () => {
  it("are asked once in a build, and each time once files may change", () => {
    expect(holdsShared("one")).toBe(false);
    mkdirSync(join(ROOT, "shared"), { recursive: true });
    writeFileSync(join(ROOT, "shared", "b.ts"), "export const b = 1;\n");
    // a build changes no file: what the disk answered the first program holds for the next
    expect(holdsShared("two")).toBe(false);
    checkFileChanges();
    expect(holdsShared("three")).toBe(true);
  });
});
