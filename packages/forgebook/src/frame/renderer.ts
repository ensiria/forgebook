/**
 * The contract between Forgebook and a framework: how the frame draws one story in one canvas, draws it again with
 * other args and takes it away, and how the shell writes a story drawn from its args as code.
 *
 * @remarks
 * The frame owns everything a framework does not need to know: the address and the view, the messages with the shell,
 * the style sheets, the play function, Replay, the matrix's layout, the story clock and the error shown in place of a
 * story. A framework package (`@forgebook/react`) implements `StoryRenderer` and hands the frame its drawing part
 * (`FrameRenderer`); another framework implements the same types. A story's decorators, providers and error capture are
 * the framework's, since they return or catch the framework's own output.
 *
 * @module
 */

import type { StoryClock } from "@forgebook/story-format/clock";
import type { StepFunction, StoryContext } from "@forgebook/story-format/csf";
import { type StoryTextTable, storyTextOf } from "@forgebook/story-format/texts";

import type { PanelArgs } from "../messages.ts";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "./storyModule.ts";

/** Which story is drawn: its id, its name and its file's title, as its context gives them. */
export type StoryIdentity = Pick<StoryContext<LoadedArgs>, "id" | "name" | "title">;

/**
 * A change a story makes to its own args while it is drawn (Storybook's `useArgs`): the names reset to the story's
 * own values first, then the values set.
 */
export type ArgsChange = {
  /** The names whose values go back to the story's own, or every name. */
  readonly reset: readonly string[] | "all";
  /** The values set, by name. */
  readonly set: Readonly<Record<string, unknown>>;
};

/** One story to draw, as the frame hands it to the framework. */
export type StoryDrawing = {
  /** Which story it is. */
  readonly identity: StoryIdentity;
  /** The story: its render or component, its decorators, its layout. */
  readonly story: LoadedStory;
  /** The args as the story receives them: the texts named by key resolved, the recorded events wrapped. */
  readonly args: LoadedArgs;
  /** The texts inside the stories in the shown language, for the story's `text` and its text hooks. */
  readonly texts: StoryTextTable;
  /** The story clock the story reads (held at its start, or running for a Live story). */
  readonly clock: StoryClock;
  /**
   * The catalogue's decorators (its preview's), outside the meta's and the story's own: the providers every story
   * is drawn in, the language's among them (it reads `context.globals.lang`).
   */
  readonly decorators: readonly LoadedDecorator[];
  /** The values of the switches applied by code, by id: the story's `context.globals`. */
  readonly globals: Readonly<Record<string, string>>;
  /** What the story's loaders returned: its `context.loaded`. */
  readonly loaded: Readonly<Record<string, unknown>>;
  /**
   * Lists a call among the story's events, beside its args' handlers: a call a framework's mock receives (a router's
   * `push`), by name, with what it was called with. None outside a catalogue (a test's server render).
   */
  readonly onEvent?: (name: string, values: readonly unknown[]) => void;
  /**
   * Changes the story's args from its own code, as the panel would: the story is drawn again with them and the panel
   * shows them. None where nothing takes them (a test's server render): a change there changes nothing.
   */
  readonly changeArgs?: (change: ArgsChange) => void;
};

/**
 * What a framework can say of what a drawn story still waits for: everything came, something is still loading (a
 * `Suspense` boundary showing its fallback), or it cannot tell, which is never read as everything came.
 */
export type ContentState =
  | { readonly state: "settled" }
  | {
      readonly state: "waiting" | "unknown";
      /** What it waits for, or why it cannot tell, in a sentence a person reads. */
      readonly reason: string;
    };

/** What the frame keeps of a story drawn in a canvas. */
export type MountedStory = {
  /**
   * Resolves once the story is drawn in its canvas, so the play function finds what it drives; never resolves when the
   * story throws while it is first drawn (the error goes to `onError` instead).
   */
  readonly drawn: Promise<void>;
  /**
   * Waits until the story no longer shows a loading state of its framework (`Suspense`), for so long, in milliseconds.
   * The frame calls it after `drawn` and after the play function, unless the story says it stays there
   * (`parameters.suspense.expected`). A framework with no such state, or none it can read, leaves it out: its stories
   * are ready once drawn.
   *
   * @param timeout - the most to wait, in milliseconds.
   * @returns `settled`, `waiting` when the time ran out, or `unknown` when the framework cannot tell; a rejection reads as
   *   `unknown`.
   */
  readonly settled?: (timeout: number) => Promise<ContentState>;
  /**
   * Draws the story again, keeping its state: other args, other switch values, another language; a story that threw
   * is tried again.
   */
  readonly update: (drawing: StoryDrawing) => void;
  /** Takes the story away from its canvas. */
  readonly unmount: () => void;
};

/**
 * A framework, as the frame uses it: it only draws. The frame takes this rather than a whole `StoryRenderer`, so a
 * framework's frame page can leave its server renderer out: a static catalogue would ship it (some 200 kB for React's)
 * and a first start would pre-bundle it, for a page that never runs it.
 */
export type FrameRenderer = {
  /**
   * Draws a story in a canvas the frame owns.
   *
   * @param canvas - the element the story is drawn in.
   * @param drawing - the story, its args, texts, clock and language.
   * @param onError - called with the error when the story throws while it is drawn; the frame shows it instead, until
   *   the next `update`. Only the latest drawing's error is reported: one of a drawing an `update` replaced while it was
   *   under way would stand over the story drawn after it.
   */
  readonly mount: (
    canvas: HTMLElement,
    drawing: StoryDrawing,
    onError: (error: Error) => void
  ) => MountedStory;
};

/** A framework, as the frame draws with it and the generated server tests render with it. */
export type StoryRenderer = FrameRenderer & {
  /**
   * The story drawn as HTML on the server, for the generated server tests; throws, or rejects, when the story throws.
   * A framework whose server render is asynchronous returns a promise (Vue's waits for what `setup` awaits).
   *
   * @param drawing - the story, its args, texts, clock and language.
   */
  readonly renderToString: (drawing: StoryDrawing) => Promise<string> | string;
};

/**
 * Writes a story drawn from its args as the framework's code, for the Code tab and Show code (`<Button tone="danger" />`
 * in React): the shell knows the component's name and the panel's values, and the framework knows its syntax.
 *
 * @param component - the component's name, as its documentation names it.
 * @param args - the values of the moment, a named value by its name.
 */
export type StoryCodeWriter = (component: string, args: PanelArgs) => string;

/** The longest pause between two looks at what a story waits for, in milliseconds. */
const LONGEST_LOOK = 50;

/**
 * Waits for what a story waits for by looking at it: the first look is at once, so a story that waits for nothing pays
 * for one look; the next ones start close together, since most waits are a state set in an effect, and spread out.
 *
 * @param read - looks at the story: what `MountedStory.settled` answers at this moment.
 * @param timeout - the most to wait, in milliseconds.
 * @returns the state once it is not `waiting`, or `waiting` once the time ran out.
 */
export const contentSettled = (read: () => ContentState, timeout: number): Promise<ContentState> =>
  new Promise((resolve) => {
    const start = performance.now();
    let pause = 1;
    const look = (): void => {
      const content = read();
      if (content.state !== "waiting" || performance.now() - start >= timeout) {
        resolve(content);
        return;
      }
      setTimeout(look, pause);
      pause = Math.min(pause * 2, LONGEST_LOOK);
    };
    look();
  });

/** The `step` a render and a decorator receive: outside a play there is no trace, so a step only runs its part. */
export const untracedStep: StepFunction = async (
  _label: string,
  run: () => Promise<void> | void
): Promise<void> => {
  await run();
};

/**
 * What a render and a decorator receive.
 *
 * @param drawing - the story's texts, clock and switches' values.
 * @param args - the args they read: a framework may hand reactive ones.
 * @param canvasOf - the element the story is drawn in, read only when a story asks for it: on the server there is
 *   none, and a story that reads it there fails as it would in a page rendered on the server.
 */
export const storyContextOf = (
  drawing: StoryDrawing,
  args: LoadedArgs,
  canvasOf: () => HTMLElement
): StoryContext<LoadedArgs> => ({
  args,
  step: untracedStep,
  text: storyTextOf(drawing.texts),
  clock: drawing.clock,
  globals: drawing.globals,
  loaded: drawing.loaded,
  ...drawing.identity,
  parameters: drawing.story.parameters,
  get canvasElement(): HTMLElement {
    return canvasOf();
  }
});
