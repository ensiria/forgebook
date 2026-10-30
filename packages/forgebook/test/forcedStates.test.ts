/**
 * Tests for the forced-states rewrite, through Lightning CSS as the catalogue's build runs it.
 *
 * @module
 */
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";

import { FORCED_STATES_VISITOR } from "../src/vite/forcedStates.ts";

/** A style sheet rewritten, minified so the selectors read on one line. */
const rewrite = (css: string): string =>
  transform({
    filename: "test.css",
    code: Buffer.from(css),
    minify: true,
    visitor: FORCED_STATES_VISITOR
  }).code.toString();

const HOVER = ":is(:hover,[data-forgebook-force~=hover],[data-forgebook-force~=hover] *)";

describe("FORCED_STATES_VISITOR", () => {
  it("lets a forced state match wherever the real one does", () => {
    expect(rewrite(".a:hover .b{color:red}")).toBe(`.a${HOVER} .b{color:red}`);
  });

  it("reaches every user-action pseudo-class", () => {
    const css = rewrite(".a:active,.b:focus,.c:focus-visible,.d:focus-within{color:red}");
    for (const state of ["active", "focus", "focus-visible", "focus-within"]) {
      expect(css).toContain(
        `:is(:${state},[data-forgebook-force~=${state}],[data-forgebook-force~=${state}] *)`
      );
    }
  });

  it("rewrites inside :is(), :not() and :has(), and inside layers", () => {
    expect(rewrite(".a:not(:hover){color:red}")).toBe(`.a:not(${HOVER}){color:red}`);
    expect(rewrite("@layer k{.a:is(.b:hover,.c){color:red}}")).toBe(
      `@layer k{.a:is(.b${HOVER},.c){color:red}}`
    );
  });

  it("leaves other selectors alone", () => {
    expect(rewrite(".a:first-child .b[data-state=open]{color:red}")).toBe(
      ".a:first-child .b[data-state=open]{color:red}"
    );
  });
});
