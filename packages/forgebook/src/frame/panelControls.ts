/**
 * What a frame keeps of the custom controls with a frame module: the panel's latest values as their modules turned them,
 * and the story's own values they named. The turning itself (`controlValues.ts`) loads when the shell first gives values.
 *
 * @remarks
 * Turning values takes a load, so the shell's other messages wait for the values before them: a Replay or a matrix
 * right after a change draws the changed values, as without any frame module.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";

import type { PanelArgs, ShellMessage } from "../messages.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { panelArgTypesOf } from "../storyArgTypes.ts";
import type { ControlStory, ControlValues } from "./controlValues.ts";
import { STATUS_ATTRIBUTE } from "./frameStatus.ts";
import { panelArgsOf } from "./panelValues.ts";
import type { StoryControls } from "./storyRun.ts";

/** The custom controls' frame modules, by control: how to load each. */
export type ControlFrameLoaders = Readonly<Record<string, () => Promise<unknown>>>;

/** The story a message is for, as `take` reads it. */
export type TakenStory<TControls> = {
  /** The story as it is now. */
  readonly story: Omit<ControlStory, "loadDocs">;
  /** Its controls once drawn; none before, when nothing is answered. */
  readonly controls: TControls | undefined;
  /** Tells the shell the story's own values again. */
  readonly tellReady: () => void;
};

/** A frame's custom controls with a frame module; with none, it hands the shell's messages on as they come. */
export type PanelControls = {
  /**
   * Answers a message of the shell: the panel's values turned first, then given to the story; any other message after
   * the values before it. A later change of values overtakes one still turning.
   *
   * @param message - the message.
   * @param story - the story as it is now, and its controls once drawn; none before, when nothing is answered.
   * @param answer - answers any other message.
   */
  readonly take: <TControls extends Pick<StoryControls, "setPanelArgs">>(
    message: ShellMessage,
    story: TakenStory<TControls>,
    answer: (controls: TControls) => void
  ) => void;
  /**
   * The story's values with the turned ones over them; an arg whose control failed is left out, so the story keeps its
   * own: its JSON is not what the story takes.
   *
   * @param resolved - the panel's values as the story would take them without the modules.
   */
  readonly storyArgs: (resolved: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>;
  /**
   * The story's own values for the panel, with those the modules named over them.
   *
   * @param own - the story's own values, as plain data gives them.
   */
  readonly withOwn: (own: PanelArgs) => PanelArgs;
  /**
   * The panel's values of a story that changed its own args: a value a module made is given back as the panel's JSON it
   * came from, which plain data cannot hold, so the panel keeps the reader's choice.
   *
   * @param values - the story's values.
   * @param shown - the same as plain data gives them.
   */
  readonly panelArgs: (values: Readonly<Record<string, unknown>>, shown: PanelArgs) => PanelArgs;
};

/**
 * Whether a frame module may have something to do for the story, so its docs are worth loading: the panel gives a
 * value (any prop may be one a control takes by type), the story's `argTypes` name a control with a frame module, or
 * the story gives itself a value plain data cannot show (an icon a module could name). A story with none of these, most
 * of a page's frames, loads neither the turning code nor its docs.
 *
 * @param args - the panel's values.
 * @param story - the story.
 * @param loaders - the frame modules, by control.
 * @param source - the story's source, whose named values show some values plainly.
 */
const mayTurn = (
  args: PanelArgs,
  story: Omit<ControlStory, "loadDocs">,
  loaders: ControlFrameLoaders,
  source: StorySource
): boolean => {
  if (Object.keys(args).length > 0) return true;
  const named = Object.values(panelArgTypesOf(story.argTypes, [])).some(
    (argType) => argType.customControl !== undefined && Object.hasOwn(loaders, argType.customControl)
  );
  const shown = panelArgsOf(story.args, source.namedValues);
  // an event's handler is no value a control sets: a type's control never takes an event
  return (
    named ||
    Object.entries(story.args).some(
      ([name, value]) => value !== undefined && !Object.hasOwn(shown, name) && !/^on[A-Z]/.test(name)
    )
  );
};

/**
 * A frame's custom controls with a frame module.
 *
 * @param loaders - the frame modules, by control; none hands every message on as it comes.
 * @param source - the story's source, whose docs name the controls given by type.
 * @param file - the story's file, the key of its docs.
 * @param report - says what went wrong.
 */
export const panelControls = (
  loaders: ControlFrameLoaders | undefined,
  source: StorySource,
  file: string,
  report: (message: string) => void
): PanelControls => {
  const loadDocs = sourceFiles(source).docs[file];
  let made: ControlValues | undefined;
  // the panel's values last given, as JSON: what the made values came from
  let given: PanelArgs = {};
  let count = 0;
  // the values still turning, which the other messages wait for
  let turning: Promise<void> = Promise.resolve();
  const reportError = (error: unknown): void =>
    report(error instanceof Error ? error.message : String(error));
  return {
    take: <TControls extends Pick<StoryControls, "setPanelArgs">>(
      message: ShellMessage,
      { story, controls, tellReady }: TakenStory<TControls>,
      answer: (drawn: TControls) => void
    ): void => {
      if (controls === undefined) return;
      if (message.type !== "forgebook:args") {
        if (loaders === undefined) answer(controls);
        else turning = turning.then(() => answer(controls));
      } else if (loaders === undefined) controls.setPanelArgs(message.args);
      else if (!mayTurn(message.args, story, loaders, source)) {
        // nothing a module could turn or name: no module, and no docs, load for this story
        const hadOwn = Object.keys(made?.own ?? {}).length > 0;
        count += 1;
        made = undefined;
        turning = turning.then(() => {
          controls.setPanelArgs(message.args);
          if (hadOwn) tellReady();
        });
      } else {
        count += 1;
        const asked = count;
        turning = import("./controlValues.ts")
          .then(({ controlValuesOf }) => controlValuesOf(message.args, loaders, { ...story, loadDocs }))
          .then((next) => {
            // values the reader changed again meanwhile are the next call's to draw
            if (asked !== count) return;
            const isOwnNew = JSON.stringify(next.own) !== JSON.stringify(made?.own ?? {});
            made = next;
            given = message.args;
            controls.setPanelArgs(message.args);
            for (const problem of next.problems) report(problem);
            // the panel shows the story's own value a module names, told once known; a story in error stays one
            const isError = document.documentElement.getAttribute(STATUS_ATTRIBUTE) === "error";
            if (isOwnNew && !isError) tellReady();
          })
          .catch((error: unknown) => {
            reportError(error);
            // without the modules the story still takes the values plain data can give
            if (asked !== count) return;
            made = undefined;
            controls.setPanelArgs(message.args);
          });
      }
    },
    storyArgs: (resolved: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
      const dropped = made?.dropped ?? [];
      return Object.fromEntries(
        Object.entries({ ...resolved, ...made?.values }).filter(([name]) => !dropped.includes(name))
      );
    },
    withOwn: (own: PanelArgs): PanelArgs => ({ ...own, ...made?.own }),
    panelArgs: (values: Readonly<Record<string, unknown>>, shown: PanelArgs): PanelArgs => {
      const kept = Object.entries(made?.values ?? {}).flatMap(
        ([name, value]): [string, PanelArgs[string]][] => {
          const json = given[name];
          return json !== undefined && Object.hasOwn(values, name) && values[name] === value
            ? [[name, json]]
            : [];
        }
      );
      return { ...shown, ...Object.fromEntries(kept) };
    }
  };
};
