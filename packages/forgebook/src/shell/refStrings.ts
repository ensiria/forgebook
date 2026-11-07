/**
 * The words of the composed catalogues (`refs`): their sidebar section and their story's page, loaded with them, so a
 * catalogue that composes none carries none. A catalogue replaces them as any other text of the shell
 * (`strings: { "refs.loading": "Caricamento…" }`).
 *
 * @module
 */
import { textsOfGroup } from "./strings.ts";

/** The composed catalogues' texts, as shown: Forgebook's, with the catalogue's replacements. */
export const REF_STRINGS = textsOfGroup("refs", {
  section: (title: string): string => `${title}, another catalogue`,
  loading: "Loading its stories…",
  empty: "It lists no story",
  unreadable: (title: string, reason: string): string =>
    `${title} could not be read: ${reason}. It is built with forgebook build --agent-index, and its host lets this catalogue fetch its index (CORS).`,
  notIndex: "its forgebook-agent.json is not an index this version reads",
  storyTitle: (story: string, catalogue: string): string => `${story}, from ${catalogue}`,
  openThere: (catalogue: string): string => `Open in ${catalogue}`,
  readOnly: "Shown from another catalogue, read-only: its controls and panel are in its own page.",
  onFramesOrigin: (title: string): string =>
    `${title} is served on the origin this catalogue's stories run on, where it would share their storage: serve it elsewhere.`,
  unknownRef: (id: string): string =>
    `No composed catalogue "${id}" in this configuration: it may have been removed. Pick one in the sidebar.`
});
