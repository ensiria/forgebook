/**
 * What a build's docs programs hold once it names its story files: those its configuration lists, what they import and
 * the files that hold for every file, not every file of the configuration; and every file when a reader needs them all.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { type ProgramReach, programFor, readStoryFilesOnly } from "../src/vite/docsProgram.ts";

const ROOT = mkdtempSync(join(tmpdir(), "forgebook-docs-stories-"));

/**
 * A package with a `tsconfig.json` that lists every file: two stories, the component they import, a file nothing
 * imports, a declaration and an augmentation.
 *
 * @param name - the package's folder.
 * @returns the files' paths.
 */
const packageOf = (name: string): Record<string, string> => {
  const folder = join(ROOT, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { noLib: true, types: [] }, include: ["*.ts"] })
  );
  const files: Record<string, string> = {
    "Button.ts": "export const Button = 1;\n",
    "a.stories.ts": 'import { Button } from "./Button";\nexport const A = Button;\n',
    "b.stories.ts": 'import { Button } from "./Button";\nexport const B = Button;\n',
    "website.ts": "export const page = 2;\n",
    "globals.d.ts": "declare const VERSION: string;\n",
    "theme.ts": 'declare module "theme" { interface Variants { b: true } }\nexport {};\n'
  };
  return Object.fromEntries(
    Object.entries(files).map(([file, text]) => {
      const path = join(folder, file);
      writeFileSync(path, text);
      return [file, path];
    })
  );
};

/** The root files of the program that holds a file, by name. */
const rootsFor = (file: string, reach: ProgramReach = "asked"): readonly string[] => {
  const found = programFor(file, { reach });
  if (typeof found === "string") throw new Error(found);
  return found.program
    .getRootFileNames()
    .map((root) => root.slice(root.lastIndexOf("/") + 1))
    .toSorted();
};

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("programFor in a build that named its story files", () => {
  const files = packageOf("stories");
  readStoryFilesOnly([files["a.stories.ts"] ?? "", files["b.stories.ts"] ?? ""]);
  const story = files["a.stories.ts"] ?? "";

  it("holds the stories and the files that hold for every file, for a story's docs and for its group's usage", () => {
    const expected = ["a.stories.ts", "b.stories.ts", "globals.d.ts", "theme.ts"];
    expect(rootsFor(story)).toEqual(expected);
    expect(rootsFor(story, "stories")).toEqual(expected);
    const found = programFor(story);
    if (typeof found === "string") throw new Error(found);
    expect(found.program.getSourceFile(files["Button.ts"] ?? "")).toBeDefined();
    expect(found.program.getSourceFile(files["website.ts"] ?? "")).toBeUndefined();
  });

  it("keeps one program for every read of its stories", () => {
    const first = programFor(story);
    const usage = programFor(files["b.stories.ts"] ?? "", { reach: "stories" });
    if (typeof first === "string" || typeof usage === "string") throw new Error("no program");
    expect(usage.program).toBe(first.program);
  });

  it("adds a file none of its stories reaches, and keeps it", () => {
    const website = files["website.ts"] ?? "";
    expect(rootsFor(website)).toContain("website.ts");
    expect(rootsFor(story)).toContain("website.ts");
  });

  it("holds every file when a reader needs them all", () => {
    expect(rootsFor(story, "whole")).toHaveLength(6);
  });
});
