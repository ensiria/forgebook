/**
 * Web Components passing the adapter suite: the definition of done every framework adapter meets.
 *
 * @module
 */
import { join } from "node:path";

import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter, THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";
import { html, LitElement, type TemplateResult } from "lit";

import { codeOf } from "../src/storyHtml.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";
import { webComponentsRenderer } from "../src/webComponentsRenderer.ts";

/** The subject's element: a greeting with a counter of its own, drawn in its light DOM so the suite reads its text. */
class ConformanceGreeting extends LitElement {
  static override properties = { name: {}, clicks: { state: true } };
  declare name: string;
  declare clicks: number;

  constructor() {
    super();
    this.clicks = 0;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override render(): TemplateResult {
    if (this.name === THROWING_NAME) throw new Error("No greeting");
    return html`<button type="button" @click=${(): void => {
      this.clicks += 1;
    }}>Hello ${this.name} ${this.clicks}</button>`;
  }
}
customElements.define("conformance-greeting", ConformanceGreeting);

/** A drawing of the greeting. */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: {
        render: (args: { readonly name?: unknown }) =>
          html`<conformance-greeting name=${String(args.name)}></conformance-greeting>`
      }
    },
    "Plain"
  );
  if (typeof story === "string") throw new Error(story);
  return {
    identity: { id: "kit:kit-greeting--plain", name: "Plain", title: "Kit/Greeting" },
    story,
    args: { name },
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

describeAdapter({
  name: "Web Components",
  renderer: webComponentsRenderer,
  drawing,
  decorator:
    (label: string): LoadedDecorator =>
    (story: () => unknown): TemplateResult =>
      html`<section data-decorator=${label}>${story()}</section>`,
  codeOf,
  docsOf: () =>
    extractComponentDocs(join(import.meta.dirname, "..", "fixtures", "manifest", "src", "Button.stories.ts"))
});
