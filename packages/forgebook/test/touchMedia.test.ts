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

  it("rewrites a rule whose values hold var() and env()", () => {
    expect(rewrite("@media (hover: hover) { .a { color: var(--x); } }")).toBe(
      `@media (hover:hover){${COMPUTER} .a{color:var(--x)}}`
    );
    expect(rewrite("@media (hover: none) { .b { margin: var(--m, 4px) 0; } }")).toBe(
      `@media (hover:none){${COMPUTER} .b{margin:var(--m,4px) 0}}${PHONE} .b{margin:var(--m,4px) 0}`
    );
    expect(rewrite("@media (pointer: fine) { .c { top: env(safe-area-inset-top, 0px); } }")).toBe(
      `@media (pointer:fine){${COMPUTER} .c{top:env(safe-area-inset-top,0px)}}`
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

  it("scopes a pointer media rule inside another once", () => {
    expect(rewrite("@media (hover: none) { @media (pointer: coarse) { .x { top: 1px } } }")).toBe(
      `@media (hover:none){@media (pointer:coarse){${COMPUTER} .x{top:1px}}${COMPUTER} .x{top:1px}}` +
        `@media (pointer:coarse){${PHONE} .x{top:1px}}${PHONE} .x{top:1px}`
    );
  });

  it("scopes declarations written straight inside a nested media rule, as a rule of their parent", () => {
    expect(rewrite(".a { @media (hover: none) { color: red } }")).toBe(
      `.a{@media (hover:none){${COMPUTER} &{color:red}}${PHONE} &{color:red}}`
    );
  });

  it("reads a negated query with a media type as a phone would", () => {
    expect(rewrite("@media not print and (hover: hover) { .b { top: 1px } }")).toBe(
      `@media not print and (hover:hover){${COMPUTER} .b{top:1px}}${PHONE} .b{top:1px}`
    );
    expect(rewrite("@media not screen and (hover: none) { .c { top: 1px } }")).toBe(
      `@media not screen and (hover:none){${COMPUTER} .c{top:1px}}@media not screen{${PHONE} .c{top:1px}}`
    );
  });

  it("scopes @starting-style, leaves @scope as it is, keeps :host out of the phone's copy", () => {
    expect(rewrite("@media (hover: none) { @starting-style { .s { opacity: 0 } } }")).toBe(
      `@media (hover:none){@starting-style{${COMPUTER} .s{opacity:0}}}@starting-style{${PHONE} .s{opacity:0}}`
    );
    expect(rewrite("@media (hover: none) { @scope (.card) { .t { top: 1px } } }")).toBe(
      "@media (hover:none){@scope(.card){.t{top:1px}}}"
    );
    expect(rewrite("@media (hover: none) { :host(.on) { top: 1px } }")).toBe(
      "@media (hover:none){:host(.on){top:1px}}"
    );
  });

  it("puts the root's condition before a pseudo-element", () => {
    expect(rewrite("@media (hover: none) { :root::view-transition-old(x) { top: 1px } }")).toBe(
      "@media (hover:none){:root:where(:not([data-forgebook-touch]))::view-transition-old(x){top:1px}}" +
        ":root:where([data-forgebook-touch])::view-transition-old(x){top:1px}"
    );
  });
});
