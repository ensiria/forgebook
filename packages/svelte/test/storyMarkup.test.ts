/**
 * The markup the Code card shows for a Svelte story: attributes as Svelte writes them, and snippets between the tags.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyMarkup } from "../src/storyMarkup.ts";

describe("a story's markup", () => {
  it("writes each kind of value as Svelte does", () => {
    expect(storyMarkup("Badge", { label: "New", count: 3, removable: true, hidden: false, tone: null })).toBe(
      '<Badge label="New" count={3} removable hidden={false} tone={null} />'
    );
  });

  it("writes a text that holds a brace or a quote as an expression", () => {
    expect(storyMarkup("Badge", { label: 'Say "{hi}"' })).toBe('<Badge label={"Say \\"{hi}\\""} />');
  });

  it("writes a list and a named value", () => {
    expect(storyMarkup("Picker", { options: ["a", 2], icon: { of: "Icon", named: "IconFolder" } })).toBe(
      '<Picker options={["a", 2]} icon={IconFolder} />'
    );
  });

  it("writes the content between the tags, escaped", () => {
    expect(storyMarkup("Button", { tone: "info", "#children": "Save <now> {x}" })).toBe(
      '<Button tone="info">Save &lt;now> &#123;x&#125;</Button>'
    );
  });

  it("writes a named snippet in its block, before the content", () => {
    expect(storyMarkup("Card", { "#children": "Body", "#header": "Title", "#footer": null })).toBe(
      "<Card>\n  {#snippet header()}Title{/snippet}\n  Body\n</Card>"
    );
  });

  it("leaves out a snippet's value that is no text, which the renderer refuses", () => {
    expect(storyMarkup("Button", { label: "Save", "#icon": { of: "Icon", named: "IconSave" } })).toBe(
      '<Button label="Save" />'
    );
  });

  it("puts each attribute on a line of its own when they do not fit on one", () => {
    const markup = storyMarkup("Dialog", {
      title: "A title that is long enough",
      description: "And a description that pushes it over"
    });
    expect(markup).toBe(
      '<Dialog\n  title="A title that is long enough"\n  description="And a description that pushes it over"\n/>'
    );
  });
});
