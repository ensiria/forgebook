/**
 * A story about logic: a function's signature.
 *
 * @module
 */
import { formatCount } from "./format.ts";

export default { title: "Logic/formatCount", component: formatCount, parameters: { logic: true } };

/** Counts. */
export const Default = { render: (): string => `<p>${formatCount(3)}</p>` };
