/**
 * The messages between the shell and a story's frame, both on the same origin.
 *
 * @remarks
 * The frame tells the shell what the loaded story can do (Replay, a story clock, its args), how tall it is (the shell sizes the frame
 * to it, so a story never scrolls inside a box), every call of an event, the args the story changed itself, or why it
 * failed. The shell asks the frame to
 * replay, sends the props panel's values, names the events to record, and runs, holds, speeds up or restarts the
 * story clock. Every message is checked on arrival
 * (`isFrameMessage`, `frame/shellMessageCheck.ts`): a page may receive messages from anything it embeds or is embedded in.
 *
 * @module
 */

import type { StoryControlsSetting } from "@forgebook/story-format/source";

import { isViolation, type Violation } from "./a11y.ts";
import { isPanelArgTypes, type PanelArgTypes } from "./argTypes.ts";
import type { Matrix } from "./matrix.ts";
import { isPlayTrace, type PlayTrace } from "./playTrace.ts";
import type { JsonValue } from "./plugin.ts";
import type { ClockState } from "./storyClock.ts";
import { type FixedView, isFixedView } from "./storyGlobals.ts";
import type { LiveView, MeasureTool } from "./viewState.ts";

/**
 * An arg the props panel can show and set: what crosses between the documents as is. Plain JSON, so a link can hold it:
 * a list and an object nest (`valueShape.ts` says what a prop's look like); a date is a number of ms since the Unix
 * epoch, as Storybook's. Two objects mean more than their fields: a `NamedArg`, and at the top of the args an `UnsetArg`.
 */
export type ArgValue = string | number | boolean | null | readonly ArgValue[] | ArgObject;

/** An object among the args: named fields. */
export type ArgObject = {
  /** Each field's value. */
  readonly [name: string]: ArgValue;
};

/**
 * A prop the panel leaves without a value, over what the story's own args give it: the story receives `undefined`, which
 * neither an empty text nor the panel holding nothing says (the panel holding nothing gives the story's own value).
 */
export type UnsetArg = {
  /** The mark: a name no prop's own object holds. */
  readonly forgebookUnset: true;
};

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
      /** The names of the story's parameters, which decide the plugins' tabs. */
      readonly parameters: readonly string[];
    }
  | {
      /**
       * The story changed its own args (Storybook's `useArgs`): the panel takes these values, as if the reader had set
       * them. All of them, the story's change applied, so the last of two changes in a row holds both.
       */
      readonly type: "forgebook:story-args";
      /** The story's id. */
      readonly storyId: string;
      /** The panel's values after the change, those the panel can show: another value is the frame's alone. */
      readonly args: PanelArgs;
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
    }
  | {
      /** The spills were measured again, while the shell asks for them (`forgebook:spills`). */
      readonly type: "forgebook:spills";
      /** The story's id. */
      readonly storyId: string;
      /** How many elements spill out of their parents. */
      readonly count: number;
    }
  | {
      /** A plugin's frame module told its tab about the story. */
      readonly type: "forgebook:plugin";
      /** The story's id. */
      readonly storyId: string;
      /** The plugin's id. */
      readonly plugin: string;
      /** What its tabs receive. */
      readonly value: JsonValue;
      /** A short note beside a tab's name; none shows nothing. */
      readonly hint: string | null;
      /** The tab the note is for; none for the plugin's first. */
      readonly tab: string | null;
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
      /** Outline the elements that spill out of their parents and count them, or stop. */
      readonly type: "forgebook:spills";
      /** Whether the frame measures the spills. */
      readonly isOn: boolean;
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

/** The deepest a value nests: a link's `[[[…` must not run the reader out of stack. */
const MOST_DEPTH = 16;

/** The names a value never holds: a component that merges it would write on every object of the page. */
const PROTOTYPE_NAMES: readonly string[] = ["__proto__", "constructor", "prototype"];

/** Whether a value, this deep, is one the panel can show. */
const isArgValueAt = (value: unknown, depth: number): value is ArgValue => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (depth >= MOST_DEPTH) return false;
  if (Array.isArray(value)) return value.every((item) => isArgValueAt(item, depth + 1));
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([name, item]) => !PROTOTYPE_NAMES.includes(name) && isArgValueAt(item, depth + 1)
    )
  );
};

/**
 * Whether a value is a list among the args.
 *
 * @param value - an arg's value.
 */
export const isArgList = (value: ArgValue): value is readonly ArgValue[] => Array.isArray(value);

/**
 * Whether a value is an object among the args (a named value is one too).
 *
 * @param value - an arg's value.
 */
export const isArgObject = (value: ArgValue): value is ArgObject => isRecord(value);

/**
 * A `Date`, as the address and the messages write it: JSON has none, and the story must receive one. `frame/panelValues.ts`
 * reads it both ways.
 */
export type DateArg = {
  /** The moment, as `Date.toISOString` writes it. */
  readonly forgebookDate: string;
};

/**
 * Whether a value is a `Date` as the panel writes it.
 *
 * @param value - an arg's value.
 */
export const isDateArg = (value: unknown): value is DateArg =>
  isRecord(value) &&
  typeof value["forgebookDate"] === "string" &&
  Object.keys(value).length === 1 &&
  !Number.isNaN(Date.parse(value["forgebookDate"]));

/** The value that says a prop has none, as the address and the messages write it. */
export const UNSET_ARG: UnsetArg = { forgebookUnset: true };

/**
 * Whether a value is the panel's "no value".
 *
 * @param value - an arg's value.
 */
export const isUnsetArg = (value: unknown): value is UnsetArg =>
  isRecord(value) && value["forgebookUnset"] === true && Object.keys(value).length === 1;

/**
 * Whether a value is one the panel can show.
 *
 * @param value - any value.
 */
export const isArgValue = (value: unknown): value is ArgValue => isArgValueAt(value, 0);

/** Whether a value is a set of args the panel can show. */
export const isPanelArgs = (value: unknown): value is PanelArgs =>
  isRecord(value) && Object.values(value).every(isArgValue);

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
  isRecord(value) &&
  typeof value["of"] === "string" &&
  typeof value["named"] === "string" &&
  Object.keys(value).length === 2;

/** Whether a value is a list of strings. */
const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Whether a value is a controls setting: every prop, or the listed ones. */
const isControlsSetting = (value: unknown): value is StoryControlsSetting =>
  value === "all" || isStringList(value);

/** Whether a value is the text keys of a story's args: names to keys. */
const isTextKeys = (value: unknown): value is Readonly<Record<string, string>> =>
  isRecord(value) && Object.values(value).every((key) => typeof key === "string");

/** Whether a value stays what it is as JSON. */
const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  // a date or a map crosses between the documents as it is, and would not be what a tab reads as JSON
  return (
    isRecord(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isJsonValue)
  );
};

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
        isFixedView(value["fixed"]) &&
        isStringList(value["parameters"])
      );
    case "forgebook:story-args":
      return isPanelArgs(value["args"]);
    case "forgebook:size":
      return typeof value["height"] === "number";
    case "forgebook:spills":
      return typeof value["count"] === "number";
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
    case "forgebook:plugin":
      return (
        typeof value["plugin"] === "string" &&
        isJsonValue(value["value"]) &&
        (value["hint"] === null || typeof value["hint"] === "string") &&
        (value["tab"] === null || typeof value["tab"] === "string")
      );
    default:
      return false;
  }
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
