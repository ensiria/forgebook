/**
 * The Vue fixture's preview: a decorator around every story, in Vue's two ways of writing one, so a story shows it is
 * inside the catalogue's own wrapper.
 *
 * @module
 */
import type { Preview } from "@forgebook/vue";
import { h } from "vue";

export default {
  decorators: [
    (story, context) =>
      h("div", { "data-testid": "preview", "data-lang": context.globals["lang"] ?? "en" }, [story()])
  ]
} satisfies Preview;
