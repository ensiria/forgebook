/**
 * A story's second frame, for a plugin's tab: the story beside what the tab shows, as the stage has it now.
 *
 * @remarks
 * The tab answers this frame itself, with the panel's values and the view, and the stage leaves it alone
 * (`FRAME_ASIDE_ATTRIBUTE`), so the messages stay private to the shell.
 *
 * @module
 */
import { isFrameMessage, type PanelArgs, type ShellMessage } from "../messages.ts";
import type { LiveView, StageWidth } from "../viewState.ts";
import { FRAME_ASIDE_ATTRIBUTE } from "./useFrameMessages.ts";

/** How the story is drawn again. */
export type AsideStory = {
  /** The frame's address, in the view shown. */
  readonly address: string;
  /** Its width on the stage. */
  readonly width: StageWidth;
  /** The colour its page has in the view; none without one. */
  readonly background: string | undefined;
  /** The values set in the panel, sent once it is ready. */
  readonly args: PanelArgs;
  /** The view's live part, sent once it is ready; none when the address already says it all (the compare view). */
  readonly view: LiveView | undefined;
};

/**
 * Draws a story's second frame in an element.
 *
 * @param target - the element.
 * @param title - the frame's accessible name.
 * @param aside - how the story is drawn.
 * @returns what takes the frame away.
 */
export const showAsideStory = (target: HTMLElement, title: string, aside: AsideStory): (() => void) => {
  const frame = target.ownerDocument.createElement("iframe");
  frame.title = title;
  frame.setAttribute(FRAME_ASIDE_ATTRIBUTE, "");
  // a width set on the stage holds as far as the room allows
  frame.style.cssText = "display:block;max-width:100%;height:100%;margin-inline:auto;border:0";
  frame.style.width = aside.width === "fill" ? "100%" : `${aside.width}px`;
  if (aside.background !== undefined) target.style.backgroundColor = aside.background;
  const answer = (event: MessageEvent): void => {
    const story = frame.contentWindow;
    if (event.origin !== window.location.origin || event.source !== story || story === null) return;
    if (!isFrameMessage(event.data) || event.data.type !== "forgebook:ready") return;
    const send = (message: ShellMessage): void => story.postMessage(message, window.location.origin);
    send({ type: "forgebook:args", args: aside.args });
    if (aside.view !== undefined) send({ type: "forgebook:view", view: aside.view });
  };
  window.addEventListener("message", answer);
  frame.src = aside.address;
  target.append(frame);
  return (): void => {
    window.removeEventListener("message", answer);
    frame.remove();
  };
};
