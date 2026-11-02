/**
 * What the Web Components renderer does beyond the adapter suite: an element drawn from its args, attributes and
 * properties, slots, events recorded, the ways a story or an element fails, and what must not start a story over.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { html, LitElement, type TemplateResult } from "lit";
import { afterEach, describe, expect, it } from "vitest";

import { webComponentsRenderer } from "../src/webComponentsRenderer.ts";

/** An element with an attribute, a property no attribute sets, two slots, and a click counter of its own. */
class TestCard extends LitElement {
  static override properties = {
    heading: {},
    tone: { reflect: true },
    items: { attribute: false },
    selectedItems: { type: Array, attribute: "selected-items" },
    accentColor: {},
    clicks: { state: true }
  };
  declare heading: string;
  declare tone: string;
  declare items: readonly string[];
  declare selectedItems: readonly string[];
  declare accentColor: string;
  declare clicks: number;

  constructor() {
    super();
    this.heading = "";
    this.tone = "neutral";
    this.items = [];
    this.selectedItems = [];
    this.accentColor = "";
    this.clicks = 0;
  }

  /** Tells the page it was pressed, without bubbling. */
  press(): void {
    this.clicks += 1;
    this.dispatchEvent(new CustomEvent("press", { detail: this.clicks }));
  }

  protected override render(): TemplateResult {
    return html`<h1>${this.heading}</h1>
      <ul>${this.items.map((item) => html`<li>${item}</li>`)}</ul>
      <slot name="icon"></slot><slot></slot><output>${this.clicks}</output>`;
  }
}
customElements.define("test-card", TestCard);

/** An element whose update throws for one heading. */
class TestFragile extends LitElement {
  static override properties = { heading: {} };
  declare heading: string;

  protected override render(): TemplateResult {
    if (this.heading === "boom") throw new Error("Fragile broke");
    return html`<p>${this.heading}</p>`;
  }
}
customElements.define("test-fragile", TestFragile);

/** An element that throws as it is inserted. */
class TestBroken extends HTMLElement {
  connectedCallback(): void {
    throw new Error("Broken on insert");
  }
}
customElements.define("test-broken", TestBroken);

/** A class never defined as an element. */
class TestUndefined extends HTMLElement {}

/** The canvases of the running test. */
const canvases: HTMLElement[] = [];

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

/** A drawing of a story with a meta. */
const drawing = (
  story: Readonly<Record<string, unknown>>,
  args: Readonly<Record<string, unknown>> = {},
  meta: Readonly<Record<string, unknown>> = {}
): StoryDrawing => {
  const loaded = readStory({ default: { title: "Kit/Thing", ...meta }, Plain: story }, "Plain");
  if (typeof loaded === "string") throw new Error(loaded);
  return {
    identity: { id: "kit:kit-thing--plain", name: "Plain", title: "Kit/Thing" },
    story: loaded,
    args,
    texts: {},
    clock: heldStoryClock(0),
    decorators: [],
    globals: {},
    loaded: {}
  };
};

/** The card in a canvas. */
const cardIn = (element: HTMLElement): TestCard => {
  const card = element.querySelector("test-card");
  if (!(card instanceof TestCard)) throw new Error(`No card: ${element.innerHTML}`);
  return card;
};

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
});

describe("an element drawn from its args", () => {
  it("sets attributes, properties and slots, and keeps the element as the args change", async () => {
    const element = canvas();
    const first = drawing(
      {},
      { heading: "Hi", ".items": ["a", "b"], "#default": "Body" },
      { component: "test-card" }
    );
    const story = webComponentsRenderer.mount(element, first, () => undefined);
    await story.drawn;
    const card = cardIn(element);
    expect(card.getAttribute("heading")).toBe("Hi");
    expect(card.items).toEqual(["a", "b"]);
    expect(card.textContent).toContain("Body");
    card.press();
    story.update(drawing({}, { heading: "Again", tone: "info" }, { component: "test-card" }));
    await card.updateComplete;
    expect(cardIn(element)).toBe(card);
    expect(card.clicks).toBe(1);
    expect(card.getAttribute("tone")).toBe("info");
    expect(card.items).toEqual([]);
    expect(card.textContent).not.toContain("Body");
    story.unmount();
  });

  it("takes an attribute away for false, and sets a list under a plain name as a property", async () => {
    const element = canvas();
    const meta = { component: TestCard };
    const story = webComponentsRenderer.mount(element, drawing({}, { heading: true }, meta), () => undefined);
    await story.drawn;
    expect(cardIn(element).getAttribute("heading")).toBe("");
    story.update(drawing({}, { heading: false, items: ["x"] }, meta));
    expect(cardIn(element).hasAttribute("heading")).toBe(false);
    expect(cardIn(element).items).toEqual(["x"]);
    story.unmount();
  });

  it("sets no handler attribute and no property that writes HTML, whatever the args say", async () => {
    const element = canvas();
    const args = { onfocus: "alert(1)", innerHTML: ["<img>"], ".innerHTML": "<img>", heading: "Kept" };
    const story = webComponentsRenderer.mount(
      element,
      drawing({}, args, { component: "test-card" }),
      () => undefined
    );
    await story.drawn;
    const card = cardIn(element);
    expect(card.hasAttribute("onfocus")).toBe(false);
    expect(card.querySelector("img")).toBeNull();
    expect(card.getAttribute("heading")).toBe("Kept");
    story.unmount();
  });

  it("sets a list under an attribute's name on the field Lit names for it, and gives the field back after", async () => {
    const element = canvas();
    const meta = { component: "test-card" };
    const story = webComponentsRenderer.mount(
      element,
      drawing({}, { "selected-items": ["a"] }, meta),
      () => undefined
    );
    await story.drawn;
    const card = cardIn(element);
    expect(card.selectedItems).toEqual(["a"]);
    expect(Reflect.get(card, "selected-items")).toBeUndefined();
    story.update(drawing({}, {}, meta));
    expect(card.selectedItems).toEqual([]);
    story.unmount();
  });

  it("sets a plain name with a capital as a property, as Storybook does", async () => {
    const element = canvas();
    const story = webComponentsRenderer.mount(
      element,
      drawing({}, { accentColor: "red" }, { component: "test-card" }),
      () => undefined
    );
    await story.drawn;
    expect(cardIn(element).accentColor).toBe("red");
    expect(cardIn(element).hasAttribute("accentcolor")).toBe(false);
    story.unmount();
  });

  it("fills a named slot from a function, in a span the code writer writes too", async () => {
    const element = canvas();
    const args = { "#icon": (): TemplateResult => html`<b>*</b>` };
    const story = webComponentsRenderer.mount(
      element,
      drawing({}, args, { component: "test-card" }),
      () => undefined
    );
    await story.drawn;
    expect(cardIn(element).querySelector('span[slot="icon"] b')?.textContent).toBe("*");
    story.unmount();
  });
});

describe("events", () => {
  it("hands an event arg every event of its name, though it does not bubble, with or without a render", async () => {
    const calls: unknown[] = [];
    const record = (event: Event): void => {
      calls.push(event instanceof CustomEvent ? event.detail : undefined);
    };
    const element = canvas();
    const plain = drawing({}, { "@press": record }, { component: "test-card" });
    const story = webComponentsRenderer.mount(element, plain, () => undefined);
    await story.drawn;
    cardIn(element).press();
    story.unmount();
    const rendered = drawing(
      { render: (): TemplateResult => html`<test-card></test-card>` },
      { "@press": record }
    );
    const other = webComponentsRenderer.mount(element, rendered, () => undefined);
    await other.drawn;
    cardIn(element).press();
    expect(calls).toEqual([1, 1]);
    other.unmount();
    element.dispatchEvent(new CustomEvent("press", { detail: 3 }));
    expect(calls).toHaveLength(2);
  });

  it("calls the arg of the moment, which the frame wraps anew at each draw", async () => {
    const calls: string[] = [];
    const element = canvas();
    const meta = { component: "test-card" };
    const story = webComponentsRenderer.mount(
      element,
      drawing({}, { "@press": () => calls.push("first") }, meta),
      () => undefined
    );
    await story.drawn;
    story.update(drawing({}, { "@press": () => calls.push("second") }, meta));
    cardIn(element).press();
    expect(calls).toEqual(["second"]);
    story.unmount();
  });
});

describe("what a story returns", () => {
  it("takes a text as HTML, and draws a decorator's template around a node", async () => {
    const element = canvas();
    const markup = drawing({ render: (): string => '<test-card heading="Markup"></test-card>' });
    const story = webComponentsRenderer.mount(
      element,
      { ...markup, decorators: [(inner: () => unknown): TemplateResult => html`<main>${inner()}</main>`] },
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("main test-card")?.getAttribute("heading")).toBe("Markup");
    story.unmount();
  });

  it("draws again at each tick of the story clock", async () => {
    const element = canvas();
    const clock = heldStoryClock(1000);
    const live = drawing({
      render: (_args: unknown, context: { readonly clock: { readonly now: () => number } }): TemplateResult =>
        html`<time>${context.clock.now()}</time>`
    });
    const story = webComponentsRenderer.mount(element, { ...live, clock }, () => undefined);
    await story.drawn;
    clock.advance(500);
    expect(element.querySelector("time")?.textContent).toBe("1500");
    story.unmount();
  });
});

describe("errors", () => {
  it("hands the frame what a render throws, and draws again when the args change", async () => {
    const errors: Error[] = [];
    const element = canvas();
    const render = (args: { readonly heading?: unknown }): TemplateResult => {
      if (args.heading === "boom") throw new Error("Render broke");
      return html`<p>${String(args.heading)}</p>`;
    };
    const story = webComponentsRenderer.mount(element, drawing({ render }, { heading: "boom" }), (error) =>
      errors.push(error)
    );
    expect(errors.map((error) => error.message)).toEqual(["Render broke"]);
    story.update(drawing({ render }, { heading: "Fine" }));
    await story.drawn;
    expect(element.textContent).toContain("Fine");
    story.unmount();
  });

  it("hands the frame what an element's update throws, and draws a new element after", async () => {
    const errors: Error[] = [];
    const element = canvas();
    const meta = { component: "test-fragile" };
    const story = webComponentsRenderer.mount(element, drawing({}, { heading: "boom" }, meta), (error) =>
      errors.push(error)
    );
    await expect.poll(() => errors.map((error) => error.message)).toEqual(["Fragile broke"]);
    story.update(drawing({}, { heading: "Fine" }, meta));
    await story.drawn;
    const fragile = element.querySelector("test-fragile");
    expect(fragile?.shadowRoot?.textContent).toContain("Fine");
    story.unmount();
  });

  it("hands the frame what an element throws as it is inserted", () => {
    const errors: Error[] = [];
    const story = webComponentsRenderer.mount(
      canvas(),
      drawing({}, {}, { component: "test-broken" }),
      (error) => errors.push(error)
    );
    expect(errors.map((error) => error.message)).toEqual(["Broken on insert"]);
    story.unmount();
  });

  it("says what is wrong with a component that names no element", () => {
    const errors: string[] = [];
    const onError = (error: Error): void => {
      errors.push(error.message);
    };
    webComponentsRenderer.mount(canvas(), drawing({}, {}, { component: "Card" }), onError).unmount();
    webComponentsRenderer.mount(canvas(), drawing({}, {}, { component: TestUndefined }), onError).unmount();
    expect(errors).toEqual([
      '"Card" is not a custom element\'s name: it needs a hyphen and no capital',
      "TestUndefined is not defined: its module calls customElements.define before its stories draw"
    ]);
  });
});

describe("the server render", () => {
  it("writes an element from its args, attributes escaped and slots between its tags", async () => {
    const args = {
      heading: 'Say "hi" <now>',
      quiet: true,
      off: false,
      ".items": ["a"],
      "#icon": "*",
      "#default": "Body"
    };
    const html = await webComponentsRenderer.renderToString(drawing({}, args, { component: "test-card" }));
    expect(html).toMatch(/<test-card\s+heading="Say &quot;hi&quot; &lt;now&gt;" quiet/);
    expect(html).not.toContain("off");
    expect(html).toContain('<span slot="icon">');
    expect(html).toContain("Body");
    expect(html).toContain("shadowrootmode");
  });

  it("writes a render's template inside its decorators", async () => {
    const story = drawing({ render: (): TemplateResult => html`<test-card heading="T"></test-card>` });
    const decorated = {
      ...story,
      decorators: [(inner: () => unknown): TemplateResult => html`<main>${inner()}</main>`]
    };
    expect(await webComponentsRenderer.renderToString(decorated)).toMatch(/<main>.*<test-card/s);
  });

  it("refuses a component that names no element", async () => {
    await expect(
      webComponentsRenderer.renderToString(drawing({}, {}, { component: "Card" }))
    ).rejects.toThrow(/not a custom element's name/);
  });
});
