/**
 * The Solid fixture's preview: a decorator around every story, reading the language from the switches, so a story shows
 * it is inside the catalogue's own wrapper and the wrapper follows the language in place.
 *
 * @module
 */
import type { Preview } from "@forgebook/solid";

export default {
  decorators: [
    (Story, context) => (
      <div data-testid="preview" data-lang={context.globals["lang"] ?? "en"}>
        <Story />
      </div>
    )
  ]
} satisfies Preview;
