/**
 * Tests for the React renderer: a story drawn in a canvas inside its language, texts and clock, drawn again with new
 * args keeping its state, and its errors handed to the frame.
 *
 * @module
 */

import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedStory, readStory } from "forgebook/story-module";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";

import { reactRenderer } from "../src/reactRenderer";
import { useStoryText } from "../src/texts";

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

/**
 * A drawing of the greeting.
 *
 * @param args - its args.
 * @param wrap - the language's provider; none by default.
 */
const drawing = (args: Record<string, unknown>, wrap?: StoryDrawing["wrap"]): StoryDrawing => ({
  story: loaded({ render: (storyArgs: { readonly name?: unknown }) => <Greeting name={storyArgs.name} /> }),
  args,
  texts: { hello: "Ciao" },
  clock: heldStoryClock(0),
  wrap
});

/** Lets React commit what it was asked to draw. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("reactRenderer", () => {
  it("renders a story on the server inside its language and with its texts", () => {
    const html = reactRenderer.renderToString(
      drawing({ name: "Ada" }, (story: ReactNode): ReactNode => <div lang="it">{story}</div>)
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
    await settle();
    mounted.update({ name: "Grace" });
    await settle();
    expect(canvas.textContent).toBe("Ciao Grace 1");
    mounted.unmount();
    expect(canvas.textContent).toBe("");
  });

  it("hands an error to the frame and draws the story again with other args", async () => {
    const canvas = document.createElement("div");
    document.body.append(canvas);
    const errors: string[] = [];
    const mounted = reactRenderer.mount(canvas, drawing({ name: "Ada" }), (error) =>
      errors.push(error.message)
    );
    await mounted.drawn;
    mounted.update({ name: "boom" });
    await settle();
    expect(errors).toEqual(["No greeting for boom"]);
    expect(canvas.textContent).toBe("");
    mounted.update({ name: "Ada" });
    await settle();
    expect(canvas.textContent).toContain("Ciao Ada");
  });
});
