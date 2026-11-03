/**
 * Plain HTML passing the adapter suite: the definition of done every framework adapter meets.
 *
 * @module
 */
import { join } from "node:path";

import { heldStoryClock } from "@forgebook/story-format/clock";
import { describeAdapter, THROWING_NAME } from "@forgebook/testing/conformance";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";

import { htmlRenderer } from "../src/htmlRenderer.ts";
import { codeOf } from "../src/storyCall.ts";
import { extractComponentDocs } from "../src/vite/extractDocs.ts";

/**
 * The subject's element: a greeting with a counter of its own, drawn in its light DOM so the suite reads its text. A
 * plain custom element, as an HTML library writes one: the story's HTML names it, and new HTML sets its attribute.
 */
class ConformanceGreeting extends HTMLElement {
  static readonly observedAttributes = ["name"];
  #clicks = 0;

  connectedCallback(): void {
    this.#draw();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#draw();
  }

  #draw(): void {
    const button = this.querySelector("button") ?? this.ownerDocument.createElement("button");
    if (!button.isConnected) {
      button.type = "button";
      button.addEventListener("click", () => {
        this.#clicks += 1;
        this.#draw();
      });
      this.append(button);
    }
    button.textContent = `Hello ${this.getAttribute("name") ?? ""} ${this.#clicks}`;
  }
}
customElements.define("conformance-greeting", ConformanceGreeting);

/** A text inside a double-quoted attribute. */
const attributeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** A drawing of the greeting: HTML naming the element, which throws for one name. */
const drawing = (name: string): StoryDrawing => {
  const story = readStory(
    {
      default: { title: "Kit/Greeting" },
      Plain: {
        render: (args: { readonly name?: unknown }): string => {
          if (args.name === THROWING_NAME) throw new Error("No greeting");
          return `<conformance-greeting name="${attributeText(String(args.name))}"></conformance-greeting>`;
        }
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
  name: "HTML",
  renderer: htmlRenderer,
  drawing,
  decorator:
    (label: string): LoadedDecorator =>
    (story: () => unknown): string =>
      `<section data-decorator="${attributeText(label)}">${String(story())}</section>`,
  codeOf,
  docsOf: () =>
    extractComponentDocs(join(import.meta.dirname, "..", "fixtures", "docs", "src", "Button.stories.ts"))
});
