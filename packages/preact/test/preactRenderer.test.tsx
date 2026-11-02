/**
 * Tests for the Preact renderer: a story drawn in a canvas inside its language, texts and clock, a render that calls
 * hooks, a class component, another story starting over, and the server render waiting for a lazy component.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedArgs, type LoadedStory, readPreview, readStory } from "forgebook/story-module";
import { Component, type ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { describe, expect, it, vi } from "vitest";

import { useStoryNow } from "../src/clock.ts";
import { preactRenderer } from "../src/preactRenderer.tsx";
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

/** A greeting in the shown language's text, at the story's moment. */
const Greeting = ({ name }: { readonly name?: unknown }): ComponentChildren => {
  const text = useStoryText();
  const now = useStoryNow();
  return (
    <p>
      {text("hello")} {String(name)} {now}
    </p>
  );
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

/** A catalogue's decorator: the language's provider, reading the language from the story's globals. */
const inLanguage = (story: () => ComponentChildren, context: StoryContext<LoadedArgs>): ComponentChildren => (
  <div lang={context.globals["lang"]}>{story()}</div>
);

describe("preactRenderer", () => {
  const greeting = loaded({ render: (args: { readonly name?: unknown }) => <Greeting name={args.name} /> });

  it("draws a story with its texts and its clock, and follows the clock's ticks", async () => {
    const clock = heldStoryClock(1000);
    const element = canvas();
    const story = preactRenderer.mount(element, drawing(greeting, { clock }), () => undefined);
    await story.drawn;
    expect(element.textContent).toBe("Ciao Ada 1000");
    clock.advance(500);
    await vi.waitFor(() => expect(element.textContent).toBe("Ciao Ada 1500"));
    story.update(drawing(greeting, { clock, texts: { hello: "Hello" } }));
    await vi.waitFor(() => expect(element.textContent).toBe("Hello Ada 1500"));
    story.unmount();
    expect(element.textContent).toBe("");
  });

  it("runs a render that calls hooks as a component, keeping its state through new args", async () => {
    const counter = loaded({
      render: (args: { readonly label?: unknown }) => {
        const [clicks, setClicks] = useState(0);
        return (
          <button type="button" onClick={() => setClicks(clicks + 1)}>
            {String(args.label)}: {clicks}
          </button>
        );
      }
    });
    const element = canvas();
    const story = preactRenderer.mount(
      element,
      drawing(counter, { args: { label: "Clicks" } }),
      () => undefined
    );
    await story.drawn;
    element.querySelector("button")?.click();
    await vi.waitFor(() => expect(element.textContent).toBe("Clicks: 1"));
    story.update(drawing(counter, { args: { label: "Taps" } }));
    await vi.waitFor(() => expect(element.textContent).toBe("Taps: 1"));
    story.unmount();
  });

  it("starts another story over: its state is not the last one's", async () => {
    const counter = loaded({
      render: () => {
        const [clicks, setClicks] = useState(0);
        return (
          <button type="button" onClick={() => setClicks(clicks + 1)}>
            {clicks}
          </button>
        );
      }
    });
    const element = canvas();
    const story = preactRenderer.mount(element, drawing(counter), () => undefined);
    await story.drawn;
    element.querySelector("button")?.click();
    await vi.waitFor(() => expect(element.textContent).toBe("1"));
    const identity = { id: "kit:kit-greeting--other", name: "Other", title: "Kit/Greeting" };
    story.update(drawing(counter, { identity }));
    await vi.waitFor(() => expect(element.textContent).toBe("0"));
    story.unmount();
  });

  it("draws a meta's class component with the story's args", async () => {
    /** A class component, as Preact draws one. */
    class Label extends Component<{ readonly text?: string }> {
      /** The text. */
      override render(): ComponentChildren {
        return <b>{this.props.text}</b>;
      }
    }
    const element = canvas();
    const story = preactRenderer.mount(
      element,
      drawing(loaded({}, { component: Label }), { args: { text: "Bold" } }),
      () => undefined
    );
    await story.drawn;
    expect(element.innerHTML).toBe("<b>Bold</b>");
    story.unmount();
  });

  it("hands the frame an error thrown in an effect, once, and does not call the story drawn", async () => {
    const failing = loaded({
      render: () => {
        useEffect(() => {
          throw new Error("Effect failed");
        }, []);
        return <p>Drawn</p>;
      }
    });
    const errors: string[] = [];
    const element = canvas();
    const mounted = preactRenderer.mount(element, drawing(failing), (error) => errors.push(error.message));
    let isDrawn = false;
    void mounted.drawn.then(() => {
      isDrawn = true;
    });
    await vi.waitFor(() => expect(errors).toEqual(["Effect failed"]));
    expect(element.textContent).toBe("");
    // a story that threw is not drawn: its play must not run on it
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(isDrawn).toBe(false);
  });

  it("renders a story on the server inside the catalogue's decorators, which read its globals", async () => {
    const html = await preactRenderer.renderToString(
      // the decorator comes as a catalogue's preview gives it, read without its types
      drawing(greeting, { decorators: readPreview({ decorators: [inLanguage] }).decorators })
    );
    expect(html).toBe('<div lang="it"><p>Ciao Ada 0</p></div>');
  });

  it("waits on the server for what a story suspends on", async () => {
    let isLoaded = false;
    const pending = new Promise<void>((resolve) => {
      setTimeout(() => {
        isLoaded = true;
        resolve();
      }, 10);
    });
    const Suspending = (): ComponentChildren => {
      if (!isLoaded) throw pending;
      return <i>Loaded</i>;
    };
    // the markers are where a page would show the boundary's fallback while it waits
    expect(await preactRenderer.renderToString(drawing(loaded({ render: () => <Suspending /> })))).toContain(
      "<i>Loaded</i>"
    );
  });
});
