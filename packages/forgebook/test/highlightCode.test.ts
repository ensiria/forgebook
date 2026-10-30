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
});
