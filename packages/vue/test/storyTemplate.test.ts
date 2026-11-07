/**
 * The template a story's args are written as, for the Code card.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { storyTemplate } from "../src/storyTemplate.ts";

describe("storyTemplate", () => {
  it("writes each kind of value as a template binds it", () => {
    expect(
      storyTemplate("Badge", {
        tone: "danger",
        count: 3,
        quiet: true,
        open: false,
        note: null,
        options: ["a", "b"],
        icon: { of: "icon", named: "IconFolder" }
      })
    ).toBe(`<Badge
  tone="danger"
  :count="3"
  quiet
  :open="false"
  :note="null"
  :options="['a', 'b']"
  :icon="IconFolder"
/>`);
  });

  it("writes a prop in kebab-case", () => {
    expect(storyTemplate("Field", { maxLength: 8 })).toBe('<Field :max-length="8" />');
  });

  it("keeps a quote inside its attribute", () => {
    expect(storyTemplate("Field", { label: 'Say "hi"' })).toBe('<Field label="Say &quot;hi&quot;" />');
    expect(storyTemplate("Field", { options: ["it's"] })).toBe(`<Field :options="['it\\'s']" />`);
  });

  it("writes the default slot between the tags, and a named one in its template", () => {
    expect(storyTemplate("Badge", { tone: "info", "#default": "New" })).toBe(
      '<Badge tone="info">New</Badge>'
    );
    expect(storyTemplate("Badge", { default: "New" })).toBe("<Badge>New</Badge>");
    expect(storyTemplate("Card", { "#default": "Body", "#header": "Title" })).toBe(`<Card>
  <template #default>Body</template>
  <template #header>Title</template>
</Card>`);
  });

  it("keeps a slot's text a text, once pasted in a template", () => {
    expect(storyTemplate("Badge", { "#default": "<b>{{ x }} & y" })).toBe(
      "<Badge>&lt;b>&#123;&#123; x }} &amp; y</Badge>"
    );
  });

  it("writes a named value in a slot as its component", () => {
    expect(storyTemplate("Badge", { "#default": { of: "Slot", named: "IconFolder" } })).toBe(
      "<Badge><IconFolder /></Badge>"
    );
  });

  it("leaves out an empty slot", () => {
    expect(storyTemplate("Badge", { "#default": false, "#icon": null })).toBe("<Badge />");
  });

  it("binds the args the file writes as code as written, but never in a slot", () => {
    expect(
      storyTemplate(
        "Dialog",
        { title: "Hi", "#default": "Body" },
        { onClose: 'fn("x")', "#default": "h(Body)" }
      )
    ).toBe('<Dialog title="Hi" :on-close="fn(&quot;x&quot;)">Body</Dialog>');
  });
});
