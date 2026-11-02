/**
 * Tests for the Solid renderer in a page: new args, switches and texts reach what reads them without running the story
 * again, an object arg stays the object the story passed, a story waits for its resources before it is drawn, and its
 * errors reach the frame.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedArgs, type LoadedStory, readPreview, readStory } from "forgebook/story-module";
import { createEffect, createResource, createSignal, type JSX } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { useStoryNow } from "../src/clock.ts";
import { solidRenderer } from "../src/solidRenderer.ts";
import { useStoryText } from "../src/texts.ts";

/**
 * A story from a story file's exports, as the frame reads it.
 *
 * @param story - the story's export.
 * @param meta - the meta's fields besides its title.
 */
const loaded = (story: Record<string, unknown>, meta: Record<string, unknown> = {}): LoadedStory => {
  const read = readStory({ default: { title: "Kit/Greeting", ...meta }, Greeting: story }, "Greeting");
  if (typeof read === "string") throw new Error(read);
  return read;
};

/**
 * A drawing of a story.
 *
 * @param story - the story.
 * @param overrides - what differs from the default drawing.
 */
const drawing = (story: LoadedStory, overrides: Partial<StoryDrawing> = {}): StoryDrawing => ({
  identity: { id: "kit:kit-greeting--greeting", name: "Greeting", title: "Kit/Greeting" },
  story,
  args: { name: "Ada" },
  texts: { hello: "Ciao" },
  clock: heldStoryClock(0),
  decorators: [],
  globals: { lang: "it" },
  loaded: {},
  ...overrides
});

/** A canvas in the page. */
const canvas = (): HTMLElement => {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
};

/**
 * A greeting in the shown language's text, at the story's moment.
 *
 * @param props - the name.
 */
const Greeting = (props: { readonly name?: unknown }): JSX.Element => {
  const text = useStoryText();
  const now = useStoryNow();
  return (
    <p>
      {text("hello")} {String(props.name)} {now()}
    </p>
  );
};

describe("solidRenderer", () => {
  it("runs a story once: new args, texts and clock ticks reach only what reads them", async () => {
    let renders = 0;
    const story = loaded({
      render: (args: { readonly name?: unknown }) => {
        renders += 1;
        return <Greeting name={args.name} />;
      }
    });
    const clock = heldStoryClock(1000);
    const element = canvas();
    const mounted = solidRenderer.mount(element, drawing(story, { clock }), () => undefined);
    await mounted.drawn;
    expect(element.textContent).toBe("Ciao Ada 1000");
    mounted.update(drawing(story, { clock, args: { name: "Grace" }, texts: { hello: "Hello" } }));
    expect(element.textContent).toBe("Hello Grace 1000");
    clock.advance(500);
    expect(element.textContent).toBe("Hello Grace 1500");
    expect(renders).toBe(1);
    mounted.unmount();
    expect(element.textContent).toBe("");
  });

  it("hands a meta's component the args as props: a spread follows a value set later, and a value taken away", async () => {
    const Label = (props: { readonly text?: string; readonly tone?: string }): JSX.Element => (
      <b data-tone={props.tone}>{props.text}</b>
    );
    const story = loaded(
      { render: (args: Record<string, string>) => <Label {...args} /> },
      { component: Label }
    );
    const element = canvas();
    const mounted = solidRenderer.mount(element, drawing(story, { args: { text: "Bold" } }), () => undefined);
    await mounted.drawn;
    expect(element.innerHTML).toBe("<b>Bold</b>");
    mounted.update(drawing(story, { args: { text: "Bold", tone: "danger" } }));
    expect(element.innerHTML).toBe('<b data-tone="danger">Bold</b>');
    mounted.update(drawing(story, { args: { tone: "danger" } }));
    expect(element.innerHTML).toBe('<b data-tone="danger"></b>');
    const alone = canvas();
    const component = solidRenderer.mount(
      alone,
      drawing(loaded({}, { component: Label }), { args: { text: "A" } }),
      () => undefined
    );
    await component.drawn;
    component.update(drawing(loaded({}, { component: Label }), { args: { text: "B" } }));
    expect(alone.innerHTML).toBe("<b>B</b>");
  });

  it("keeps an object arg the object the story passed, not a copy", async () => {
    const options = [{ id: "weekly" }, { id: "monthly" }];
    const seen: unknown[] = [];
    const story = loaded({
      render: (args: { readonly value?: unknown }) => {
        createEffect(() => seen.push(args.value));
        return null;
      }
    });
    const element = canvas();
    const mounted = solidRenderer.mount(
      element,
      drawing(story, { args: { value: options[0] } }),
      () => undefined
    );
    await mounted.drawn;
    mounted.update(drawing(story, { args: { value: options[1] } }));
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[0]).toBe(options[0]);
    expect(seen[1]).toBe(options[1]);
  });

  it("follows a switch a decorator reads from its globals, without running the story again", async () => {
    let renders = 0;
    const inLanguage = (story: () => JSX.Element, context: StoryContext<LoadedArgs>): JSX.Element => (
      <div lang={context.globals["lang"]}>{story()}</div>
    );
    const story = loaded({
      render: () => {
        renders += 1;
        return <span>Story</span>;
      }
    });
    const decorators = readPreview({ decorators: [inLanguage] }).decorators;
    const element = canvas();
    const mounted = solidRenderer.mount(element, drawing(story, { decorators }), () => undefined);
    await mounted.drawn;
    expect(element.innerHTML).toBe('<div lang="it"><span>Story</span></div>');
    mounted.update(drawing(story, { decorators, globals: { lang: "en" } }));
    expect(element.innerHTML).toBe('<div lang="en"><span>Story</span></div>');
    expect(renders).toBe(1);
  });

  it("starts another story over", async () => {
    const counter = loaded({
      render: () => {
        const [clicks, setClicks] = createSignal(0);
        return (
          <button type="button" onClick={() => setClicks(clicks() + 1)}>
            {clicks()}
          </button>
        );
      }
    });
    const element = canvas();
    const mounted = solidRenderer.mount(element, drawing(counter), () => undefined);
    await mounted.drawn;
    element.querySelector("button")?.click();
    expect(element.textContent).toBe("1");
    const identity = { id: "kit:kit-greeting--other", name: "Other", title: "Kit/Greeting" };
    mounted.update(drawing(counter, { identity }));
    expect(element.textContent).toBe("0");
    mounted.unmount();
  });

  it("is drawn once the resources it reads have loaded", async () => {
    let finish = (): void => undefined;
    const pending = new Promise<string>((resolve) => {
      finish = (): void => resolve("Loaded");
    });
    const story = loaded({
      render: () => {
        const [value] = createResource(() => pending);
        return <i>{value()}</i>;
      }
    });
    const element = canvas();
    const mounted = solidRenderer.mount(element, drawing(story), () => undefined);
    let isDrawn = false;
    void mounted.drawn.then(() => {
      isDrawn = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(isDrawn).toBe(false);
    finish();
    await mounted.drawn;
    expect(element.innerHTML).toBe("<i>Loaded</i>");
  });

  it("hands the frame an error thrown in an effect, once, and tries again with the next args", async () => {
    const story = loaded({
      render: (args: { readonly name?: unknown }) => {
        createEffect(() => {
          if (args.name === "boom") throw new Error("Effect failed");
        });
        return <p>{String(args.name)}</p>;
      }
    });
    const errors: string[] = [];
    const element = canvas();
    const mounted = solidRenderer.mount(element, drawing(story, { args: { name: "boom" } }), (error) =>
      errors.push(error.message)
    );
    await vi.waitFor(() => expect(errors).toEqual(["Effect failed"]));
    expect(element.textContent).toBe("");
    mounted.update(drawing(story, { args: { name: "Ada" } }));
    await vi.waitFor(() => expect(element.textContent).toBe("Ada"));
    await mounted.drawn;
  });
});
