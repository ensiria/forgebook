/**
 * A story about logic: a function, read by its signature.
 *
 * @module
 */
import { injectToggle } from "./injectToggle.ts";

export default { title: "Logic/injectToggle", component: injectToggle, parameters: { logic: true } };

/** The Default story. */
export const Default = { render: (): { readonly template: string } => ({ template: "" }) };
