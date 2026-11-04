/**
 * Tests for the docs' programs: one kept and read again while nothing changes, renewed after a change.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { markSourcesChanged, programFor } from "../src/vite/docsProgram.ts";
import { KIT_DIR } from "./fixturePaths.ts";

const SELECT = join(KIT_DIR, "src", "Select.tsx");

describe("programFor", () => {
  it("reads the same program again while no source changed, and a new one after a change", () => {
    const first = programFor(SELECT);
    const again = programFor(SELECT);
    if (typeof first === "string" || typeof again === "string") throw new Error("no program");
    expect(again.program).toBe(first.program);
    expect(again.checker).toBe(first.checker);
    markSourcesChanged();
    const renewed = programFor(SELECT);
    if (typeof renewed === "string") throw new Error("no program");
    expect(renewed.program).not.toBe(first.program);
  }, 60_000);
});

describe("files no configuration holds", () => {
  const folder = (): string => mkdtempSync(join(tmpdir(), "forgebook-loose-"));

  it("share one program, or a project with no tsconfig.json keeps a compiler per story file", () => {
    const root = folder();
    const [first, second] = [join(root, "a.stories.jsx"), join(root, "b.stories.jsx")];
    writeFileSync(first, "export const a = 1;\n");
    writeFileSync(second, "export const b = 2;\n");
    const one = programFor(first);
    const two = programFor(second);
    if (typeof one === "string" || typeof two === "string") throw new Error("no program");
    expect(one.program.getSourceFile(second)).toBeDefined();
    expect(two.program).toBe(one.program);
  });

  it("finds a file written after the program was made", () => {
    const root = folder();
    const first = join(root, "a.stories.jsx");
    writeFileSync(first, "export const a = 1;\n");
    expect(typeof programFor(first)).not.toBe("string");
    const later = join(root, "b.stories.jsx");
    writeFileSync(later, "export const b = 2;\n");
    const found = programFor(later);
    if (typeof found === "string") throw new Error("no program");
    expect(found.program.getSourceFile(later)).toBeDefined();
  });
});

describe("a file its nearest configuration leaves out", () => {
  /**
   * A monorepo laid out as many are: the root's configuration holds every package, with the paths that lead to their
   * sources; a package's own holds only its sources, so its stories sit outside it.
   */
  const monorepo = (): { readonly story: string; readonly source: string } => {
    const root = mkdtempSync(join(tmpdir(), "forgebook-monorepo-"));
    const write = (file: string, text: string): void => {
      mkdirSync(join(root, file, ".."), { recursive: true });
      writeFileSync(join(root, file), text);
    };
    const options = { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true };
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: { ...options, paths: { "@kit/core": ["./packages/core/src/index.ts"] } },
        include: ["packages"]
      })
    );
    write("packages/core/package.json", JSON.stringify({ name: "@kit/core" }));
    write("packages/core/tsconfig.json", JSON.stringify({ compilerOptions: options, include: ["src/**/*"] }));
    write("packages/core/src/index.ts", "export type BadgeProps = { readonly tone: 'info' | 'error' };\n");
    write(
      "packages/core/stories/badge.stories.tsx",
      'import type { BadgeProps } from "@kit/core";\nexport const props: BadgeProps = { tone: "info" };\n'
    );
    return {
      story: join(root, "packages/core/stories/badge.stories.tsx"),
      source: join(root, "packages/core/src/index.ts")
    };
  };

  it("is read with the first configuration up its folders that holds it, as an editor reads it", () => {
    const { story, source } = monorepo();
    const found = programFor(story);
    if (typeof found === "string") throw new Error(found);
    const file = found.program.getSourceFile(story);
    expect(file).toBeDefined();
    // the root's paths apply: the package's name leads to its source, so the type is known
    expect(found.program.getSourceFile(source)).toBeDefined();
    const diagnostics = found.program.getSemanticDiagnostics(file);
    expect(diagnostics.map((each) => each.messageText)).toEqual([]);
  });

  it("leaves a file its nearest configuration holds to that configuration", () => {
    const { story, source } = monorepo();
    const ownProgram = programFor(source);
    const storyProgram = programFor(story);
    if (typeof ownProgram === "string" || typeof storyProgram === "string") throw new Error("no program");
    expect(ownProgram.program).not.toBe(storyProgram.program);
    expect(ownProgram.program.getSourceFile(story)).toBeUndefined();
  });
});
