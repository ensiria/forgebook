/**
 * The docs the story's panel reads: the component's, read from its types, or for a catalogue that reads none
 * (`componentDocs: false`) the story's args as its props (`argsProps.ts`), once its frame reported them.
 *
 * @module
 */
import { useMemo } from "react";

import { docsOfArgs } from "../argsProps.ts";
import type { PanelArgs } from "../messages.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { type DocsState, useComponentDocs } from "./useComponentDocs.ts";

/** The state before a story's frame reported its args: one value, so what reads it is not renewed each render. */
const DOCS_LOADING: DocsState = { status: "loading" };

/**
 * The panel's docs of the shown story.
 *
 * @param loadDocs - loads the component's docs; `undefined` when the source has none for the file.
 * @param name - the component's name.
 * @param args - the story's args, as its frame reported them; none before it did.
 * @param actions - the args the frame records as actions.
 */
export const usePanelDocs = (
  loadDocs: (() => Promise<unknown>) | undefined,
  name: string,
  args: PanelArgs | undefined,
  actions: readonly string[]
): DocsState => {
  const { hasComponentDocs } = useCatalogue();
  const typeDocs = useComponentDocs(loadDocs);
  return useMemo(() => {
    if (hasComponentDocs) return typeDocs;
    return args === undefined ? DOCS_LOADING : { status: "ready", value: docsOfArgs(name, args, actions) };
  }, [hasComponentDocs, typeDocs, name, args, actions]);
};
