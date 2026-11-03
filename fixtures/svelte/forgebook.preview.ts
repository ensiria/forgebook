/**
 * The Svelte fixture's preview: a decorator around every story, so a story shows it is inside the catalogue's own
 * wrapper, which reads the language.
 *
 * @module
 */
import type { Preview } from "@forgebook/svelte";

import PreviewFrame from "./src/PreviewFrame.svelte";

export default {
  decorators: [
    (_story, context) => ({ Component: PreviewFrame, props: { lang: context.globals["lang"] ?? "en" } })
  ]
} satisfies Preview;
