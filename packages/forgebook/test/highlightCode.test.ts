/**
 * Tests for the code the plugin colours at build time: the languages a component's documentation writes, and plain
 * escaped text for the rest.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { escapeHtml, highlightCode } from "../src/vite/highlightCode.ts";

describe("highlightCode", () => {
  it("colours TSX with the catalogue's classes, JSX included", () => {
    const html = highlightCode('const label = <Button tone="danger">Delete</Button>;', "tsx");
    expect(html).toContain('<span class="forgebook-hl-keyword">const</span>');
    expect(html).toContain('<span class="forgebook-hl-name">Button</span>');
    expect(html).toContain('<span class="forgebook-hl-string">&quot;danger&quot;</span>');
  });

  it("escapes and leaves plain a language it does not know, or none", () => {
    expect(highlightCode("<b> & </b>", "brainfuck")).toBe("&lt;b&gt; &amp; &lt;/b&gt;");
    expect(highlightCode("a < b", undefined)).toBe("a &lt; b");
  });

  it("escapes every character HTML gives a meaning to", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("colours the languages a component's documentation writes", () => {
    expect(highlightCode(".card { color: #fff; margin: 4px; } /* note */", "css")).toBe(
      '<span class="forgebook-hl-type">.card</span> { <span class="forgebook-hl-property">color</span>: ' +
        '<span class="forgebook-hl-number">#fff</span>; <span class="forgebook-hl-property">margin</span>: ' +
        '<span class="forgebook-hl-number">4px</span>; } <span class="forgebook-hl-comment">/* note */</span>'
    );
    expect(highlightCode("$size: 2px; // small", "scss")).toContain(
      '<span class="forgebook-hl-comment">// small</span>'
    );
    expect(highlightCode('{ "name": "x", "on": true }', "json")).toBe(
      '{ <span class="forgebook-hl-property">&quot;name&quot;</span>: ' +
        '<span class="forgebook-hl-string">&quot;x&quot;</span>, ' +
        '<span class="forgebook-hl-property">&quot;on&quot;</span>: <span class="forgebook-hl-keyword">true</span> }'
    );
    expect(highlightCode('cd "$HOME" # go', "sh")).toBe(
      '<span class="forgebook-hl-keyword">cd</span> <span class="forgebook-hl-string">&quot;$HOME&quot;</span> ' +
        '<span class="forgebook-hl-comment"># go</span>'
    );
  });

  it("colours HTML's tags and leaves its text alone, quotes included", () => {
    expect(highlightCode('<a href="x">it\'s</a>', "html")).toBe(
      '&lt;<span class="forgebook-hl-name">a</span> <span class="forgebook-hl-attr">href</span>=' +
        '<span class="forgebook-hl-string">&quot;x&quot;</span>&gt;it&#39;s&lt;/' +
        '<span class="forgebook-hl-name">a</span>&gt;'
    );
  });

  it("gives back every character, and stays quick on a long run of what almost matches", () => {
    const code = `/*${"*".repeat(50_000)}"${"\\".repeat(50_000)}`;
    const started = performance.now();
    const html = highlightCode(code, "scss");
    expect(performance.now() - started).toBeLessThan(1000);
    expect(html.replace(/<[^>]*>/g, "")).toBe(escapeHtml(code));
  });
});
