/**
 * The messages between the shell and a story's frame, both on the same origin.
 *
 * @remarks
 * The frame tells the shell what the loaded story can do (Replay, a story clock, its args), how tall it is (the shell sizes the frame
 * to it, so a story never scrolls inside a box), every call of an event, or why it failed. The shell asks the frame to
 * replay, sends the props panel's values, names the events to record, and runs, holds, speeds up or restarts the
 * story clock. Every message is checked on arrival
 * (`isFrameMessage`, `isShellMessage`): a page may receive messages from anything it embeds or is embedded in.
 *
 * @module
 */

import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { isViolation, type Violation } from "./a11y.ts";
import { isPanelArgTypes, type PanelArgTypes } from "./argTypes.ts";
import { isMatrix, type Matrix } from "./matrix.ts";
import { isPlayTrace, type PlayTrace } from "./playTrace.ts";
import { type ClockState, isClockRate } from "./storyClock.ts";
import { type FixedView, isFixedView } from "./storyGlobals.ts";
import { type LiveView, MEASURE_TOOLS, type MeasureTool } from "./viewState.ts";

/**
 * An arg the props panel can show and set: what crosses between the documents as is. A list of texts or numbers is a
 * multiple choice's (`check`, `multi-select`); a date is a number of ms since the Unix epoch, as Storybook's.
 */
export type ArgValue = string | number | boolean | null | readonly (string | number)[] | NamedArg;

/**
 * A value the panel names instead of sending it: one of the source's `namedValues` (an icon component), which cannot
 * cross between the documents; the frame looks the name up in its own copy of the source.
 */
export type NamedArg = {
  /** The type the value is offered for, as the props write it (`IconComponent`). */
  readonly of: string;
  /** The value's name (`IconFolder`). */
  readonly named: string;
};

/** The args of a story the panel can show, by name. */
export type PanelArgs = Readonly<Record<string, ArgValue>>;

/** From a frame to the shell. */
export type FrameMessage =
  | {
      /** The story rendered. */
      readonly type: "forgebook:ready";
      /** The story's id. */
      readonly storyId: string;
      /** Whether the story declares a replay. */
      readonly canReplay: boolean;
      /** Whether the story reads the story clock (`parameters.clock`): the stage then shows its controls. */
      readonly hasClock: boolean;
      /** The story's own args the panel can show (strings, numbers, booleans), a named text in the shown language. */
      readonly args: PanelArgs;
      /** The args written `storyText("key")`, with their keys, for the panel to show beside the text. */
      readonly textKeys: Readonly<Record<string, string>>;
      /** How the panel shows the args, from the story's `argTypes`, by arg. */
      readonly argTypes: PanelArgTypes;
      /** The props the panel can set, as the story's parameters say once it ran (written by code too). */
      readonly controls: StoryControlsSetting;
      /** The args the frame records as actions (a spy, an `argTypes` action), whatever the shell names. */
      readonly actions: readonly string[];
      /** What the story fixes of the view (its `globals`, Storybook's backgrounds and viewport). */
      readonly fixed: FixedView;
    }
  | {
      /** The story's height changed. */
      readonly type: "forgebook:size";
      /** The story's id. */
      readonly storyId: string;
      /** The document's height, in CSS px. */
      readonly height: number;
    }
  | {
      /** An event of the story's component was called. */
      readonly type: "forgebook:call";
      /** The story's id. */
      readonly storyId: string;
      /** The event's prop (`onValueChange`). */
      readonly name: string;
      /** Each argument, written short for the log (`"monthly"`, `Event`, `{…}`). */
      readonly values: readonly string[];
      /** Each argument's content as JSON for an object or a list, to open in the log; `null` for any other. */
      readonly details: readonly (string | null)[];
    }
  | {
      /** The play function's trace changed: a step began or ended, or the play did. */
      readonly type: "forgebook:play";
      /** The story's id. */
      readonly storyId: string;
      /** The trace. */
      readonly trace: PlayTrace;
    }
  | {
      /** The accessibility check the shell asked for is over. */
      readonly type: "forgebook:checked";
      /** The story's id. */
      readonly storyId: string;
      /** The rules the story breaks; empty when it passes. */
      readonly violations: readonly Violation[];
    }
  | {
      /** The accessibility check could not run. */
      readonly type: "forgebook:check-error";
      /** The story's id. */
      readonly storyId: string;
      /** What went wrong. */
      readonly message: string;
    }
  | {
      /** The story could not be shown. */
      readonly type: "forgebook:error";
      /** The story's id. */
      readonly storyId: string;
      /** What went wrong. */
      readonly message: string;
    };

/** From the shell to a frame. */
export type ShellMessage =
  | {
      /** Replay the story, as it declares. */
      readonly type: "forgebook:replay";
    }
  | {
      /** The props panel's values, over the story's own args. */
      readonly type: "forgebook:args";
      /** The values set in the panel. */
      readonly args: PanelArgs;
    }
  | {
      /** The events to record: the component's `on…` props. */
      readonly type: "forgebook:events";
      /** Their names. */
      readonly names: readonly string[];
    }
  | {
      /** The tools drawn over the story changed: the frame draws these, without loading again. */
      readonly type: "forgebook:tools";
      /** The tools; none removes them. */
      readonly tools: readonly MeasureTool[];
    }
  | {
      /** Draw the story once per value of the matrix's axes, or as it is with none. */
      readonly type: "forgebook:matrix";
      /** The matrix; `null` draws the story alone. */
      readonly matrix: Matrix | null;
    }
  | {
      /** Mount the story again, so its play function runs again. */
      readonly type: "forgebook:play-again";
    }
  | {
      /** Run the accessibility check on the story as it is now. */
      readonly type: "forgebook:check";
    }
  | {
      /** Set whether the story clock runs, and how fast. */
      readonly type: "forgebook:clock";
      /** The clock's state. */
      readonly state: ClockState;
    }
  | {
      /** Bring the story clock back to its start and mount the story again. */
      readonly type: "forgebook:clock-restart";
    }
  | {
      /** The view's live part changed: the frame applies it on its root, without loading again. */
      readonly type: "forgebook:view";
      /** The switches' values, the backdrop and the text size. */
      readonly view: LiveView;
    };

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a set of args the panel can show. */
export const isPanelArgs = (value: unknown): value is PanelArgs =>
  isRecord(value) &&
  Object.values(value).every(
    (arg) =>
      arg === null ||
      typeof arg === "string" ||
      typeof arg === "number" ||
      typeof arg === "boolean" ||
      isChoiceList(arg) ||
      isNamedArg(arg)
  );

/**
 * Whether a value is a multiple choice's values: a list of texts and numbers.
 *
 * @param value - any value.
 */
export const isChoiceList = (value: unknown): value is readonly (string | number)[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number");

/**
 * Whether a value is a named arg.
 *
 * @param value - any value.
 */
export const isNamedArg = (value: unknown): value is NamedArg =>
  isRecord(value) && typeof value["of"] === "string" && typeof value["named"] === "string";

/** Whether a value is the view's live part. */
const isLiveView = (value: unknown): value is LiveView =>
  isRecord(value) &&
  isRecord(value["switches"]) &&
  Object.values(value["switches"]).every((switchValue) => typeof switchValue === "string") &&
  typeof value["backdrop"] === "string" &&
  typeof value["text"] === "number";

/** Whether a value is a story clock's state. */
const isClockState = (value: unknown): value is ClockState =>
  isRecord(value) && typeof value["isRunning"] === "boolean" && isClockRate(value["rate"]);

/** Whether a value is a list of strings. */
const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Whether a value is a controls setting: every prop, or the listed ones. */
const isControlsSetting = (value: unknown): value is StoryControlsSetting =>
  value === "all" || isStringList(value);

/** Whether a value is the text keys of a story's args: names to keys. */
const isTextKeys = (value: unknown): value is Readonly<Record<string, string>> =>
  isRecord(value) && Object.values(value).every((key) => typeof key === "string");

/**
 * Whether a received message is one a frame sends.
 *
 * @param value - the message's data.
 */
export const isFrameMessage = (value: unknown): value is FrameMessage => {
  if (!isRecord(value) || typeof value["storyId"] !== "string") return false;
  switch (value["type"]) {
    case "forgebook:ready":
      return (
        typeof value["canReplay"] === "boolean" &&
        typeof value["hasClock"] === "boolean" &&
        isPanelArgs(value["args"]) &&
        isTextKeys(value["textKeys"]) &&
        isPanelArgTypes(value["argTypes"]) &&
        isControlsSetting(value["controls"]) &&
        isStringList(value["actions"]) &&
        isFixedView(value["fixed"])
      );
    case "forgebook:size":
      return typeof value["height"] === "number";
    case "forgebook:call":
      return (
        typeof value["name"] === "string" &&
        isStringList(value["values"]) &&
        Array.isArray(value["details"]) &&
        value["details"].every((detail) => detail === null || typeof detail === "string")
      );
    case "forgebook:error":
    case "forgebook:check-error":
      return typeof value["message"] === "string";
    case "forgebook:play":
      return isPlayTrace(value["trace"]);
    case "forgebook:checked":
      return Array.isArray(value["violations"]) && value["violations"].every(isViolation);
    default:
      return false;
  }
};

/**
 * Whether a received message is one the shell sends.
 *
 * @param value - the message's data.
 */
export const isShellMessage = (value: unknown): value is ShellMessage => {
  if (!isRecord(value)) return false;
  if (
    value["type"] === "forgebook:replay" ||
    value["type"] === "forgebook:check" ||
    value["type"] === "forgebook:play-again" ||
    value["type"] === "forgebook:clock-restart"
  ) {
    return true;
  }
  if (value["type"] === "forgebook:args") return isPanelArgs(value["args"]);
  if (value["type"] === "forgebook:view") return isLiveView(value["view"]);
  if (value["type"] === "forgebook:clock") return isClockState(value["state"]);
  if (value["type"] === "forgebook:tools") {
    const tools = value["tools"];
    return Array.isArray(tools) && tools.every((tool) => MEASURE_TOOLS.some((known) => known === tool));
  }
  if (value["type"] === "forgebook:matrix") return value["matrix"] === null || isMatrix(value["matrix"]);
  return value["type"] === "forgebook:events" && isStringList(value["names"]);
};

/**
 * An event's argument written short for the call log.
 *
 * @param value - anything a callback received.
 */
export const previewValue = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value.length > 60 ? `${value.slice(0, 60)}…` : value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    return String(value);
  if (value === null || value === undefined) return String(value);
  if (typeof value === "function") return "ƒ";
  if (typeof Event !== "undefined" && value instanceof Event) return value.constructor.name;
  if (isRecord(value) && "nativeEvent" in value) return "SyntheticEvent";
  return Array.isArray(value) ? `[…${value.length}]` : "{…}";
};

/** The most characters an argument's content keeps in the log. */
const DETAIL_LENGTH = 2000;

/**
 * An argument's content for the log, when it is an object or a list: JSON, two spaces deep, a function as `ƒ`, an
 * object met again as `[circular]`, cut past `DETAIL_LENGTH`; `null` for anything else (a text, a number, an event).
 *
 * @param value - anything a callback received.
 */
export const detailOf = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) return null;
  if (typeof Event !== "undefined" && value instanceof Event) return null;
  if ("nativeEvent" in value) return null;
  const seen = new WeakSet<object>();
  const text = JSON.stringify(
    value,
    (_key: string, inner: unknown): unknown => {
      if (typeof inner === "function") return "ƒ";
      if (typeof inner === "bigint") return `${inner}n`;
      if (typeof inner === "object" && inner !== null) {
        if (seen.has(inner)) return "[circular]";
        seen.add(inner);
      }
      return inner;
    },
    2
  );
  return text.length > DETAIL_LENGTH ? `${text.slice(0, DETAIL_LENGTH)}…` : text;
};

/**
 * The panel's values written in an address (`args`): JSON, the only form that keeps `"12"` and `12` apart.
 *
 * @param args - the values.
 * @returns the parameter's text; empty when there is no value.
 */
export const panelArgsParam = (args: PanelArgs): string =>
  Object.keys(args).length === 0 ? "" : JSON.stringify(args);

/**
 * The panel's values an address names: none when the parameter is missing, not JSON, or not values the panel sets.
 *
 * @param param - the `args` parameter.
 */
export const parsePanelArgsParam = (param: string | null): PanelArgs => {
  if (param === null || param === "") return {};
  try {
    const value: unknown = JSON.parse(param);
    return isPanelArgs(value) ? value : {};
  } catch {
    return {};
  }
};
