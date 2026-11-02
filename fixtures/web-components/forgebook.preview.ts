/**
 * The Web Components fixture's preview: a decorator around every story, so a story shows it is inside the catalogue's
 * own wrapper and which language it is drawn in.
 *
 * @module
 */
import type { Preview } from "@forgebook/web-components";
import { html } from "lit";

export default {
  decorators: [
    (story, context) =>
      html`<div data-testid="preview" data-lang=${context.globals["lang"] ?? "en"}>${story()}</div>`
  ]
} satisfies Preview;
