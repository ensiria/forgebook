/**
 * Forgebook's renderer for React Native in the browser: React's, each story drawn inside a root that lays out as
 * React Native's root view does.
 *
 * @remarks
 * On a phone every screen sits in a root view that is a flex column filling the window, so a screen written
 * `style={{ flex: 1 }}` fills it. A canvas of the frame is a plain block, where `flex: 1` means nothing and the screen
 * collapses to its content. The root is that column: the whole frame's height in a `fullscreen` story, its content's
 * height otherwise, so a `centered` story is still centred in its canvas. It is an element of the renderer's own inside the canvas, so the
 * frame's canvas stays as the frame made it.
 *
 * @module
 */
import { reactRenderer } from "@forgebook/react/renderer";
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";

/** The root's attribute, which the tests and a catalogue's style sheet can find it by. */
export const NATIVE_ROOT_ATTRIBUTE = "data-forgebook-native-root";

/**
 * A root for a story, as React Native's root view lays out: a flex column, as tall as the frame for a full-screen
 * story.
 *
 * @param canvas - the canvas it goes in.
 * @param layout - the story's layout.
 */
const nativeRoot = (canvas: HTMLElement, layout: StoryDrawing["story"]["layout"]): HTMLElement => {
  const root = canvas.ownerDocument.createElement("div");
  root.setAttribute(NATIVE_ROOT_ATTRIBUTE, "");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.flex = "1 1 auto";
  // a fullscreen canvas is as tall as the frame: the root takes that height for a screen's `flex: 1` to fill. Only
  // there: a centred canvas's own minimum is room to centre the story in, which the root must leave free
  if (layout === "fullscreen") root.style.minHeight = "inherit";
  canvas.append(root);
  return root;
};

/** React Native, through react-native-web, as the frame draws with it. */
export const nativeRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, drawing: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    const root = nativeRoot(canvas, drawing.story.layout);
    const mounted = reactRenderer.mount(root, drawing, onError);
    return {
      drawn: mounted.drawn,
      update: mounted.update,
      unmount: (): void => {
        mounted.unmount();
        root.remove();
      }
    };
  },
  renderToString: reactRenderer.renderToString
};
