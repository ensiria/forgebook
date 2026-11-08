/**
 * A component whose props are a discriminated union and a generic: the API reference lists every variant's props, each
 * with when it can be passed, and says what a type parameter is shown as.
 *
 * @module
 */
import { Action } from "./Action";

export default { title: "Storybook/Prop types", component: Action };

/** The link variant. */
export const Link = { args: { kind: "link", href: "#", label: "Read more" } };
