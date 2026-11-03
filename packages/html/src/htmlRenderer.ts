/**
 * Forgebook's renderer for plain HTML: draws a story's HTML string or DOM node in a canvas, inside the catalogue's
 * decorators, draws it again when its args change, and hands the frame what the story throws.
 *
 * @remarks
 * The frame runs everything else the same for every framework (`forgebook/renderer`): the play function, Replay, the
 * matrix, the error shown in place of the story.
 *
 * Drawing again calls the story again. A text is laid over what the canvas shows (`morph.ts`), so the elements that
 * stay keep their focus, what was typed in them and their own state, as the panel changes the args. A node is placed
 * as it is, replacing what was shown, unless it is the node already shown: a story that keeps its node and changes it
 * keeps everything. The story clock's ticks draw again, so a story that reads `context.clock` follows it.
 *
 * Errors come two ways: a render, a function or a decorator throws while it is called; a custom element throws in a
 * callback the browser runs while the HTML is placed, which the browser reports as a page error rather than throwing.
 * Either way the canvas is emptied, and the story is drawn anew on the next change.
 *
 * On a server the story's text is its HTML, and a node's `outerHTML` is: a story that builds nodes needs a DOM there
 * (a simulated one in the tests), and one that writes HTML needs none.
 *
 * @module
 */
import type { MountedStory, StoryDrawing, StoryRenderer } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";

import { morphHtml } from "./morph.ts";
import { type StoryResult, storyContent } from "./storyContent.ts";

/** An error as the frame takes it. */
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Places what a story drew in its canvas.
 *
 * @param canvas - the canvas.
 * @param result - the HTML, laid over what is shown, or the node, placed unless it is shown already.
 */
const place = (canvas: HTMLElement, result: StoryResult): void => {
  if (typeof result === "string") morphHtml(canvas, result);
  else if (canvas.childNodes.length !== 1 || canvas.firstChild !== result) canvas.replaceChildren(result);
};

/** A text between tags, written so that it stays text. */
const escapedText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A node as HTML: an element's `outerHTML`, a fragment's children, a text escaped, a comment as one.
 *
 * @param node - the node a story drew.
 */
const nodeHtml = (node: Node): string => {
  if (node instanceof Element) return node.outerHTML;
  if (node.nodeType === Node.TEXT_NODE) return escapedText(node.textContent ?? "");
  if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.textContent ?? ""}-->`;
  return [...node.childNodes].map(nodeHtml).join("");
};

/** The canvas a story asks for on a server, where there is none. */
const noCanvas = (): HTMLElement => {
  throw new Error("A story drawn on a server has no canvas: read context.canvasElement in play only");
};

/** Plain HTML as the frame draws it. */
export const htmlRenderer: StoryRenderer = {
  mount: (canvas: HTMLElement, first: StoryDrawing, onError: (error: Error) => void): MountedStory => {
    let current = first;
    let hasFailed = false;
    let isMounted = true;
    let markDrawn = (): void => undefined;
    const drawn = new Promise<void>((resolve) => {
      markDrawn = resolve;
    });
    let stopClock = (): void => undefined;

    const fail = (error: unknown): void => {
      if (!hasFailed) onError(toError(error));
      hasFailed = true;
      canvas.replaceChildren();
    };

    const draw = (): void => {
      if (!isMounted) return;
      const context = storyContextOf(current, current.args, () => canvas);
      // what a custom element throws in a callback the browser runs while the HTML is placed is reported, not thrown
      let reported: unknown;
      const onPageError = (event: ErrorEvent): void => {
        reported ??= event.error ?? new Error(event.message);
      };
      const view = canvas.ownerDocument.defaultView;
      view?.addEventListener("error", onPageError);
      try {
        place(canvas, storyContent(current.story, context, current.decorators));
      } catch (error) {
        fail(error);
        return;
      } finally {
        view?.removeEventListener("error", onPageError);
      }
      if (reported !== undefined) {
        fail(reported);
        return;
      }
      if (!hasFailed) markDrawn();
    };

    const followClock = (): void => {
      stopClock();
      stopClock = current.clock.subscribe(() => {
        if (!hasFailed) draw();
      });
    };

    followClock();
    draw();
    return {
      drawn,
      update: (next: StoryDrawing): void => {
        const isNewClock = next.clock !== current.clock;
        current = next;
        if (isNewClock) followClock();
        hasFailed = false;
        draw();
      },
      unmount: (): void => {
        isMounted = false;
        stopClock();
        canvas.replaceChildren();
      }
    };
  },
  renderToString: (drawing: StoryDrawing): string => {
    const context = storyContextOf(drawing, drawing.args, noCanvas);
    const result = storyContent(drawing.story, context, drawing.decorators);
    return typeof result === "string" ? result : nodeHtml(result);
  }
};
