/**
 * What the frames tell the shell: which story can replay, which reads the story clock, each frame's content height, which frames finished loading, its story's own args, the
 * calls of its events, its play function's trace, and the result of an accessibility check.
 *
 * @module
 */
import { useEffect, useRef, useState } from "react";

import type { Violation } from "../a11y.ts";
import { type FrameMessage, isFrameMessage } from "../messages.ts";
import type { PlayTrace } from "../playTrace.ts";

/**
 * Marks a frame shown beside the page's own, which answers it itself: a story's second frame reporting here would
 * replace the stage's play trace and add to its spills and its calls, though it runs at another size.
 */
export const FRAME_ASIDE_ATTRIBUTE = "data-forgebook-aside";

/** A message of a frame that the stage answers. */
export type ReadyMessage = Extract<FrameMessage, { type: "forgebook:ready" }>;

/** A call of an event, as the log shows it. */
export type EventCall = Omit<Extract<FrameMessage, { type: "forgebook:call" }>, "type"> & {
  /** When it arrived, in ms since the epoch. */
  readonly time: number;
};

/** What the frames have reported. */
export type FrameReports = {
  /** The id of the last story that said it can replay. */
  readonly replayable: string | undefined;
  /** The id of the last story that said it reads the story clock (a Live story). */
  readonly clocked: string | undefined;
  /** Each frame's content height in CSS px, by its address. */
  readonly heights: ReadonlyMap<string, number>;
  /** The addresses of the frames that finished loading: their story is shown, or why it could not be. */
  readonly settled: ReadonlySet<string>;
};

/** What the stage does when a frame reports. */
export type FrameHandlers = {
  /** A frame rendered its story: the stage sends it the panel's values and the events to record. */
  readonly onReady: (frame: Window, message: ReadyMessage) => void;
  /** An event was called. */
  readonly onCall: (call: EventCall) => void;
  /** A frame could not show its story, and why; none where nothing waits for it. */
  readonly onFailed?: (storyId: string, message: string) => void;
  /** A story's play function reported its trace; none where nothing shows it. */
  readonly onPlay?: (storyId: string, trace: PlayTrace) => void;
  /** An accessibility check is over: the rules broken, or why it could not run; none where nothing asks for one. */
  readonly onChecked?: (result: CheckResult) => void;
  /**
   * A frame measured its spills again (while the stage asks for them), with the frame's address (the compare view has
   * several frames of a story); none where nothing shows them.
   */
  readonly onSpills?: (storyId: string, count: number, frame: string) => void;
};

/** An accessibility check's result, as a frame reported it. */
export type CheckResult =
  | { readonly storyId: string; readonly violations: readonly Violation[] }
  | { readonly storyId: string; readonly error: string };

/** The frame element a message came from. */
const frameOf = (source: MessageEventSource | null): HTMLIFrameElement | undefined =>
  source === null
    ? undefined
    : [...document.querySelectorAll("iframe")].find((element) => element.contentWindow === source);

/** What a frame's message changes in the shell. */
type MessageTargets = {
  /** The handlers of the stage. */
  readonly handlers: FrameHandlers;
  /** Records a story that can replay. */
  readonly setReplayable: (storyId: string) => void;
  /** Records a story that reads the story clock. */
  readonly setClocked: (storyId: string) => void;
  /** Records a frame's height, by its address. */
  readonly setHeight: (address: string, height: number) => void;
  /** Records a frame that finished loading, by its address. */
  readonly markSettled: (address: string) => void;
};

/** Whether a message ends a frame's loading: its story is shown, or why it could not be. */
const isSettling = (message: FrameMessage): boolean =>
  message.type === "forgebook:ready" || message.type === "forgebook:error";

/** Acts on one message of a frame. */
const onFrameMessage = (
  message: FrameMessage,
  frame: HTMLIFrameElement | undefined,
  targets: MessageTargets
): void => {
  const address = frame?.getAttribute("src") ?? undefined;
  if (isSettling(message) && address !== undefined) targets.markSettled(address);
  const { handlers } = targets;
  switch (message.type) {
    case "forgebook:ready":
      if (message.canReplay) targets.setReplayable(message.storyId);
      if (message.hasClock) targets.setClocked(message.storyId);
      if (frame?.contentWindow) handlers.onReady(frame.contentWindow, message);
      return;
    case "forgebook:size":
      if (address !== undefined) targets.setHeight(address, message.height);
      return;
    case "forgebook:error":
      handlers.onFailed?.(message.storyId, message.message);
      return;
    case "forgebook:play":
      handlers.onPlay?.(message.storyId, message.trace);
      return;
    case "forgebook:checked":
      handlers.onChecked?.({ storyId: message.storyId, violations: message.violations });
      return;
    case "forgebook:check-error":
      handlers.onChecked?.({ storyId: message.storyId, error: message.message });
      return;
    case "forgebook:spills":
      handlers.onSpills?.(message.storyId, message.count, address ?? "");
      return;
    case "forgebook:call":
      handlers.onCall({
        storyId: message.storyId,
        name: message.name,
        values: message.values,
        details: message.details,
        time: Date.now()
      });
      return;
    default:
      return;
  }
};

/**
 * Listens to the frames of the page.
 *
 * @param handlers - what to do when a frame is ready or an event is called.
 * @returns what they reported.
 */
export const useFrameMessages = (handlers: FrameHandlers): FrameReports => {
  const [replayable, setReplayable] = useState<string | undefined>(undefined);
  const [clocked, setClocked] = useState<string | undefined>(undefined);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  // the latest handlers, without listening again on every render
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const listen = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin || !isFrameMessage(event.data)) return;
      const frame = frameOf(event.source);
      if (frame?.hasAttribute(FRAME_ASIDE_ATTRIBUTE)) return;
      onFrameMessage(event.data, frame, {
        handlers: handlersRef.current,
        setReplayable,
        setClocked,
        setHeight: (address: string, height: number): void =>
          setHeights((current) => new Map(current).set(address, height)),
        markSettled: (address: string): void =>
          setSettled((current) => (current.has(address) ? current : new Set(current).add(address)))
      });
    };
    window.addEventListener("message", listen);
    return (): void => window.removeEventListener("message", listen);
  }, []);

  return { replayable, clocked, heights, settled };
};
