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
import type { ControlStory, ControlValues } from "./controlValues.ts";
import { STATUS_ATTRIBUTE } from "./frameStatus.ts";
import type { StoryControls } from "./storyRun.ts";

/** The custom controls' frame modules, by control: how to load each. */
export type ControlFrameLoaders = Readonly<Record<string, () => Promise<unknown>>>;

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
  readonly take: (
    message: ShellMessage,
    story: {
      readonly story: Omit<ControlStory, "loadDocs">;
      readonly controls: StoryControls | undefined;
      readonly tellReady: () => void;
    },
    answer: (controls: StoryControls) => void
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
    take: (
      message: ShellMessage,
      { story, controls, tellReady }: Parameters<PanelControls["take"]>[1],
      answer: (drawn: StoryControls) => void
    ): void => {
      if (controls === undefined) return;
      if (message.type !== "forgebook:args") {
        if (loaders === undefined) answer(controls);
        else turning = turning.then(() => answer(controls));
      } else if (loaders === undefined) controls.setPanelArgs(message.args);
      else {
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
