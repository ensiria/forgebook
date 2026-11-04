/**
 * A story's frame as the shell shows it, as tall as its story (or the room its scene declares) and showing that it loads until it is ready, and how the shell talks to the frames of a page: the
 * story page and the component page use both.
 *
 * @module
 */
import type { ReactNode, Ref } from "react";

import type { ShellMessage } from "../messages.ts";
import { framesOrigin, storyFrameAttributes } from "./framesOrigin.ts";
import { STRINGS } from "./strings.ts";

/** The frame view's props. */
export type FrameViewProps = {
  /** The frame's accessible title. */
  readonly title: string;
  /** The frame's address. */
  readonly address: string;
  /** Each frame's reported height, by its address. */
  readonly heights: ReadonlyMap<string, number>;
  /** The height until the frame reports its own, in CSS px. */
  readonly fallbackHeight: number;
  /**
   * The height the story's scene needs (its `parameters.height`), in CSS px: the frame is never shorter, from the
   * start, so the window an overlay is placed in has that room while the story's document stays as tall as its
   * content. None by default.
   */
  readonly sceneHeight?: number | undefined;
  /**
   * A height set on the stage (the foot handle), in CSS px: the frame takes it whatever its story's;
   * none by default.
   */
  readonly fixedHeight?: number | undefined;
  /** The addresses of the frames that finished loading: until its own is there, the frame shows that it loads. */
  readonly settled: ReadonlySet<string>;
  /** The iframe. */
  readonly ref?: Ref<HTMLIFrameElement>;
};

/**
 * A story's frame, as tall as its story.
 *
 * @param props - the frame's title, address, the reported heights, the height until its own arrives, and the frames
 * that finished loading.
 */
export const FrameView = ({
  title,
  address,
  heights,
  fallbackHeight,
  settled,
  sceneHeight = 0,
  fixedHeight,
  ref
}: FrameViewProps): ReactNode => {
  const isLoading = !settled.has(address);
  // while it loads, an empty document reports a height of nothing: the box keeps its waiting height until the story
  // is there, then takes the story's
  const reported = heights.get(address);
  const contentHeight = isLoading ? Math.max(reported ?? 0, fallbackHeight) : (reported ?? fallbackHeight);
  const height = fixedHeight ?? Math.max(contentHeight, sceneHeight);
  return (
    <div className="forgebook-frame-box" data-loading={isLoading ? "" : undefined}>
      <iframe
        ref={ref}
        className="forgebook-frame-view"
        title={title}
        src={address}
        {...storyFrameAttributes()}
        style={{ height }}
      />
      {/* a story's modules may take seconds the first time: an empty frame would look broken */}
      {isLoading ? (
        <div className="forgebook-frame-loading" role="status">
          <span className="forgebook-frame-loading__label">
            <span className="forgebook-spinner" aria-hidden="true" />
            {STRINGS.loadingStory}
          </span>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Sends a message to every frame inside an element.
 *
 * @param container - the element that holds the frames.
 * @param message - the message.
 */
export const tellFrames = (container: HTMLElement | null, message: ShellMessage): void => {
  for (const frame of container?.querySelectorAll("iframe") ?? []) {
    frame.contentWindow?.postMessage(message, framesOrigin());
  }
};

/**
 * Sends each frame inside an element its own message, made from the story it shows.
 *
 * @param container - the element that holds the frames.
 * @param messageOf - the message for a frame's story (the address's `story`; none when it names none).
 */
export const tellEachFrame = (
  container: HTMLElement | null,
  messageOf: (storyId: string | undefined) => ShellMessage
): void => {
  for (const frame of container?.querySelectorAll("iframe") ?? []) {
    const storyId = new URL(frame.src, window.location.href).searchParams.get("story") ?? undefined;
    frame.contentWindow?.postMessage(messageOf(storyId), framesOrigin());
  }
};
