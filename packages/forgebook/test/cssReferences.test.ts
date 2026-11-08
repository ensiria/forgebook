/**
 * Tests for finding custom properties a browser gives no value: a reference that leads back, or one to a name nothing
 * declares.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { brokenReferences, references } from "../src/vite/cssReferences.ts";
import type { TokenDeclaration } from "../src/vite/cssTokenValues.ts";

/** A declaration. */
const declared = (name: string, value: string, mode?: string): TokenDeclaration => ({
  name,
  value,
  mode,
  origin: { kind: "css-variables", file: "a.css", line: 1 }
});

/** What is broken, as name and reason. */
const brokenOf = (
  declarations: readonly TokenDeclaration[],
  elsewhere: readonly string[] = []
): readonly string[] =>
  brokenReferences(declarations, (name) => elsewhere.includes(name)).map((each) =>
    each.kind === "cycle"
      ? `${each.declaration.name} cycle ${each.through.join(" ")}`.trim()
      : `${each.declaration.name} reads ${each.target}`
  );

describe("references", () => {
  it("tells a fallback, and what sits inside one", () => {
    expect(references("calc(var(--a) * 2) var(--b, var(--c, 1px)) var(--d)")).toEqual([
      { name: "--a", hasFallback: false, isInFallback: false },
      { name: "--b", hasFallback: true, isInFallback: false },
      { name: "--c", hasFallback: true, isInFallback: true },
      { name: "--d", hasFallback: false, isInFallback: false }
    ]);
  });

  it("does not take a comma of a function for a fallback", () => {
    expect(references("rgb(var(--r), 0, 0)")).toEqual([
      { name: "--r", hasFallback: false, isInFallback: false }
    ]);
  });
});

describe("brokenReferences", () => {
  it("names every token of a cycle, and one that reads itself", () => {
    expect(
      brokenOf([declared("--a", "var(--b)"), declared("--b", "var(--a)"), declared("--self", "var(--self)")])
    ).toEqual(["--a cycle --b", "--b cycle --a", "--self cycle"]);
  });

  it("finds a cycle a long chain leads into, without running past the stack", () => {
    const chain = Array.from({ length: 20_000 }, (_, index) =>
      declared(`--c${index}`, `var(--c${index + 1})`)
    );
    const looped = [...chain, declared("--c20000", "var(--c19999)")];
    expect(brokenOf(looped)).toEqual(["--c19999 cycle --c20000", "--c20000 cycle --c19999"]);
  });

  it("names a reference to a name nothing declares, unless it has a fallback or is declared elsewhere", () => {
    const declarations = [
      declared("--a", "var(--missing)"),
      declared("--b", "var(--missing, #fff)"),
      declared("--c", "var(--set-by-code)"),
      declared("--d", "var(--b)")
    ];
    expect(brokenOf(declarations, ["--set-by-code"])).toEqual(["--a reads --missing"]);
  });

  it("follows a theme over the base, as a browser does, and names each declaration once", () => {
    const declarations = [
      declared("--a", "var(--b)"),
      declared("--b", "#000"),
      declared("--b", "var(--a)", "dark"),
      declared("--x", "var(--nowhere)")
    ];
    expect(brokenOf(declarations)).toEqual(["--x reads --nowhere", "--a cycle --b", "--b cycle --a"]);
  });

  it("finds nothing in a system that resolves", () => {
    expect(
      brokenOf([declared("--a", "var(--b, var(--c))"), declared("--b", "1px"), declared("--c", "2px")])
    ).toEqual([]);
  });
});
