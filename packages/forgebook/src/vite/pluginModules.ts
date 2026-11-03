/**
 * The module the plugin answers with a story file's component docs, as the docs' worker read them.
 *
 * @remarks
 * The modules made from a file's text (a story's code, a component's page, Markdown) are `textModules.ts`, which the
 * plugin loads on their first query: what they need is heavy, and a story's page needs none of it.
 *
 * @module
 */
import type { DocsResult } from "./docsExtractor.ts";

/**
 * The module that answers a `?forgebook-docs` import: the story file's component docs, or `{ error }` for the panel.
 *
 * @param component - what the extractor read for the story file.
 * @param watch - adds a file whose edit renews the module.
 */
export const docsModule = (
  component: DocsResult,
  watch: (file: string) => void
): { code: string; moduleType: "js" } => {
  // the docs come from the component's files, not the story file the id names: Vite renews them on an edit only if
  // it watches those files too
  if (typeof component !== "string" && "sources" in component) {
    for (const file of component.sources) watch(file);
  }
  const value = typeof component === "string" ? { error: component } : component.docs;
  return { code: `export default ${JSON.stringify(value)};`, moduleType: "js" };
};
