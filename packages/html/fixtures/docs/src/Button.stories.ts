/**
 * The stories the extractor reads a function from: the meta's `component`, with a subcomponent.
 *
 * @module
 */
import { createButton, icon } from "./button.ts";

export default { title: "Button", component: createButton, subcomponents: { icon } };

/** The function with its args. */
export const Default = { args: { label: "Save" } };
