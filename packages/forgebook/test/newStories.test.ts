/**
 * Tests for the first stories `forgebook new` writes from a component's props.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { newStories } from "../bin/forgebook/newStories.ts";
import type { ComponentDocs, PropDocs } from "../src/componentDocs.ts";
import { propsSignature, writtenSignature } from "../src/propsSignature.ts";
import { WORST_NUMBER, WORST_TEXT } from "../src/worstCase.ts";

/** A prop, required unless said. */
const prop = (fields: Partial<PropDocs> & Pick<PropDocs, "name" | "kind" | "type">): PropDocs => ({
  description: "",
  isRequired: true,
  ...fields
});

/** A badge with a required label, a choice of tones, a count, an event and a prop of another kind. */
const BADGE: ComponentDocs = {
  name: "Badge",
  description: "A small label.",
  summary: "",
  props: [
    prop({ name: "label", kind: "text", type: "string" }),
    prop({
      name: "tone",
      kind: "choice",
      type: '"neutral" | "danger"',
      choices: ["neutral", "danger"],
      isRequired: false
    }),
    prop({ name: "count", kind: "number", type: "number", isRequired: false }),
    prop({ name: "onDismiss", kind: "event", type: "() => void", isRequired: false }),
    prop({ name: "icon", kind: "other", type: "IconName" }),
    prop({ name: "tags", kind: "other", type: "readonly string[]" })
  ],
  parts: [],
  subcomponents: []
};

const TEXT = newStories({
  docs: BADGE,
  importStatement: 'import { Badge } from "./Badge";',
  title: "Actions/Badge",
  typesModule: "@forgebook/react"
});

describe("newStories", () => {
  it("writes the meta with the framework's types and the component's import", () => {
    expect(TEXT).toContain('import type { Meta, Story } from "@forgebook/react";');
    expect(TEXT).toContain('import { Badge } from "./Badge";');
    expect(TEXT).toContain(
      'export default { title: "Actions/Badge", component: Badge } satisfies Meta<typeof Badge>;'
    );
  });

  it("says which props it was written for, so verify can tell when they change", () => {
    expect(writtenSignature(TEXT)).toBe(propsSignature(BADGE.props));
  });

  it("fills the required props from their kind, a list with nothing, and leaves a TODO where only a person knows", () => {
    expect(TEXT).toContain('args: { label: "Label", tags: [] },\n  parameters: { main: true }');
    expect(TEXT).toContain("// TODO: give icon: IconName");
    expect(TEXT).not.toContain("onDismiss");
  });

  it("writes one story per value of the first choice prop", () => {
    expect(TEXT).toContain("export const ToneNeutral: Story<typeof Badge> = {");
    expect(TEXT).toContain('args: { label: "Label", tags: [], tone: "danger" }');
  });

  it("writes the worst case with long texts and huge numbers, in its group", () => {
    expect(TEXT).toContain(`label: ${JSON.stringify(WORST_TEXT)}`);
    expect(TEXT).toContain(`count: ${WORST_NUMBER}`);
    expect(TEXT).toContain('parameters: { group: "worst-case" }');
  });

  it("quotes an arg whose name is no identifier", () => {
    const text = newStories({
      docs: {
        ...BADGE,
        props: [
          {
            name: "#default",
            kind: "other",
            type: "Slot",
            description: "",
            isRequired: false,
            canTakeText: true
          }
        ]
      },
      importStatement: 'import Badge from "./Badge.vue";',
      title: "Actions/Badge",
      typesModule: "@forgebook/vue"
    });
    expect(text).toContain('"#default": ');
    expect(text).toContain('import Badge from "./Badge.vue";');
  });
});
