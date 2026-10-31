/**
 * Tests for the touch simulation's CSS rewrite, through Lightning CSS as the catalogue's build runs it: the pointer's
 * media features answered as the computer's or as a phone's by the root's attribute, and the mouse's hover off while
 * touch is simulated.
 *
 * @module
 */
import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";

import { FORCED_STATES_VISITOR } from "../src/vite/forcedStates.ts";

/** A style sheet rewritten, minified so it reads on one line. */
const rewrite = (css: string): string =>
  transform({
    filename: "test.css",
    code: Buffer.from(css),
    minify: true,
    visitor: FORCED_STATES_VISITOR
  }).code.toString();

const COMPUTER = ":where(:root:not([data-forgebook-touch]))";
const PHONE = ":where(:root[data-forgebook-touch])";

describe("the pointer's media under simulated touch", () => {
  it("keeps a computer's query for the computer and drops it for the phone", () => {
    expect(rewrite("@media (hover: hover) { .a { color: red } }")).toBe(
      `@media (hover:hover){${COMPUTER} .a{color:red}}`
    );
  });

  it("copies a phone's query without its media, for a root that simulates touch", () => {
    expect(rewrite("@media (hover: none) { .a { color: blue } }")).toBe(
      `@media (hover:none){${COMPUTER} .a{color:#00f}}${PHONE} .a{color:#00f}`
    );
    expect(rewrite("@media not (hover: hover) { .c { top: 1px } }")).toBe(
      `@media not (hover:hover){${COMPUTER} .c{top:1px}}${PHONE} .c{top:1px}`
    );
  });

  it("keeps the rest of the query, and the other queries of a list", () => {
    expect(rewrite("@media (pointer: coarse) and (min-width: 600px) { .b { top: 1px } }")).toBe(
      `@media (pointer:coarse) and (width>=600px){${COMPUTER} .b{top:1px}}@media (width>=600px){${PHONE} .b{top:1px}}`
    );
    expect(rewrite("@media (any-pointer: fine), print { .d { top: 2px } }")).toBe(
      `@media (any-pointer:fine),print{${COMPUTER} .d{top:2px}}@media print{${PHONE} .d{top:2px}}`
    );
  });

  it("puts the condition on the root itself for a selector that starts there", () => {
    expect(rewrite("@media (hover: none) { :root { --h: 1 } }")).toBe(
      "@media (hover:none){:root:where(:not([data-forgebook-touch])){--h:1}}:root:where([data-forgebook-touch]){--h:1}"
    );
  });

  it("leaves a query that asks nothing of the pointer as it is", () => {
    expect(rewrite("@media (min-width: 600px) { .f { top: 1px } }")).toBe(
      "@media (width>=600px){.f{top:1px}}"
    );
  });

  it("turns the mouse's hover off while touch is simulated, forced hover still on", () => {
    expect(rewrite(".g:hover { color: red }")).toBe(
      ".g:is(:hover:where(:not(:root[data-forgebook-touch] *)),[data-forgebook-force~=hover],[data-forgebook-force~=hover] *){color:red}"
    );
  });
});
