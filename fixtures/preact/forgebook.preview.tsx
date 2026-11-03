/**
 * The Preact fixture's preview: a decorator around every story, reading the language from the switches, so a story shows
 * it is inside the catalogue's own wrapper.
 *
 * @module
 */
import type { Preview } from "@forgebook/preact";

export default {
  decorators: [
    (story, context) => (
      <div data-testid="preview" data-lang={context.globals["lang"] ?? "en"}>
        {story()}
      </div>
    )
  ]
} satisfies Preview;
