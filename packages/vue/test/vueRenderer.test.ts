/**
 * What Vue's renderer does beyond the adapter suite: the ways a Vue story writes what it draws, slots from the args, and
 * what must not start a story over.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedArgs, readStory } from "forgebook/story-module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, isVNode, nextTick, onMounted, ref, type SetupContext, type VNode } from "vue";

import { useStoryClock, useStoryNow } from "../src/clock.ts";
import { useStoryText } from "../src/texts.ts";
import { vueRenderer } from "../src/vueRenderer.ts";

/** What a decorator's `story()` gave, typed `unknown` by the frame. */
const asVNode = (value: unknown): VNode | null => (isVNode(value) ? value : null);

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

/** A component that counts its clicks. */
const Counter = defineComponent({
  props: { label: { type: String, default: "" } },
  setup: (props: Readonly<{ label: string }>): (() => VNode) => {
    const clicks = ref(0);
    const onClick = (): void => {
      clicks.value += 1;
    };
    return (): VNode => h("button", { onClick }, `${props.label} ${clicks.value}`);
  }
});

/** Slots and props of a component. */
const Card = defineComponent({
  props: { title: { type: String, default: "" } },
  setup:
    (props: Readonly<{ title: string }>, { slots }: SetupContext): (() => VNode) =>
    (): VNode =>
      h("article", [h("h1", props.title), h("header", slots["header"]?.()), h("main", slots["default"]?.())])
});

afterEach(() => {
  for (const each of canvases.splice(0)) each.remove();
});

describe("what a story draws", () => {
  it("draws a text, a list and nothing", async () => {
    const element = canvas();
    const text = vueRenderer.mount(element, drawing({ render: () => "Words" }), () => undefined);
    await text.drawn;
    expect(element.textContent).toBe("Words");
    text.unmount();
    const list = vueRenderer.mount(element, drawing({ render: () => ["A", h("b", "B")] }), () => undefined);
    await list.drawn;
    expect(element.textContent).toBe("AB");
    list.unmount();
    const none = vueRenderer.mount(element, drawing({ render: () => null }), () => undefined);
    await none.drawn;
    expect(element.textContent).toBe("");
    none.unmount();
  });

  it("compiles a template, reading the args from setup", async () => {
    const element = canvas();
    const story = vueRenderer.mount(
      element,
      drawing(
        {
          render: (args: unknown) => ({
            setup: () => ({ args }),
            template: "<p>{{ args.name }}</p>"
          })
        },
        { name: "Ada" }
      ),
      () => undefined
    );
    await story.drawn;
    expect(element.textContent).toBe("Ada");
    story.unmount();
  });
});

describe("the meta's component", () => {
  it("fills slots from `#name` and `default`, and passes the rest as props", async () => {
    const element = canvas();
    const story = vueRenderer.mount(
      element,
      drawing({}, { title: "T", "#header": "H", default: () => h("i", "Body") }, { component: Card }),
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("h1")?.textContent).toBe("T");
    expect(element.querySelector("header")?.textContent).toBe("H");
    expect(element.querySelector("main i")?.textContent).toBe("Body");
    expect(element.querySelector("article")?.hasAttribute("#header")).toBe(false);
    story.unmount();
  });

  it("passes a slot's scope to the function that fills it", async () => {
    const Scoped = defineComponent({
      setup:
        (_props: unknown, { slots }: SetupContext): (() => unknown) =>
        (): unknown =>
          slots["default"]?.({ count: 7 })
    });
    const element = canvas();
    const fill = (scope: unknown): string => JSON.stringify(scope);
    const story = vueRenderer.mount(
      element,
      drawing({}, { "#default": fill }, { component: Scoped }),
      () => undefined
    );
    await story.drawn;
    expect(element.textContent).toBe('{"count":7}');
    story.unmount();
  });

  it("removes an arg that is gone", async () => {
    const element = canvas();
    const first = drawing({}, { title: "T" }, { component: Card });
    const story = vueRenderer.mount(element, first, () => undefined);
    await story.drawn;
    story.update({ ...first, args: {} });
    await nextTick();
    expect(element.querySelector("h1")?.textContent).toBe("");
    story.unmount();
  });
});

describe("drawing again", () => {
  it("keeps a story written as a component, its render called once", async () => {
    const element = canvas();
    const render = vi.fn((args: unknown): unknown => ({
      components: { Counter },
      setup: () => ({ args }),
      template: '<Counter v-bind="args" />'
    }));
    const first = drawing({ render }, { label: "A" });
    const story = vueRenderer.mount(element, first, () => undefined);
    await story.drawn;
    element.querySelector("button")?.click();
    await nextTick();
    story.update({ ...first, args: { label: "B" } });
    await nextTick();
    expect(element.textContent).toBe("B 1");
    expect(render).toHaveBeenCalledTimes(1);
    story.unmount();
  });

  it("keeps a story written as a component when the language changes, and its text follows", async () => {
    const element = canvas();
    const render = (_args: unknown, context: StoryContext<LoadedArgs>): unknown => ({
      components: { Counter },
      setup: () => ({ context }),
      template: "<Counter :label=\"context.text('hello')\" />"
    });
    const first: StoryDrawing = { ...drawing({ render }), texts: { hello: "Hello" } };
    const story = vueRenderer.mount(element, first, () => undefined);
    await story.drawn;
    element.querySelector("button")?.click();
    await nextTick();
    story.update({ ...first, texts: { hello: "Ciao" } });
    await nextTick();
    expect(element.textContent).toBe("Ciao 1");
    story.unmount();
  });

  it("calls the render again when a switch changes, for a decorator that reads it", async () => {
    const element = canvas();
    const first: StoryDrawing = {
      ...drawing({ render: () => "Story" }),
      decorators: [
        (inner: () => unknown, { globals }: StoryContext<LoadedArgs>): VNode =>
          h("div", { "data-theme": globals["theme"] }, [asVNode(inner())])
      ],
      globals: { theme: "light" }
    };
    const story = vueRenderer.mount(element, first, () => undefined);
    await story.drawn;
    story.update({ ...first, globals: { theme: "dark" } });
    await nextTick();
    expect(element.querySelector("div")?.getAttribute("data-theme")).toBe("dark");
    story.unmount();
  });

  it("gives a decorator a story that also works as a component", async () => {
    const element = canvas();
    const first = drawing({ render: () => h("b", "Inner") });
    const story = vueRenderer.mount(
      element,
      {
        ...first,
        decorators: [
          (inner: () => unknown): unknown => ({
            components: { inner },
            template: "<section><inner /></section>"
          })
        ]
      },
      () => undefined
    );
    await story.drawn;
    expect(element.querySelector("section b")?.textContent).toBe("Inner");
    story.unmount();
  });
});

describe("errors", () => {
  it("hears of an error once, and never says the story is drawn", async () => {
    const element = canvas();
    const errors: Error[] = [];
    const Thrower = defineComponent({
      setup: () => {
        throw new Error("In setup");
      }
    });
    const story = vueRenderer.mount(element, drawing({ render: () => h(Thrower) }), (error) =>
      errors.push(error)
    );
    const hasDrawn = await Promise.race([
      story.drawn.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30))
    ]);
    expect(hasDrawn).toBe(false);
    expect(errors.map((error) => error.message)).toEqual(["In setup"]);
    story.unmount();
  });

  it("does not say a story is drawn when it throws in `onMounted`", async () => {
    const element = canvas();
    const errors: Error[] = [];
    const Thrower = defineComponent({
      setup: (): (() => null) => {
        onMounted(() => {
          throw new Error("In mounted");
        });
        return (): null => null;
      }
    });
    const story = vueRenderer.mount(element, drawing({ render: () => h(Thrower) }), (error) =>
      errors.push(error)
    );
    const hasDrawn = await Promise.race([
      story.drawn.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30))
    ]);
    expect(hasDrawn).toBe(false);
    expect(errors.map((error) => error.message)).toEqual(["In mounted"]);
    story.unmount();
  });

  it("leaves a story standing when an event handler throws", async () => {
    const element = canvas();
    const errors: Error[] = [];
    const Clicker = defineComponent({
      setup: () => () =>
        h(
          "button",
          {
            onClick: () => {
              throw new Error("In a handler");
            }
          },
          "Press"
        )
    });
    const story = vueRenderer.mount(element, drawing({ render: () => h(Clicker) }), (error) =>
      errors.push(error)
    );
    await story.drawn;
    // Vue rethrows it past the boundary, as an uncaught error of the page
    expect(() => element.querySelector("button")?.click()).toThrow("In a handler");
    await nextTick();
    expect(errors).toEqual([]);
    expect(element.textContent).toBe("Press");
    story.unmount();
  });
});

describe("on a server", () => {
  it("waits for what a setup awaits", async () => {
    const Awaiting = defineComponent({
      setup: async () => {
        const text = await Promise.resolve("Awaited");
        return () => h("p", text);
      }
    });
    expect(await vueRenderer.renderToString(drawing({ render: () => h(Awaiting) }))).toContain("Awaited");
  });

  it("fails on an error in a render, which Vue's server would leave as an empty comment", async () => {
    const story = drawing({
      render: () =>
        h(
          defineComponent({
            render: () => {
              throw new Error("In render");
            }
          })
        )
    });
    await expect(vueRenderer.renderToString(story)).rejects.toThrow("In render");
  });
});

describe("the composables", () => {
  /** Reads the story's text and clock. */
  const Reader = defineComponent({
    setup: () => {
      const text = useStoryText();
      const clock = useStoryClock();
      const now = useStoryNow();
      return () => h("p", `${text("hello")} ${now.value} ${clock.value.now()}`);
    }
  });

  it("read the frame's texts and clock, and follow a new language", async () => {
    const element = canvas();
    const first: StoryDrawing = {
      ...drawing({ render: () => h(Reader) }),
      texts: { hello: "Hello" },
      clock: heldStoryClock(5)
    };
    const story = vueRenderer.mount(element, first, () => undefined);
    await story.drawn;
    expect(element.textContent).toBe("Hello 5 5");
    story.update({ ...first, texts: { hello: "Ciao" } });
    await nextTick();
    expect(element.textContent).toBe("Ciao 5 5");
    story.unmount();
  });

  it("follow a clock that replaces the story's", async () => {
    const element = canvas();
    const first: StoryDrawing = { ...drawing({ render: () => h(Reader) }), clock: heldStoryClock(5) };
    const story = vueRenderer.mount(element, first, () => undefined);
    await story.drawn;
    story.update({ ...first, clock: heldStoryClock(9) });
    await nextTick();
    await nextTick();
    expect(element.textContent).toContain("9 9");
    story.unmount();
  });

  it("give a key in brackets and the epoch outside a catalogue", async () => {
    const html = await vueRenderer.renderToString(drawing({ render: () => h(Reader) }));
    expect(html).toContain("0 0");
  });
});
