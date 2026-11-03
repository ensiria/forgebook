/**
 * The HTML renderer: what a story draws (a text, a node, a fragment), how it draws again with new args, its errors and
 * its HTML on a server.
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedDecorator, readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it } from "vitest";

import { htmlRenderer } from "../src/htmlRenderer.ts";

/** The canvases of the running test, emptied after it. */
const canvases: HTMLElement[] = [];

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
});

/** A drawing of a story written as its file would. */
const drawingOf = (
  story: Readonly<Record<string, unknown>>,
  args: Readonly<Record<string, unknown>>,
  meta: Readonly<Record<string, unknown>> = {},
  clock: StoryClock = heldStoryClock(0)
): StoryDrawing => {
  const loaded = readStory({ default: { title: "Kit/Html", ...meta }, Story: story }, "Story");
  if (typeof loaded === "string") throw new Error(loaded);
  return {
    identity: { id: "kit:kit-html--story", name: "Story", title: "Kit/Html" },
    story: loaded,
    args,
    texts: {},
    clock,
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/** A story that writes a field and a heading from its args. */
const FORM = {
  render: (args: { readonly label?: unknown }): string =>
    `<h2>${String(args.label)}</h2><input aria-label="name" value="start"><p hidden>${String(args.label)}</p>`
};

describe("a story that returns HTML", () => {
  it("keeps the elements that stay when its args change: their focus, typed value and identity", async () => {
    const element = canvas();
    const story = htmlRenderer.mount(element, drawingOf(FORM, { label: "One" }), () => undefined);
    await story.drawn;
    const input = element.querySelector("input");
    if (input === null) throw new Error("No input");
    input.focus();
    input.value = "typed";
    story.update(drawingOf(FORM, { label: "Two" }));
    expect(element.querySelector("h2")?.textContent).toBe("Two");
    expect(element.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed");
    expect(document.activeElement).toBe(input);
    story.unmount();
    expect(element.innerHTML).toBe("");
  });

  it("brings attributes to the new HTML, and replaces what changed kind", async () => {
    const element = canvas();
    const render = (args: { readonly tone?: unknown }): string =>
      args.tone === "list" ? "<ul><li>A</li></ul>" : `<p class="${String(args.tone)}" title="x">Text</p>`;
    const story = htmlRenderer.mount(element, drawingOf({ render }, { tone: "info" }), () => undefined);
    await story.drawn;
    const paragraph = element.querySelector("p");
    story.update(drawingOf({ render: (): string => '<p class="danger">Text</p>' }, {}));
    expect(element.querySelector("p")).toBe(paragraph);
    expect(element.innerHTML).toBe('<p class="danger">Text</p>');
    story.update(drawingOf({ render }, { tone: "list" }));
    expect(element.innerHTML).toBe("<ul><li>A</li></ul>");
    story.unmount();
  });

  it("leaves a custom element the children it drew when the HTML gives it none", async () => {
    customElements.define(
      "test-drawn",
      class extends HTMLElement {
        connectedCallback(): void {
          if (this.childElementCount === 0) this.append(this.ownerDocument.createElement("b"));
        }
      }
    );
    const element = canvas();
    const render = (args: { readonly tone?: unknown }): string =>
      `<test-drawn tone="${String(args.tone)}"></test-drawn>`;
    const story = htmlRenderer.mount(element, drawingOf({ render }, { tone: "a" }), () => undefined);
    await story.drawn;
    story.update(drawingOf({ render }, { tone: "b" }));
    expect(element.innerHTML).toBe('<test-drawn tone="b"><b></b></test-drawn>');
    story.unmount();
  });

  it("runs no script its HTML holds", async () => {
    const element = canvas();
    const ran: string[] = [];
    Reflect.set(window, "ranScript", (): number => ran.push("ran"));
    const story = htmlRenderer.mount(
      element,
      drawingOf({ render: (): string => "<script>ranScript()</script><img src=x onerror=ranScript()>" }, {}),
      () => undefined
    );
    await story.drawn;
    expect(ran).toEqual([]);
    story.unmount();
  });

  it("draws again on the story clock's ticks", async () => {
    let now = 0;
    const listeners: (() => void)[] = [];
    const clock: StoryClock = {
      ...heldStoryClock(0),
      now: () => now,
      subscribe: (listener: () => void) => {
        listeners.push(listener);
        return () => undefined;
      }
    };
    const element = canvas();
    const story = htmlRenderer.mount(
      element,
      drawingOf(
        {
          render: (_args: unknown, context: { readonly clock: StoryClock }): string =>
            `<p>${context.clock.now()}</p>`
        },
        {},
        {},
        clock
      ),
      () => undefined
    );
    await story.drawn;
    now = 5;
    for (const listener of listeners) listener();
    expect(element.textContent).toBe("5");
    story.unmount();
  });
});

describe("a story that returns a node", () => {
  it("places it, and keeps it when the story returns the same node again", async () => {
    const kept = document.createElement("button");
    const element = canvas();
    const render = (args: { readonly label?: unknown }): Node => {
      kept.textContent = String(args.label);
      return kept;
    };
    const story = htmlRenderer.mount(element, drawingOf({ render }, { label: "One" }), () => undefined);
    await story.drawn;
    kept.focus();
    story.update(drawingOf({ render }, { label: "Two" }));
    expect(element.firstChild).toBe(kept);
    expect(element.textContent).toBe("Two");
    expect(document.activeElement).toBe(kept);
    story.unmount();
  });

  it("draws the meta's function with the args, inside a decorator that builds a node", async () => {
    const createButton = (args: { readonly label?: unknown }): HTMLButtonElement => {
      const button = document.createElement("button");
      button.textContent = String(args.label);
      return button;
    };
    const frame: LoadedDecorator = (story: () => unknown): HTMLElement => {
      const section = document.createElement("section");
      const inner = story();
      if (inner instanceof Node) section.append(inner);
      return section;
    };
    const element = canvas();
    const drawing = drawingOf({ args: { label: "Save" } }, { label: "Save" }, { component: createButton });
    const story = htmlRenderer.mount(element, { ...drawing, decorators: [frame] }, () => undefined);
    await story.drawn;
    expect(element.innerHTML).toBe("<section><button>Save</button></section>");
    story.unmount();
  });
});

describe("errors", () => {
  it("refuses what is neither HTML nor a node, saying what it was", async () => {
    const errors: Error[] = [];
    const story = htmlRenderer.mount(canvas(), drawingOf({ render: () => ({ label: "x" }) }, {}), (error) =>
      errors.push(error)
    );
    expect(errors[0]?.message).toBe(
      "The render returned [object Object]: an HTML story draws an HTML string or a DOM node"
    );
    story.unmount();
  });

  it("says when a story has neither a render nor a function to draw it", () => {
    const errors: Error[] = [];
    htmlRenderer.mount(canvas(), drawingOf({}, {}), (error) => errors.push(error)).unmount();
    expect(errors[0]?.message).toContain("no render");
  });

  it("hands the frame what a custom element throws while the HTML is placed", async () => {
    customElements.define(
      "test-broken",
      class extends HTMLElement {
        connectedCallback(): void {
          throw new Error("Broken on connect");
        }
      }
    );
    const errors: Error[] = [];
    const element = canvas();
    const story = htmlRenderer.mount(
      element,
      drawingOf({ render: (): string => "<test-broken></test-broken>" }, {}),
      (error) => errors.push(error)
    );
    await expect.poll(() => errors.map((error) => error.message)).toEqual(["Broken on connect"]);
    expect(element.innerHTML).toBe("");
    story.unmount();
  });
});

describe("on a server", () => {
  it("is the story's HTML, inside its decorators' HTML", () => {
    const drawing = drawingOf({ render: (): string => "<b>Bold</b>" }, {});
    const decorated = {
      ...drawing,
      decorators: [(story: () => unknown): string => `<div>${String(story())}</div>`]
    };
    expect(htmlRenderer.renderToString(decorated)).toBe("<div><b>Bold</b></div>");
  });

  it("is a node's outerHTML, a fragment's children and a text's escaped text", () => {
    const fragment = document.createDocumentFragment();
    fragment.append(
      document.createElement("hr"),
      document.createTextNode("a < b"),
      document.createComment(" note ")
    );
    expect(htmlRenderer.renderToString(drawingOf({ render: () => fragment }, {}))).toBe(
      "<hr>a &lt; b<!-- note -->"
    );
    const paragraph = document.createElement("p");
    paragraph.className = "lead";
    expect(htmlRenderer.renderToString(drawingOf({ render: () => paragraph }, {}))).toBe(
      '<p class="lead"></p>'
    );
  });

  it("fails a story that asks for its canvas", () => {
    const drawing = drawingOf(
      {
        render: (_args: unknown, context: { readonly canvasElement: HTMLElement }): string =>
          context.canvasElement.id
      },
      {}
    );
    expect(() => htmlRenderer.renderToString(drawing)).toThrow("no canvas");
  });
});
