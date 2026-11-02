/**
 * The contract between Forgebook and a framework: how the frame draws one story in one canvas, draws it again with
 * other args and takes it away, and how the shell writes a story drawn from its args as code.
 *
 * @remarks
 * The frame owns everything a framework does not need to know: the address and the view, the messages with the
 * shell, the style sheets, the play function, Replay, the matrix's layout, the story clock and the error shown in
 * place of a story. A framework package (`@forgebook/react`) implements this type and hands it to the frame; another
 * framework implements the same type. A story's decorators, providers and error capture are the framework's, since
 * they return or catch the framework's own output.
 *
 * @module
 */

import type { StoryClock } from "@forgebook/story-format/clock";
import type { StepFunction, StoryContext } from "@forgebook/story-format/csf";
import type { StoryTextTable } from "@forgebook/story-format/texts";

import type { PanelArgs } from "../messages.ts";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "./storyModule.ts";

/** Which story is drawn: its id, its name and its file's title, as its context gives them. */
export type StoryIdentity = Pick<StoryContext<LoadedArgs>, "id" | "name" | "title">;

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
  readonly report?: (name: string, values: readonly unknown[]) => void;
};

/** What the frame keeps of a story drawn in a canvas. */
export type MountedStory = {
  /**
   * Resolves once the story is drawn in its canvas, so the play function finds what it drives; never resolves when the
   * story throws while it is first drawn (the error goes to `onError` instead).
   */
  readonly drawn: Promise<void>;
  /**
   * Draws the story again, keeping its state: other args, other switch values, another language; a story that threw
   * is tried again.
   */
  readonly update: (drawing: StoryDrawing) => void;
  /** Takes the story away from its canvas. */
  readonly unmount: () => void;
};

/** A framework, as the frame uses it. */
export type StoryRenderer = {
  /**
   * Draws a story in a canvas the frame owns.
   *
   * @param canvas - the element the story is drawn in.
   * @param drawing - the story, its args, texts, clock and language.
   * @param onError - called with the error when the story throws while it is drawn; the frame shows it instead.
   */
  readonly mount: (
    canvas: HTMLElement,
    drawing: StoryDrawing,
    onError: (error: Error) => void
  ) => MountedStory;
  /**
   * The story drawn as HTML on the server, for the generated server tests; throws when the story throws.
   *
   * @param drawing - the story, its args, texts, clock and language.
   */
  readonly renderToString: (drawing: StoryDrawing) => string;
};

/**
 * Writes a story drawn from its args as the framework's code, for the Code tab and Show code (`<Button tone="danger" />`
 * in React): the shell knows the component's name and the panel's values, and the framework knows its syntax.
 *
 * @param component - the component's name, as its documentation names it.
 * @param args - the values of the moment, a named value by its name.
 */
export type StoryCodeWriter = (component: string, args: PanelArgs) => string;

/** The `step` a render and a decorator receive: outside a play there is no trace, so a step only runs its part. */
export const untracedStep: StepFunction = async (
  _label: string,
  run: () => Promise<void> | void
): Promise<void> => {
  await run();
};
