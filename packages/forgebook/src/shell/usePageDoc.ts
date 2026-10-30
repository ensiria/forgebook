/**
 * A component's page text for its page: its documentation file as HTML, loaded from the source's `pages`.
 *
 * @module
 */
import { type Loaded, useLoaded } from "./useLoaded";

/** A component's page text: its documentation file's HTML and its file's summary. */
export type PageDoc = {
  /** The documentation file as HTML, its title and its generated sections left out; empty without one. */
  readonly html: string;
  /** The first paragraph of the component file's `@module` comment, the page's lead; empty without one. */
  readonly summary: string;
};

/** What the plugin answered, as a state: the HTML and the summary, or why it failed. */
const pageState = (value: unknown): Loaded<PageDoc> => {
  if (typeof value === "object" && value !== null && "html" in value && typeof value.html === "string") {
    const summary = "summary" in value && typeof value.summary === "string" ? value.summary : "";
    return { status: "ready", value: { html: value.html, summary } };
  }
  return { status: "error", message: "The component's page has an unexpected shape" };
};

/**
 * The page text of a story file's component.
 *
 * @param load - the source's loader for the file; `undefined` when it has none.
 */
export const usePageDoc = (load: (() => Promise<unknown>) | undefined): Loaded<PageDoc> =>
  useLoaded(load, pageState);
