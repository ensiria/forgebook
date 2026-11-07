/**
 * A story's second frame, for a plugin's tab: the story beside what the tab shows, as the stage has it now.
 *
 * @remarks
 * The tab answers this frame itself, with the panel's values and the view, and the stage leaves it alone
 * (`FRAME_ASIDE_ATTRIBUTE`), so the messages stay private to the shell.
 *
 * @module
 */
import { type AcceptedArgs, checkedArgsMessage } from "../addressArgs.ts";
import { isFrameMessage, type ShellMessage } from "../messages.ts";
import type { PluginStoryFrame } from "../plugin.ts";
import type { LiveView, StageWidth } from "../viewState.ts";
import { framesOrigin, isFromFrames, storyFrameAttributes } from "./framesOrigin.ts";
import { FRAME_ASIDE_ATTRIBUTE } from "./useFrameMessages.ts";

/** How the story is drawn again. */
export type AsideStory = {
  /** The frame's address, in the view shown. */
  readonly address: string;
  /** Its width on the stage. */
  readonly width: StageWidth;
  /** The colour its page has in the view; none without one. */
  readonly background: string | undefined;
  /**
   * The values the story accepted of the panel's, sent once it is ready; `undefined` while the check waits for the
   * story's docs, when the frame draws the story's own and `AsideFrame.settle` gives them.
   */
  readonly args: AcceptedArgs | undefined;
  /** The view's live part, sent once it is ready; none when the address already says it all (the compare view). */
  readonly view: LiveView | undefined;
};

/** A story's second frame, as the shell holds it. */
export type AsideFrame = PluginStoryFrame & {
  /**
   * Gives a frame drawn before the check ended the values it accepted; a frame that has them keeps them, since it shows
   * the panel's values of the moment it was asked for.
   *
   * @param args - the accepted values.
   */
  readonly settle: (args: AcceptedArgs) => void;
};

/**
 * Draws a story's second frame in an element.
 *
 * @param target - the element.
 * @param title - the frame's accessible name.
 * @param aside - how the story is drawn.
 * @returns what takes it away.
 */
export const showAsideStory = (target: HTMLElement, title: string, aside: AsideStory): AsideFrame => {
  const frame = target.ownerDocument.createElement("iframe");
  frame.title = title;
  // as the stage's frame: on the frames' own origin, with the features a story may use
  const { allow, sandbox } = storyFrameAttributes();
  frame.allow = allow;
  if (sandbox !== undefined) frame.setAttribute("sandbox", sandbox);
  frame.setAttribute(FRAME_ASIDE_ATTRIBUTE, "");
  // a width set on the stage holds as far as the room allows
  frame.style.cssText =
    "display:block;max-width:100%;height:100%;margin-inline:auto;border:0;color-scheme:light";
  frame.style.width = aside.width === "fill" ? "100%" : `${aside.width}px`;
  if (aside.background !== undefined) target.style.backgroundColor = aside.background;
  let args = aside.args;
  let isReady = false;
  const send = (message: ShellMessage): void => frame.contentWindow?.postMessage(message, framesOrigin());
  const answer = (event: MessageEvent): void => {
    const story = frame.contentWindow;
    if (!isFromFrames(event) || event.source !== story || story === null) return;
    if (!isFrameMessage(event.data)) return;
    if (event.data.type === "forgebook:scheme") frame.style.colorScheme = event.data.scheme;
    if (event.data.type !== "forgebook:ready") return;
    isReady = true;
    if (args !== undefined) send(checkedArgsMessage(args));
    if (aside.view !== undefined) send({ type: "forgebook:view", view: aside.view });
  };
  window.addEventListener("message", answer);
  frame.src = aside.address;
  target.append(frame);
  return {
    remove: (): void => {
      window.removeEventListener("message", answer);
      frame.remove();
    },
    settle: (accepted: AcceptedArgs): void => {
      if (args !== undefined) return;
      args = accepted;
      if (isReady) send(checkedArgsMessage(accepted));
    }
  };
};
