/**
 * The panel's controls for props that are more than a text or a number: the fields come from the component's types, and
 * a control the story names over them.
 *
 * @module
 */
import type { ArgType } from "@forgebook/story-format/csf";

import { ValueProps } from "./ValueProps";

/** The controls the types do not give. */
const argTypes: Readonly<Record<string, ArgType>> = {
  note: { control: "textarea" },
  payload: { control: "object" }
};

export default { title: "Storybook/Value props", component: ValueProps, argTypes };

/** Values for most props, so each field shows one. */
export const Filled = {
  args: {
    title: "Città del Vaticano",
    count: 3,
    tags: ["uno", "due", "tre"],
    address: { street: "Via Roma" },
    size: "sm",
    bounds: [1, 9]
  }
};

/** No value at all: every field starts empty. */
export const Empty = {};

/** A radius and a space from the catalogue's tokens, written as CSS custom properties. */
export const WithTokens = {
  args: { title: "Tokens" },
  argTypes: {
    title: { control: { type: "token", of: "space" } },
    note: { control: { type: "token", of: "radius", format: "var(--{name})" } }
  } satisfies Readonly<Record<string, ArgType>>
};

/** A file kept in the link. */
export const NamedControls = {
  args: { title: "Files" },
  argTypes: {
    payload: { control: { type: "file", accept: "image/*" } }
  } satisfies Readonly<Record<string, ArgType>>
};
