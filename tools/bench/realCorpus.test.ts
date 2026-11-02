/**
 * A corpus's definition: what it refuses, where it lands, how an edit applies. And every corpus of this repository is
 * valid, since a bad one would only show on the reference machine.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BENCH_FOLDER,
  corpusPaths,
  corpusProblems,
  DEFINITION_FILE,
  definitionFolder,
  editedText,
  parseCorpus
} from "./realCorpus.ts";
import type { RealCorpus } from "./realCorpus.types.ts";

const CORPORA = join(import.meta.dirname, "corpora");

const VALID: RealCorpus = {
  name: "lib",
  repository: "https://example.com/lib.git",
  commit: "a".repeat(40),
  licence: "MIT",
  install: ["npm", "ci", "--ignore-scripts"],
  folder: "packages/ui",
  expected: { files: 2, stories: 3 },
  measured: {
    forgebookStory: "stories:a--b",
    forgebookComponent: "stories:a",
    text: "Hello",
    pageText: "Hello",
    sidebar: "Components"
  },
  edits: {
    story: { file: "a.stories.tsx", find: "Hello", replace: "Hello {edit}" },
    component: { file: "a.tsx", find: "<b>", replace: "<b>{edit}" }
  }
};

describe("a corpus's definition", () => {
  it("accepts a complete one", () => {
    expect(corpusProblems(VALID)).toEqual([]);
  });

  it("refuses a commit that could move, and a repository that would ask for credentials", () => {
    const problems = corpusProblems({ ...VALID, commit: "main", repository: "git@example.com:lib.git" });
    expect(problems.join()).toContain("full commit hash");
    expect(problems.join()).toContain("https");
  });

  it("refuses an edit that would never show", () => {
    const edits = { ...VALID.edits, story: { file: "a", find: "b", replace: "c" } };
    expect(corpusProblems({ ...VALID, edits }).join()).toContain("{edit}");
  });

  it("names every problem of a file at once", () => {
    expect(() => parseCorpus("{}", "corpus.json")).toThrow(/corpus\.name.*corpus\.commit/);
  });

  it("keeps the clone in the work folder, and Forgebook in a dotted folder no story glob matches", () => {
    const paths = corpusPaths(VALID, "/definition", "/work");
    expect(paths.clone).toBe("/work/corpus/lib");
    expect(paths.bench).toBe(`/work/corpus/lib/packages/ui/${BENCH_FOLDER}`);
  });

  it("takes a name under the corpora, or a folder", () => {
    expect(definitionFolder("primer", "/repo/corpora", "/here")).toBe("/repo/corpora/primer");
    expect(definitionFolder("./mine", "/repo/corpora", "/here")).toBe("/here/mine");
    expect(definitionFolder("/abs/mine", "/repo/corpora", "/here")).toBe("/abs/mine");
  });

  it("applies an edit, and fails at once when the pinned file no longer holds its text", () => {
    const edit = { file: "a", find: "Hello", replace: "Hello {edit}" };
    expect(editedText("<b>Hello</b>", edit, "bench-edit-1")).toBe("<b>Hello bench-edit-1</b>");
    expect(() => editedText("<b>Bye</b>", edit, "bench-edit-1")).toThrow("no longer holds");
  });
});

describe("the corpora of this repository", () => {
  const names = readdirSync(CORPORA, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  it.each(names.map((entry) => entry.name))("%s is a valid definition", (name) => {
    const file = join(CORPORA, name, DEFINITION_FILE);
    expect(parseCorpus(readFileSync(file, "utf8"), file).name).toBe(name);
  });
});
