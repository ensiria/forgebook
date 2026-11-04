/**
 * HTML drawn again over itself: a field keeps what the person typed while the panel changes its label.
 *
 * @module
 */
import type { Meta, Story } from "@forgebook/html";

/** A field's args. */
type FieldArgs = {
  /** The field's label. */
  readonly label: string;
  /** A hint under the field. */
  readonly hint?: string;
};

/** A text, escaped for the HTML it is written into. */
const escaped = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default {
  title: "Inputs/Field",
  render: ({ label = "", hint = "" }) =>
    `<label class="field">${escaped(label)} <input data-testid="input" name="name"></label><p data-testid="hint">${escaped(hint)}</p>`,
  args: { label: "Name", hint: "As on your card" }
} satisfies Meta<FieldArgs>;

/** A field with its label and its hint. */
export const Default: Story<FieldArgs> = {};
