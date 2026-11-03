/**
 * What Svelte's renderer does beyond the adapter suite: the ways a Svelte story writes what it draws, snippets from the
 * args, decorators, what a story's components read of the frame, and what must not start a story over.
 *
 * @module
 */
import { heldStoryClock, type StoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it } from "vitest";

import { svelteRenderer } from "../src/svelteRenderer.ts";
import Card from "./components/Card.svelte";
import Counter from "./components/Counter.svelte";
import MountThrower from "./components/MountThrower.svelte";
import Reader from "./components/Reader.svelte";
import Section from "./components/Section.svelte";

/** The canvases of the running test. */
const canvases: HTMLElement[] = [];

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  canvases.push(element);
  return element;
};

/** A drawing of a story file's `Plain` story. */
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

/** Waits until a condition holds, as Svelte draws on its own schedule. */
const settled = async (holds: () => boolean): Promise<void> => {
  await expect.poll(holds, { timeout: 2000 }).toBe(true);
};

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
});

describe("what a story draws", () => {
  it("draws the meta's component with the args", async () => {
    const element = canvas();
    const story = svelteRenderer.mount(
      element,
      drawing({}, { label: "Taps" }, { component: Counter }),
      () => undefined
    );
    await story.drawn;
    expect(element.textContent).toBe("Taps 0");
    story.unmount();
  });

  it("draws a component a render returns with the args, and one with props of its choosing", async () => {
    const element = canvas();
    const bare = svelteRenderer.mount(
      element,
      drawing({ render: () => Counter }, { label: "Bare" }),
      () => undefined
    );
    await bare.drawn;
    expect(element.textContent).toBe("Bare 0");
    bare.unmount();
    await settled(() => element.textContent === "");
    const chosen = svelteRenderer.mount(
      element,
      drawing({ render: () => ({ Component: Counter, props: { label: "Chosen" } }) }, { label: "Bare" }),
      () => undefined
    );
    await chosen.drawn;
    expect(element.textContent).toBe("Chosen 0");
    chosen.unmount();
  });

  it("hands the frame an error for a render that returns what cannot be drawn", async () => {
    const errors: Error[] = [];
    const story = svelteRenderer.mount(canvas(), drawing({ render: () => "Words" }), (error) =>
      errors.push(error)
    );
    await settled(() => errors.length === 1);
    expect(errors[0]?.message).toBe("A render returned neither a component nor { Component, props }");
    story.unmount();
  });

  it("hands the frame an error for a story with nothing to draw", async () => {
    const errors: Error[] = [];
    const story = svelteRenderer.mount(canvas(), drawing({}), (error) => errors.push(error));
    await settled(() => errors.length === 1);
    expect(errors[0]?.message).toBe("The story has neither a render nor a component to draw");
    story.unmount();
  });

  it("hands the frame an error for a `#name` that is no text", async () => {
    const errors: Error[] = [];
    const story = svelteRenderer.mount(
      canvas(),
      drawing({}, { "#header": { not: "text" } }, { component: Card }),
      (error) => errors.push(error)
    );
    await settled(() => errors.length === 1);
    expect(errors[0]?.message).toBe(
      "#header takes a text, which its snippet draws; pass a snippet as header"
    );
    story.unmount();
  });

  it("fills snippets from `#name` texts, the content from `#children`, and escapes them", async () => {
    const element = canvas();
    const story = svelteRenderer.mount(
      element,
      drawing({}, { title: "T", "#header": "<b>H</b>", "#children": "Body" }, { component: Card }),
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("header")?.textContent).toBe("<b>H</b>");
    expect(element.querySelector("main")?.textContent).toBe("Body");
    story.update(drawing({}, { title: "T", "#header": "Changed" }, { component: Card }));
    await settled(() => element.querySelector("header")?.textContent === "Changed");
    expect(element.querySelector("main")?.textContent).toBe("");
    story.unmount();
  });
});

describe("decorators", () => {
  it("draws a story inside a decorator's component, and adds nothing for one that returns the story", async () => {
    const element = canvas();
    const plain = drawing({}, { label: "In" }, { component: Counter });
    const story = svelteRenderer.mount(
      element,
      {
        ...plain,
        story: { ...plain.story, decorators: [(inner: () => unknown) => inner()] },
        decorators: [() => ({ Component: Section, props: { label: "outer" } })]
      },
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector('section[data-decorator="outer"] > button')?.textContent).toBe("In 0");
    story.unmount();
  });

  it("gives a decorator the story's context", async () => {
    const element = canvas();
    const plain = drawing({}, { label: "In" }, { component: Counter });
    const story = svelteRenderer.mount(
      element,
      {
        ...plain,
        globals: { lang: "it" },
        decorators: [
          (_inner: () => unknown, context: { readonly globals: Readonly<Record<string, string>> }) => ({
            Component: Section,
            props: { label: context.globals["lang"] }
          })
        ]
      },
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector('[data-decorator="it"]')).not.toBeNull();
    story.unmount();
  });
});

describe("drawing again", () => {
  it("keeps a component's state when the story's render is called again with new args", async () => {
    const element = canvas();
    const render = (args: { readonly label?: unknown }): unknown => ({
      Component: Counter,
      props: { label: args.label }
    });
    const story = svelteRenderer.mount(element, drawing({ render }, { label: "A" }), () => undefined);
    await story.drawn;
    element.querySelector("button")?.click();
    await settled(() => element.textContent === "A 1");
    story.update(drawing({ render }, { label: "B" }));
    await settled(() => element.textContent === "B 1");
    story.unmount();
  });

  it("hands the frame an error thrown on mount, and is never drawn", async () => {
    const errors: Error[] = [];
    let isDrawn = false;
    const story = svelteRenderer.mount(canvas(), drawing({}, {}, { component: MountThrower }), (error) =>
      errors.push(error)
    );
    void story.drawn.then(() => {
      isDrawn = true;
    });
    await settled(() => errors.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(isDrawn).toBe(false);
    story.unmount();
  });
});

describe("what a story's components read", () => {
  /** A clock whose moment the test moves. */
  const movingClock = (start: number): StoryClock & { readonly move: (to: number) => void } => {
    let now = start;
    const listeners = new Set<() => void>();
    return {
      now: () => now,
      subscribe: (onTick: () => void) => {
        listeners.add(onTick);
        return () => listeners.delete(onTick);
      },
      advance: (ms: number) => {
        now += ms;
        for (const listener of listeners) listener();
      },
      move: (to: number) => {
        now = to;
        for (const listener of listeners) listener();
      }
    };
  };

  it("reads the shown language's texts and the clock's moment, and follows both", async () => {
    const element = canvas();
    const clock = movingClock(5);
    const first = { ...drawing({}, {}, { component: Reader }), texts: { "greeting.hello": "Hello" }, clock };
    const story = svelteRenderer.mount(element, first, () => undefined);
    await story.drawn;
    expect(element.textContent).toBe("Hello 5");
    clock.move(6);
    await settled(() => element.textContent === "Hello 6");
    story.update({ ...first, texts: { "greeting.hello": "Ciao" } });
    await settled(() => element.textContent === "Ciao 6");
    story.update({ ...first, texts: { "greeting.hello": "Ciao" }, clock: heldStoryClock(9) });
    await settled(() => element.textContent === "Ciao 9");
    story.unmount();
  });

  it("reads a text's key in brackets when the language has none, and the clock's start", async () => {
    const element = canvas();
    const story = svelteRenderer.mount(element, drawing({}, {}, { component: Reader }), () => undefined);
    await story.drawn;
    expect(element.textContent).toBe("[greeting.hello] 0");
    story.unmount();
  });
});
