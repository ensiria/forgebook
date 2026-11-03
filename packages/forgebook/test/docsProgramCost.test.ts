/**
 * What the docs keep of a library: one TypeScript program per `tsconfig.json`, each holding what its package reaches, so a
 * monorepo must not keep them all; and the files they parse, shared by every configuration that parses alike.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ts from "typescript-6";
import { afterAll, describe, expect, it, vi } from "vitest";

import { KEPT_PROGRAMS, markSourcesChanged, programFor } from "../src/vite/docsProgram.ts";
import { checkFileChanges } from "../src/vite/parsedFiles.ts";

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

  it("parses a file once for every configuration that parses alike, as a monorepo's packages share their sources", () => {
    const shared = join(ROOT, "shared.ts");
    writeFileSync(shared, "export const shared = 1;\n");
    const sourceOf = (name: string): ts.SourceFile | undefined => {
      const file = packageFile(name);
      writeFileSync(file, `import { shared } from "../shared";\nexport const a = shared;\n`);
      const found = programFor(file);
      if (typeof found === "string") throw new Error(found);
      return found.program.getSourceFile(shared.replaceAll("\\", "/"));
    };
    const first = sourceOf("shares-a");
    expect(first).toBeDefined();
    expect(sourceOf("shares-b")).toBe(first);
  });

  it("parses @types and the standard library without their documentation, an installed library with its own", () => {
    const write = (folder: string, text: string): void => {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "package.json"), JSON.stringify({ name: folder, types: "index.d.ts" }));
      writeFileSync(join(folder, "index.d.ts"), text);
    };
    write(
      join(ROOT, "node_modules", "dep"),
      "/** From the library. */\nexport declare const fromDep: number;\n"
    );
    write(
      join(ROOT, "node_modules", "@types", "typed"),
      "/** From @types. */\nexport declare const fromTypes: number;\n"
    );
    const file = packageFile("documented");
    writeFileSync(
      file,
      `export { fromDep } from "dep";\nexport { fromTypes } from "typed";\n/** Own. */\nexport const own = 1;\n`
    );
    const found = programFor(file);
    if (typeof found === "string") throw new Error(found);
    const { program: read, checker } = found;
    const source = read.getSourceFile(file.replaceAll("\\", "/"));
    const exported = source === undefined ? undefined : checker.getSymbolAtLocation(source);
    const documentation = (name: string): string => {
      const symbol = exported === undefined ? undefined : checker.tryGetMemberInModuleExports(name, exported);
      if (symbol === undefined) return "missing";
      const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      return ts.displayPartsToString(resolved.getDocumentationComment(checker));
    };
    expect(documentation("own")).toBe("Own.");
    expect(documentation("fromDep")).toBe("From the library.");
    expect(documentation("fromTypes")).toBe("");
  });

  it("parses a file again after an edit that kept its modification time", () => {
    const file = packageFile("same-time");
    const before = statSync(file);
    program(file);
    writeFileSync(file, "export const a = 2;\nexport const b = 3;\n");
    utimesSync(file, before.atime, before.mtime);
    checkFileChanges();
    markSourcesChanged();
    const found = programFor(file);
    if (typeof found === "string") throw new Error(found);
    expect(found.program.getSourceFile(file.replaceAll("\\", "/"))?.text).toContain("b = 3");
  });
});
