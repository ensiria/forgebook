/**
 * The stories the extractor reads a composable from.
 *
 * @module
 */
import { useToggle } from "./useToggle.ts";

export default { title: "Docs/useToggle", component: useToggle, parameters: { logic: true } };

/** A scene. */
export const Default = { render: (): string => "scene" };
