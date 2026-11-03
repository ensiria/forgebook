/**
 * The frames of a page of many stories, a component's or a docs page: which may load, the view they load with and
 * follow, and what they report.
 *
 * @module
 */
import { type RefObject, useCallback, useMemo, useState } from "react";

import type { PanelArgs, ShellMessage } from "../messages.ts";
import type { TreeStory } from "../storyTree.ts";
import { liveView, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { framesOrigin } from "./framesOrigin.ts";
import {
  phoneStories,
  type StoryTouches,
  storyTouchesOf,
  type TouchOverrides,
  touchedView
} from "./storyTouch.ts";
import { type ReadyMessage, useFrameMessages } from "./useFrameMessages.ts";
import { type FrameQueue, useFrameQueue } from "./useFrameQueue.ts";
import { useLiveView, useLoadedView } from "./useLiveView.ts";

/** What a page gives to reach its frames. */
export type PageFramesInput = {
  /** The page's stories, for their fingers. */
  readonly stories: readonly TreeStory[];
  /** What loads as it comes near, in the page's order. */
  readonly queued: readonly string[];
  /** The element that scrolls the page and holds its frames. */
  readonly pageRef: RefObject<HTMLElement | null>;
  /** The view. */
  readonly view: ViewState;
  /** What the user chose for each story marked for a phone. */
  readonly touchOverrides: TouchOverrides;
};

/** What a page's examples read of its frames. */
export type PageFrames = {
  /** Which frames may load. */
  readonly queue: FrameQueue;
  /** The view the frames loaded with. */
  readonly frameView: ViewState;
  /** The stories marked for a phone, each with its own finger. */
  readonly touches: StoryTouches;
  /** Each frame's reported height, by its address. */
  readonly heights: ReadonlyMap<string, number>;
  /** The addresses of the frames that finished loading. */
  readonly settled: ReadonlySet<string>;
  /** A story's own args, as its frame reported them; none before it loads. */
  readonly argsOf: (storyId: string) => PanelArgs;
};

/**
 * The frames of a page.
 *
 * @param input - the page's stories, what it queues, its scrolling element, the view and the fingers chosen.
 */
export const usePageFrames = ({
  stories,
  queued,
  pageRef,
  view,
  touchOverrides
}: PageFramesInput): PageFrames => {
  // each story's own args, as its frame reports them: the code of a story drawn from its args is written from them
  const [storyArgs, setStoryArgs] = useState<ReadonlyMap<string, PanelArgs>>(new Map());
  // the frames keep the view they loaded with; only the style sheets load them again, the rest of the view (the
  // switches, the language among them) is sent to them live
  const frameView = useLoadedView(view.sheets, view);
  const catalogue = useCatalogue();
  // each story meant for a phone (marked so, or shown in a device touched with a finger) with its own finger: its frame
  // gets it in place of the toolbar's Touch
  const { device, orientation } = view;
  const touches = useMemo(
    () => storyTouchesOf(stories, touchOverrides, phoneStories({ device, orientation }, catalogue.device)),
    [stories, touchOverrides, device, orientation, catalogue.device]
  );
  const queue = useFrameQueue(queued, pageRef);
  const { heights, settled } = useFrameMessages({
    onReady: (frame: Window, message: ReadyMessage): void => {
      queue.markReady(message.storyId);
      setStoryArgs((current) => new Map(current).set(message.storyId, message.args));
      const send = (shellMessage: ShellMessage): void => frame.postMessage(shellMessage, framesOrigin());
      send({
        type: "forgebook:view",
        view: touchedView(liveView(view), message.storyId, touches, catalogue.touch)
      });
      send({ type: "forgebook:tools", tools: view.tools });
    },
    onCall: (): void => undefined,
    // a frame that failed is over too: its place in the queue goes to the next one
    onFailed: queue.markReady
  });
  useLiveView(pageRef, view, true, { touches, choice: catalogue.touch });
  const argsOf = useCallback((storyId: string): PanelArgs => storyArgs.get(storyId) ?? {}, [storyArgs]);
  return { queue, frameView, touches, heights, settled, argsOf };
};
