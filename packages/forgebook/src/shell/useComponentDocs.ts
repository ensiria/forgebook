/**
 * The props panel's data for a story file: loaded from the source's `docs` when the component changes.
 *
 * @module
 */
import { type ComponentDocs, isComponentDocs } from "../componentDocs.ts";
import { type Loaded, useLoaded } from "./useLoaded.ts";

/** The panel's data: loading, a component, no component (a page), or why it failed. */
export type DocsState = Loaded<ComponentDocs>;

/** What the plugin answered, as a state. */
const docsState = (value: unknown): DocsState => {
  if (isComponentDocs(value)) return { status: "ready", value };
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return { status: "error", message: value.error };
  }
  if (typeof value === "object" && value !== null && "name" in value && value.name === null)
    return { status: "none" };
  return { status: "error", message: "The component's docs have an unexpected shape" };
};

/**
 * The docs of a story file's component.
 *
 * @param load - the source's loader for the file; `undefined` when it has none.
 */
export const useComponentDocs = (load: (() => Promise<unknown>) | undefined): DocsState =>
  useLoaded(load, docsState);
