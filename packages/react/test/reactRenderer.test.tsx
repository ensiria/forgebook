/**
 * Tests for the React renderer: a story drawn in a canvas inside its language, texts and clock, drawn again with new
 * args keeping its state, and its errors handed to the frame.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { StoryDrawing } from "forgebook/renderer";
import {
  type LoadedArgs,
  type LoadedDecorator,
  type LoadedStory,
  readPreview,
  readStory
} from "forgebook/story-module";
import { forwardRef, memo, type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { reactRenderer } from "../src/reactRenderer.tsx";
import { useStoryText } from "../src/texts.ts";

/**
 * A story from a story file's exports, as the frame reads it.
 *
 * @param story - the story's export.
 */
const loaded = (story: Record<string, unknown>): LoadedStory => {
  const read = readStory({ default: { title: "Kit/Greeting" }, Greeting: story }, "Greeting");
  if (typeof read === "string") throw new Error(read);
  return read;
};

/** A greeting in the shown language's text, with a counter of its own state. */
const Greeting = ({ name }: { readonly name?: unknown }): ReactNode => {
  const text = useStoryText();
  const [clicks, setClicks] = useState(0);
  if (name === "boom") throw new Error("No greeting for boom");
  return (
    <button type="button" onClick={(): void => setClicks(clicks + 1)}>
      {text("hello")} {String(name)} {clicks}
    </button>
  );
};

/** A catalogue's decorator: the language's provider, reading the language from the story's globals. */
const inLanguage = (story: () => ReactNode, context: StoryContext<LoadedArgs>): ReactNode => (
  <div lang={context.globals["lang"]}>{story()}</div>
);

/**
 * A drawing of the greeting.
 *
 * @param args - its args.
 * @param decorators - the catalogue's decorators; none by default.
 */
const drawing = (
  args: Record<string, unknown>,
  decorators: readonly LoadedDecorator[] = []
): StoryDrawing => ({
  identity: { id: "kit:kit-greeting--greeting", name: "Greeting", title: "Kit/Greeting" },
  story: loaded({ render: (storyArgs: { readonly name?: unknown }) => <Greeting name={storyArgs.name} /> }),
  args,
  texts: { hello: "Ciao" },
  clock: heldStoryClock(0),
  decorators,
  globals: { lang: "it" },
  loaded: {}
});

/** A component made by `memo`: an object, not a function. */
const Memoized = memo(({ name }: { readonly name?: unknown }): ReactNode => <b>{String(name)}</b>);

/** A component made by `forwardRef`: an object, not a function. */
const Forwarded = forwardRef<HTMLElement, { readonly name?: unknown }>(({ name }, ref) => (
  <i ref={ref}>{String(name)}</i>
));

describe("reactRenderer", () => {
  it("renders a story on the server inside the catalogue's decorators, which read its globals, with its texts", () => {
    const html = reactRenderer.renderToString(
      // the decorator comes as a catalogue's preview gives it, read without its types
      drawing({ name: "Ada" }, readPreview({ decorators: [inLanguage] }).decorators)
    );
    expect(html).toContain('<div lang="it">');
    expect(html).toContain("Ciao");
  });

  it("is drawn in its canvas, and new args keep the story's own state", async () => {
    const canvas = document.createElement("div");
    document.body.append(canvas);
    const mounted = reactRenderer.mount(canvas, drawing({ name: "Ada" }), () => undefined);
    await mounted.drawn;
    canvas.querySelector("button")?.click();
    // React commits when it schedules: each step waits for what it should show, not for a fixed time
    await vi.waitFor(() => expect(canvas.textContent).toBe("Ciao Ada 1"));
    mounted.update(drawing({ name: "Grace" }));
    await vi.waitFor(() => expect(canvas.textContent).toBe("Ciao Grace 1"));
    mounted.unmount();
    expect(canvas.textContent).toBe("");
  });

  it("calls hooks in a story's render and in a decorator, which Storybook's stories do", async () => {
    const canvas = document.createElement("div");
    document.body.append(canvas);
    const inSection = (story: () => ReactNode): ReactNode => {
      const [label] = useState("wrapped");
      return <section aria-label={label}>{story()}</section>;
    };
    const errors: string[] = [];
    const hooked = {
      ...drawing({ name: "Ada" }, readPreview({ decorators: [inSection] }).decorators),
      story: loaded({
        render: () => {
          const [text] = useState("from a hook");
          return <p>{text}</p>;
        }
      })
    };
    const mounted = reactRenderer.mount(canvas, hooked, (error) => errors.push(error.message));
    await vi.waitFor(() => expect(canvas.textContent).toBe("from a hook"));
    expect(canvas.querySelector("section")?.getAttribute("aria-label")).toBe("wrapped");
    expect(errors).toEqual([]);
    mounted.unmount();
  });

  it("hands an error to the frame and draws the story again with other args", async () => {
    const canvas = document.createElement("div");
    document.body.append(canvas);
    const errors: string[] = [];
    const mounted = reactRenderer.mount(canvas, drawing({ name: "Ada" }), (error) =>
      errors.push(error.message)
    );
    await mounted.drawn;
    mounted.update(drawing({ name: "boom" }));
    await vi.waitFor(() => expect(errors).toEqual(["No greeting for boom"]));
    expect(canvas.textContent).toBe("");
    mounted.update(drawing({ name: "Ada" }));
    await vi.waitFor(() => expect(canvas.textContent).toContain("Ciao Ada"));
  });

  it("draws a meta's component made by memo or forwardRef, with the story's args", () => {
    for (const component of [Memoized, Forwarded]) {
      const story = readStory({ default: { title: "Kit/Name", component }, Shown: {} }, "Shown");
      if (typeof story === "string") throw new Error(story);
      const html = reactRenderer.renderToString({ ...drawing({ name: "Ada" }), story });
      expect(html).toContain("Ada");
    }
  });
});
