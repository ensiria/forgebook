/**
 * One story rendered in its frame: args, decorators, forced states, layout, the play function, Replay, and the story
 * clock a Live story reads (D-504).
 *
 * @module
 */

import { StoryClockContext, useStoryClock } from "@ensiria/story-format/clock";
import type { StoryContext } from "@ensiria/story-format/csf";
import {
  StoryTextsContext,
  type StoryTextTable,
  storyTextOf,
  useStoryText
} from "@ensiria/story-format/texts";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Matrix } from "../matrix";
import type { PanelArgs } from "../messages";
import type { PlayTrace } from "../playTrace";
import type { ClockState } from "../storyClock";
import { withStoryTexts } from "../storyTexts";
import type { FrameClock } from "./frameClock";
import { playStory } from "./playStory";
import { StoryErrorBoundary } from "./StoryErrorBoundary";
import { StoryMatrix } from "./StoryMatrix";
import { animationsSettled } from "./settle";
import { forcedAttribute, storyElement, untracedStep } from "./storyElement";
import type { LoadedArgs, LoadedStory } from "./storyModule";

/** What the shell can do to a rendered story. */
export type StoryControls = {
  /** Replays the story, as it declares. */
  readonly replay: () => Promise<void>;
  /** Sets the props panel's values over the story's own args. */
  readonly setPanelArgs: (args: PanelArgs) => void;
  /** Records the calls of these events. */
  readonly setEvents: (names: readonly string[]) => void;
  /** Draws the story once per value of the matrix's axes; none draws it alone. */
  readonly setMatrix: (matrix: Matrix | undefined) => void;
  /** Mounts the story again, so its play function runs again. */
  readonly playAgain: () => void;
  /** Sets whether the story clock runs, and how fast. */
  readonly setClock: (state: ClockState) => void;
  /**
   * Brings the story clock back to its start and mounts the story again, so its own state starts over too and its
   * play function runs again (D-629).
   */
  readonly restartClock: () => void;
};

/** The frame's props. */
export type StoryFrameProps = {
  /** The story to render. */
  readonly story: LoadedStory;
  /** The story clock the story reads: running from its start for a Live story, held otherwise. */
  readonly clock: FrameClock;
  /**
   * Called with the controls once the story rendered and its play function is over (the frame's ready status waits
   * for it, so no check reads a half-played story); the frame uses them when the shell asks.
   */
  readonly onControlsReady: (controls: StoryControls) => void;
  /** Called on every call of a recorded event, with its arguments. */
  readonly onEvent: (name: string, values: readonly unknown[]) => void;
  /** Called with the message when the story throws while it renders; the frame shows the error instead. */
  readonly onError: (message: string) => void;
  /** Called with the play function's trace after every change. */
  readonly onTrace: (trace: PlayTrace) => void;
  /** The texts inside the stories in the shown language; none by default (every text then shows its key). */
  readonly texts?: StoryTextTable;
  /** The panel's values as the story takes them (a named value turned back into the value); as they are by default. */
  readonly resolveArgs?: (args: PanelArgs) => Readonly<Record<string, unknown>>;
};

/**
 * The story's root, mounted again by Replay: its play function runs once per mount, like a test, not on every change
 * of the args.
 *
 * @param props - the story and its current args.
 */
const StoryRoot = ({
  story,
  args,
  onPlayed,
  onTrace
}: {
  readonly story: LoadedStory;
  readonly args: LoadedArgs;
  readonly onPlayed: () => void;
  readonly onTrace: (trace: PlayTrace) => void;
}): ReactNode => {
  const rootRef = useRef<HTMLDivElement>(null);
  // the play function reads the args of the moment it runs
  const argsRef = useRef(args);
  argsRef.current = args;
  const { play } = story;
  // the texts of the shown language, from the frame's provider
  const text = useStoryText();
  const textRef = useRef(text);
  textRef.current = text;
  const clock = useStoryClock();

  const playedRef = useRef(onPlayed);
  playedRef.current = onPlayed;
  const traceRef = useRef(onTrace);
  traceRef.current = onTrace;

  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    // a failed play still ends the wait; its rejection reaches the page as an error the tests record
    void playStory(
      play,
      { args: argsRef.current, canvasElement: element, text: textRef.current, clock },
      () => playedRef.current(),
      (trace: PlayTrace) => traceRef.current(trace)
    );
  }, [play, clock]);

  // read only when a story asks for it: rendering on the server has no document
  const context: StoryContext<LoadedArgs> = {
    args,
    step: untracedStep,
    text,
    clock,
    get canvasElement(): HTMLElement {
      return rootRef.current ?? document.body;
    }
  };
  return (
    <div ref={rootRef} className="forgebook-frame" data-layout={story.layout} {...forcedAttribute(story)}>
      {storyElement(story, context)}
    </div>
  );
};

/** No texts: a source without locale files. */
const NO_TEXTS: StoryTextTable = {};

/** The panel's values as they are: a source without named values. */
const argsAsTheyAre = (args: PanelArgs): Readonly<Record<string, unknown>> => args;

/**
 * A story in its frame.
 *
 * @param props - the story, its clock and the Replay hook.
 */
export const StoryFrame = ({
  story,
  clock,
  onControlsReady,
  onEvent,
  onError,
  onTrace,
  resolveArgs = argsAsTheyAre,
  texts = NO_TEXTS
}: StoryFrameProps): ReactNode => {
  const [args, setArgs] = useState<LoadedArgs>(story.args);
  const [mountKey, setMountKey] = useState(0);
  const [eventNames, setEventNames] = useState<readonly string[]>([]);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [matrix, setMatrix] = useState<Matrix | undefined>(undefined);
  const markPlayed = useCallback((): void => setHasPlayed(true), []);

  const replay = useCallback(async (): Promise<void> => {
    const mode = story.replay;
    if (mode === undefined) return;
    if (mode === "remount") {
      setMountKey((key) => key + 1);
      return;
    }
    // an exit and an entrance: the arg goes false, the exit plays to its end, it stays false for the hold, then it
    // comes back
    setArgs((current) => ({ ...current, [mode.toggle]: false }));
    await animationsSettled(document);
    if (mode.hold !== undefined) await new Promise((resolve) => window.setTimeout(resolve, mode.hold));
    setArgs((current) => ({ ...current, [mode.toggle]: true }));
  }, [story.replay]);

  useEffect(() => {
    if (!hasPlayed) return;
    onControlsReady({
      replay,
      setPanelArgs: (panelArgs: PanelArgs): void => setArgs({ ...story.args, ...resolveArgs(panelArgs) }),
      setEvents: setEventNames,
      setMatrix,
      playAgain: (): void => setMountKey((key) => key + 1),
      setClock: clock.setState,
      restartClock: (): void => {
        clock.restart();
        setMountKey((key) => key + 1);
      }
    });
  }, [hasPlayed, onControlsReady, replay, story.args, resolveArgs, clock]);

  // every recorded event reports its calls, then runs the story's own handler when it has one
  const recorded = useMemo(
    () =>
      Object.fromEntries(
        eventNames.map((name) => {
          const own = args[name];
          return [
            name,
            (...values: unknown[]): unknown => {
              onEvent(name, values);
              return typeof own === "function" ? own(...values) : undefined;
            }
          ];
        })
      ),
    [eventNames, args, onEvent]
  );

  // an arg written `storyText("key")` reaches the story as the text of the shown language
  const shownArgs = useMemo(
    () => ({ ...withStoryTexts(args, storyTextOf(texts)), ...recorded }),
    [args, texts, recorded]
  );

  // new args or a new mount (the panel, Replay) render the story again: a value that made it throw can be changed back
  const errorResetKey = useMemo(() => ({ args, mountKey, matrix }), [args, mountKey, matrix]);
  return (
    <StoryTextsContext.Provider value={texts}>
      <StoryClockContext.Provider value={clock}>
        <StoryErrorBoundary resetKey={errorResetKey} onError={onError}>
          {matrix === undefined ? (
            <StoryRoot
              key={mountKey}
              story={story}
              args={shownArgs}
              onPlayed={markPlayed}
              onTrace={onTrace}
            />
          ) : (
            <StoryMatrix story={story} args={shownArgs} matrix={matrix} />
          )}
        </StoryErrorBoundary>
      </StoryClockContext.Provider>
    </StoryTextsContext.Provider>
  );
};
