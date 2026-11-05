/**
 * Stories the shell's tests edit while a frame draws them: one written in this file, one it re-exports from another.
 *
 * @module
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { NoteField } from "./NoteField";

const meta = { title: "Storybook/Hot edit", component: NoteField } satisfies Meta<typeof NoteField>;

export default meta;

/** The field, with a label written in this file. */
export const Own: StoryObj<typeof meta> = { args: { label: "Written here" } };

/** The label comes from the story's and the preview's globals, so an edit of either must reach what is drawn. */
export const FromGlobals: StoryObj<typeof meta> = {
  args: { label: "Not shown" },
  globals: { note: "Written in the globals" },
  render: (_args, context) => (
    <NoteField label={`${String(context.globals["note"])}, ${String(context.globals["previewNote"])}`} />
  )
};

/* eslint-disable no-restricted-syntax -- a story re-exported from another file is what the test edits, as a library
writes them (Fluent UI) */
// biome-ignore lint/performance/noBarrelFile: see above
export { Behind } from "../reexported/HotEditBehind.stories";
