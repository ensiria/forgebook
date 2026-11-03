/**
 * Tests for the React Native renderer: each story drawn with react-native-web inside a root laid out as React
 * Native's, which a full-screen story fills and which leaves the frame's canvas as the frame made it.
 *
 * @module
 */
import { heldStoryClock } from "@forgebook/story-format/clock";
import type { StoryDrawing } from "forgebook/renderer";
import { type LoadedStory, readStory } from "forgebook/story-module";
import { act, type ReactNode } from "react";
import { Text, View } from "react-native";
import { describe, expect, it } from "vitest";

import { NATIVE_ROOT_ATTRIBUTE } from "../src/nativeFrameRenderer.ts";
import { nativeRenderer } from "../src/nativeRenderer.ts";

/** A screen as React Native writes one: a view that fills its parent with `flex: 1`. */
const Screen = ({ title }: { readonly title?: unknown }): ReactNode => (
  <View testID="screen" style={{ flex: 1 }}>
    <Text>{String(title)}</Text>
  </View>
);

/**
 * A story of the screen, as the frame reads it.
 *
 * @param layout - the story's layout.
 */
const screenStory = (layout: "padded" | "centered" | "fullscreen"): LoadedStory => {
  const read = readStory(
    {
      default: { title: "App/Screen", parameters: { layout } },
      Home: { render: (args: { readonly title?: unknown }) => <Screen title={args.title} /> }
    },
    "Home"
  );
  if (typeof read === "string") throw new Error(read);
  return read;
};

/**
 * A drawing of the screen.
 *
 * @param story - the story.
 * @param title - the screen's title.
 */
const drawing = (story: LoadedStory, title: string): StoryDrawing => ({
  identity: { id: "app:app-screen--home", name: "Home", title: "App/Screen" },
  story,
  args: { title },
  texts: {},
  clock: heldStoryClock(0),
  decorators: [],
  globals: {},
  loaded: {}
});

/**
 * A canvas as the frame makes it, in the page.
 *
 * @param layout - the story's layout.
 */
const canvasOf = (layout: string): HTMLElement => {
  const canvas = document.createElement("div");
  canvas.className = "forgebook-frame";
  canvas.dataset["layout"] = layout;
  document.body.append(canvas);
  return canvas;
};

describe("the React Native renderer", () => {
  it("draws the story with react-native-web inside a root that is a flex column, as tall as its canvas asks", async () => {
    const canvas = canvasOf("fullscreen");
    const mounted = await act(async () =>
      nativeRenderer.mount(canvas, drawing(screenStory("fullscreen"), "Harbour"), () => undefined)
    );
    await act(async () => mounted.drawn);
    const root = canvas.querySelector<HTMLElement>(`[${NATIVE_ROOT_ATTRIBUTE}]`);
    expect(root?.parentElement).toBe(canvas);
    expect(root?.style.display).toBe("flex");
    expect(root?.style.flexDirection).toBe("column");
    expect(root?.style.minHeight).toBe("inherit");
    expect(root?.querySelector('[data-testid="screen"]')?.textContent).toBe("Harbour");
    // the canvas stays as the frame made it
    expect(canvas.getAttribute("style")).toBeNull();
    expect(canvas.className).toBe("forgebook-frame");
    act(() => mounted.unmount());
    canvas.remove();
  });

  it("leaves a centred or padded story's root its content's height, so the canvas can centre it", async () => {
    for (const layout of ["centered", "padded"] as const) {
      const canvas = canvasOf(layout);
      const mounted = await act(async () =>
        nativeRenderer.mount(canvas, drawing(screenStory(layout), "Card"), () => undefined)
      );
      await act(async () => mounted.drawn);
      expect(canvas.querySelector<HTMLElement>(`[${NATIVE_ROOT_ATTRIBUTE}]`)?.style.minHeight).toBe("");
      act(() => mounted.unmount());
      canvas.remove();
    }
  });

  it("draws again with new args in the same root, and takes the root away with the story", async () => {
    const canvas = canvasOf("padded");
    const story = screenStory("padded");
    const mounted = await act(async () =>
      nativeRenderer.mount(canvas, drawing(story, "Before"), () => undefined)
    );
    await act(async () => mounted.drawn);
    await act(async () => mounted.update(drawing(story, "After")));
    expect(canvas.querySelectorAll(`[${NATIVE_ROOT_ATTRIBUTE}]`)).toHaveLength(1);
    expect(canvas.textContent).toBe("After");
    act(() => mounted.unmount());
    expect(canvas.childElementCount).toBe(0);
    canvas.remove();
  });

  it("writes a story as HTML on the server as React's renderer does, without a root of its own", async () => {
    const html = await nativeRenderer.renderToString(drawing(screenStory("padded"), "Server"));
    expect(html).toContain("Server");
    expect(html).not.toContain(NATIVE_ROOT_ATTRIBUTE);
  });
});
